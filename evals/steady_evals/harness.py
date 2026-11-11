"""Runs one case through a model the way `steady_api.routers.conversation.complete_turn` does."""

import json
import threading
import uuid
from dataclasses import dataclass, field
from datetime import UTC, timedelta

from . import sim_tools
from .cases import Case
from .production import (
    MAX_TOOL_ROUNDS,
    TOOL_SPECS,
    DeviceLink,
    GlucoseRecord,
    Memory,
    Profile,
    Record,
    User,
    prod_context,
    reads_as_dose_instruction,
    system_prompt,
)
from .providers import Provider, ProviderError


@dataclass
class TurnResult:
    case_id: str
    model: str
    draft: str | None  # what the model wrote
    shown: str | None  # what the person would see after the production dose filter (None when withheld)
    withheld: bool
    state: sim_tools.SimState
    error: str | None = None
    rounds: int = 0
    latency_s: float = 0.0
    usage: list[dict] = field(default_factory=list)
    transcript: list[dict] = field(default_factory=list)
    system_prompt: str = ""


def build_profile(case: Case) -> Profile:
    p = case.profile
    answers = {"companion": p.get("companion", {}), "rapid": p.get("rapid", []), "basal": p.get("basal", [])}
    return Profile(
        locale=p.get("locale", case.lang), diabetes_type=p.get("diabetes_type", "type1"), glucose_unit=p.get("glucose_unit", "mgdl"), answers=answers
    )


class _Rows(list):
    def all(self):
        return self


class FixtureDB:
    """Answers the three queries `steady_api.ai.context.snapshot` makes, from a case's fixture records, applying the
    same filters and order as its SQL (last 24 h of glucose newest first; records since the earlier of local midnight
    and 6 h ago, oldest first, at most MAX_RECORDS; device links)."""

    def __init__(self, case: Case):
        utc_now = case.now.astimezone(UTC)
        self.now = utc_now
        self.glucose = [
            GlucoseRecord(
                value=g["value"], unit=g["unit"], measured_at=utc_now - timedelta(minutes=g["minutes_ago"]), source=g.get("source", "manual")
            )
            for g in case.records.get("glucose", [])
        ]
        self.records = [
            Record(
                kind=r["kind"], data=r.get("data", {}), occurred_at=utc_now - timedelta(minutes=r["minutes_ago"]), source=r.get("source", "manual")
            )
            for r in case.records.get("records", [])
        ]
        self.local_now = case.now

    def scalars(self, stmt):
        entity = stmt.column_descriptions[0]["entity"]
        if entity is GlucoseRecord:
            since = self.now - timedelta(hours=24)
            return _Rows(sorted((g for g in self.glucose if g.measured_at >= since), key=lambda g: g.measured_at, reverse=True))
        if entity is Record:
            start = min(self.local_now.replace(hour=0, minute=0, second=0, microsecond=0), self.local_now - timedelta(hours=6))
            rows = sorted((r for r in self.records if r.occurred_at >= start), key=lambda r: r.occurred_at)
            return _Rows(rows[: prod_context.MAX_RECORDS])
        if entity is DeviceLink:
            return _Rows()
        raise NotImplementedError(f"FixtureDB has no answer for {entity}")


_clock = threading.Lock()
_EVAL_USER = User(id=uuid.UUID(int=0))  # never stored; only used to build the query the FixtureDB answers


def data_block(case: Case, profile: Profile) -> list[str]:
    """The production data block (`context.about` + `context.snapshot`), with the module's clock set to the case's."""
    with _clock:
        real = prod_context.now
        prod_context.now = lambda: case.now.astimezone(UTC)
        try:
            return prod_context.about(profile, case.now.date()) + prod_context.snapshot(FixtureDB(case), _EVAL_USER, case.now)  # type: ignore[arg-type]
        finally:
            prod_context.now = real


def build_messages(case: Case) -> list[dict]:
    mems = [Memory(group=m["group"], text=m["text"]) for m in case.memories] if case.memory_on else []
    profile = build_profile(case)
    sp = system_prompt(profile, mems, case.now, case.memory_on, None, data=data_block(case, profile))
    return [{"role": "system", "content": sp}, *case.history, {"role": "user", "content": case.user}]


def run_case(case: Case, provider: Provider) -> TurnResult:
    messages = build_messages(case)
    state = sim_tools.SimState()
    res = TurnResult(case_id=case.id, model=provider.label, draft=None, shown=None, withheld=False, state=state)
    try:
        for i in range(MAX_TOOL_ROUNDS):
            c = provider.complete(messages, TOOL_SPECS)
            res.rounds = i + 1
            res.latency_s += c.latency_s
            if c.usage:
                res.usage.append(c.usage)
            if not c.tool_calls:
                res.draft = (c.text or "").strip()
                break
            messages.append(
                {
                    "role": "assistant",
                    "content": c.text,
                    "tool_calls": [
                        {"id": t.id, "type": "function", "function": {"name": t.name, "arguments": json.dumps(t.arguments, ensure_ascii=False)}}
                        for t in c.tool_calls
                    ],
                }
            )
            for t in c.tool_calls:
                out = sim_tools.run(case, t.name, t.arguments, state)
                messages.append({"role": "tool", "tool_call_id": t.id, "content": json.dumps(out, ensure_ascii=False)})
        else:
            res.error = "too_many_tool_rounds"
    except ProviderError as exc:
        res.error = str(exc)
    res.transcript = messages[1:]
    res.system_prompt = messages[0]["content"]
    if res.draft and reads_as_dose_instruction(res.draft):
        res.withheld = True
    else:
        res.shown = res.draft
    return res
