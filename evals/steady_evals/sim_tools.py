"""
The production tools, run against a case's fixture records instead of a database.

Argument validation reuses the production pydantic models and range limits, so a call that production would reject
is rejected here too. Results have the same shape as `steady_api.ai.tools._dispatch`. Keep this in step with that
file: `tests/test_sim_tools.py` fails when production adds a tool this module doesn't know.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from pydantic import ValidationError

from .cases import Case
from .production import GLUCOSE_ENTRY_MGDL_MAX, GLUCOSE_ENTRY_MGDL_MIN, about_someone_else, prod_app_data, prod_tools, to_mgdl

SIMULATED = {
    "propose_glucose",
    "show_emergency_call",
    "give_badge",
    "recent_records",
    "remember",
    "schedule_follow_up",
    "propose_profile_update",
    "note_profile_question",
    "similar_meals",
    "recall_conversations",
    "app_data",
}
# Tools answered only from a case's `tool_results` fixture (no case needs their logic yet).
FIXTURE_ONLY = {
    "propose_meal",
    "propose_activity",
    "propose_insulin",
    "propose_note",
    "save_proposal",
    "glucose_history",
    "show_support",
    "show_booking_help",
}
KNOWN = SIMULATED | FIXTURE_ONLY
MAX_MEMORIES = prod_tools.MAX_MEMORIES


@dataclass
class SimState:
    calls: list[dict] = field(default_factory=list)  # {"name", "arguments", "result"}
    proposal: dict | None = None
    memories_saved: list[str] = field(default_factory=list)
    follow_ups: list[dict] = field(default_factory=list)


def run(case: Case, name: str, args: dict, state: SimState) -> dict:
    try:
        result = _dispatch(case, name, args, state)
    except ValidationError as exc:
        result = {"error": "invalid_arguments", "detail": [e["msg"] for e in exc.errors()][:3]}
    state.calls.append({"name": name, "arguments": args, "result": result})
    return result


def _at(case: Case, minutes_ago: float) -> datetime:
    return case.now - timedelta(minutes=minutes_ago)


def _dispatch(case: Case, name: str, args: dict, state: SimState) -> dict:
    if name == "propose_glucose":
        a = prod_tools.ProposeGlucose.model_validate(args)
        mgdl = to_mgdl(a.value, a.unit)
        if not GLUCOSE_ENTRY_MGDL_MIN <= mgdl <= GLUCOSE_ENTRY_MGDL_MAX:
            return {"error": "out_of_range", "detail": "Ask the person to check the number and unit."}
        if state.proposal is not None:
            return {"status": "already_proposed", "detail": "A card is already shown for this message."}
        own = "mmol/L" if case.profile.get("glucose_unit") == "mmol" else "mg/dL"
        said_unit = re.search(r"mmol|ממול|ммоль|ملمول" if a.unit == "mmol/L" else r"mg|מ\"ג|מג|мг|ملغ", f"{case.user} {a.heard}", re.I)
        if a.unit != own and not said_unit:
            return {"status": "not_proposed", "detail": f"The person's unit is {own}. Ask which unit they meant before proposing."}
        if about_someone_else(a.heard) or about_someone_else(case.user):
            return {"status": "not_proposed", "detail": "This reading is about someone else; it does not go on the person's record. Say so briefly."}
        state.proposal = {"value": a.value, "unit": a.unit, "heard": a.heard, "minutes_ago": a.minutes_ago}
        return {"status": "shown_for_confirmation", "saved": False}
    if name == "propose_profile_update":
        a = prod_tools.ProposeProfile.model_validate(args)
        if not a.lasting:
            return {"status": "not_proposed", "detail": "A one-time event does not change the profile. Don't change it; talk about it if it helps."}
        if (why := prod_tools.check_profile(a)) is not None:
            return {"error": why}
        if state.proposal is not None:
            return {"status": "already_proposed", "detail": "A card is already shown for this message."}
        if about_someone_else(a.heard) or about_someone_else(case.user):
            return {"status": "not_proposed", "detail": "This is about someone else, not the person's own profile."}
        state.proposal = {"kind": "profile", "field": a.field, "op": a.op, "values": a.values}
        return {"status": "shown_for_confirmation", "saved": False}
    if name == "note_profile_question":
        prod_tools.NoteQuestion.model_validate(args)
        return {"status": "noted"}
    if name == "recent_records":
        a = prod_tools.RecentRecords.model_validate(args)
        return _recent(case, a.hours)
    if name == "remember":
        a = prod_tools.Remember.model_validate(args)
        if not case.memory_on:
            return {"status": "not_saved", "detail": "The person turned memory off. Do not say you will remember."}
        if len(case.memories) + len(state.memories_saved) >= MAX_MEMORIES:
            return {"status": "not_saved", "detail": "Memory is full; the person can remove some in Routine > Memory."}
        state.memories_saved.append(a.text.strip())
        return {"status": "saved", "id": f"sim-memory-{len(state.memories_saved)}"}
    if name == "schedule_follow_up":
        a = prod_tools.ScheduleFollowUp.model_validate(args)
        if (a.minutes_from_now is None) == (a.local_time is None):
            return {"error": "invalid_arguments", "detail": ["Give exactly one of minutes_from_now or local_time."]}
        if state.follow_ups:
            return {"status": "already_scheduled", "detail": "One follow-up per message."}
        if a.minutes_from_now is not None:
            due = case.now + timedelta(minutes=a.minutes_from_now)
        else:
            hh, mm = (int(x) for x in (a.local_time or "00:00").split(":"))
            due = case.now.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if due <= case.now:
                due += timedelta(days=1)
        state.follow_ups.append({"title": a.title, "due": due.isoformat(), "repeat": a.repeat})
        return {"status": "scheduled", "due_local": due.strftime("%a %H:%M"), "repeat": a.repeat}
    if name == "similar_meals":
        a = prod_tools.SimilarMeals.model_validate(args)
        if "similar_meals" in case.tool_results:
            return {**case.tool_results["similar_meals"], "query": a.food}
        return {"query": a.food, "meals": 0, "detail": "No meals matching this in the last 90 days."}
    if name == "recall_conversations":
        prod_tools.RecallConversations.model_validate(args)
        if not case.memory_on:
            return {"status": "off", "detail": "The person turned memory off: earlier conversations are not used."}
        return case.tool_results.get("recall_conversations", {"status": "nothing_yet", "detail": "No earlier conversations to look in yet."})
    if name == "app_data":
        # The app's screens (PM-268), read-only: a case's `tool_results["app_data"][section]`, else the section empty.
        a = prod_app_data.AppData.model_validate(args)
        given = case.tool_results.get("app_data", {})
        return {"section": a.section, **given.get(a.section, {}), "note": prod_app_data.NOTE}
    if name == "show_emergency_call":
        # Same answer as production: a call button, never a number from the model (Guy, 17 Nov 2026).
        if any(c["name"] == name for c in state.calls):
            return {"status": "already_shown"}
        return {"status": "shown", "detail": "A call button for the local emergency number is on screen. Don't write a phone number."}
    if name == "give_badge":
        # Same answers as production: one badge a turn, only a listed one (PM-299).
        if args.get("badge") not in prod_tools.BADGE_SPEC["function"]["parameters"]["properties"]["badge"]["enum"]:
            return {"status": "not_available"}
        if any(c["name"] == name for c in state.calls):
            return {"status": "already_given"}
        return {"status": "given"}
    if name in FIXTURE_ONLY:
        return case.tool_results.get(name, {"error": "not_simulated"})
    return {"error": "unknown_tool"}


def _recent(case: Case, hours: int) -> dict:
    """Same shape as production: times on the person's clock (`at_local`, "%a %H:%M"), with the source."""
    limit = hours * 60
    g = sorted((x for x in case.records.get("glucose", []) if x["minutes_ago"] <= limit), key=lambda x: -x["minutes_ago"])
    r = sorted((x for x in case.records.get("records", []) if x["minutes_ago"] <= limit), key=lambda x: -x["minutes_ago"])
    return {
        "hours": hours,
        "glucose": [
            {
                "at_local": _at(case, x["minutes_ago"]).strftime("%a %H:%M"),
                "value": x["value"],
                "unit": x["unit"],
                "method": x.get("method", "manual"),
                "source": x.get("source", "manual"),
            }
            for x in g
        ],
        "records": [
            {
                "at_local": _at(case, x["minutes_ago"]).strftime("%a %H:%M"),
                "kind": x["kind"],
                "data": x.get("data", {}),
                "source": x.get("source", "manual"),
            }
            for x in r
        ],
        "note": "Only what the person saved. Do not infer anything that is not here.",
    }
