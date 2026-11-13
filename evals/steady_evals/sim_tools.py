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
from .production import GLUCOSE_ENTRY_MGDL_MAX, GLUCOSE_ENTRY_MGDL_MIN, about_someone_else, prod_tools, to_mgdl

KNOWN = {"propose_glucose", "recent_records", "remember", "schedule_follow_up", "propose_profile_update", "note_profile_question"}
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
