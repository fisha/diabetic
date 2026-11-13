"""
Evaluation cases. Each case is one turn of the person, with the context the production prompt would see.

Records in a case are synthetic test fixtures that exist only inside this evaluation track (brief section 3 allows
fixtures in isolated tests). They are never seeded into an account and never come from a real person's data.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

CASES_DIR = Path(__file__).resolve().parents[1] / "cases"
LANGS = ("en", "he", "ar", "ru")
CATEGORIES = (
    "tool_correctness",
    "missing_data",
    "unsupported_claims",
    "uncertainty",
    "numeric_transcription",
    "scope",
    "dose_boundary",
    "memory_followup",
    "off_topic",
)


@dataclass
class Case:
    id: str
    split: str
    lang: str
    categories: list[str]
    user: str
    now: datetime
    profile: dict = field(default_factory=dict)
    memories: list[dict] = field(default_factory=list)
    memory_on: bool = True
    records: dict = field(default_factory=dict)
    history: list[dict] = field(default_factory=list)
    expect: dict = field(default_factory=dict)
    scope_flags: list[str] = field(default_factory=list)
    review: str | None = None
    notes: str = ""

    @classmethod
    def from_dict(cls, d: dict) -> "Case":
        c = cls(
            id=d["id"],
            split=d["split"],
            lang=d["lang"],
            categories=list(d["categories"]),
            user=d["user"],
            now=datetime.fromisoformat(d.get("now", "2026-11-11T08:30:00+02:00")),
            profile=d.get("profile", {}),
            memories=d.get("memories", []),
            memory_on=d.get("memory_on", True),
            records=d.get("records", {}),
            history=d.get("history", []),
            expect=d.get("expect", {}),
            scope_flags=d.get("scope_flags", []),
            review=d.get("review"),
            notes=d.get("notes", ""),
        )
        c.validate()
        return c

    def validate(self) -> None:
        if self.split not in ("dev", "heldout"):
            raise ValueError(f"{self.id}: split must be dev or heldout")
        if self.lang not in LANGS:
            raise ValueError(f"{self.id}: unknown lang {self.lang}")
        bad = [c for c in self.categories if c not in CATEGORIES]
        if bad:
            raise ValueError(f"{self.id}: unknown categories {bad}")
        if self.now.tzinfo is None:
            raise ValueError(f"{self.id}: now needs a UTC offset")


def load(split: str | None = None, langs: tuple[str, ...] | None = None, ids: set[str] | None = None) -> list[Case]:
    out: list[Case] = []
    seen: set[str] = set()
    for path in sorted(CASES_DIR.glob("*.jsonl")):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip() or line.lstrip().startswith("//"):
                continue
            try:
                case = Case.from_dict(json.loads(line))
            except (KeyError, ValueError, json.JSONDecodeError) as exc:
                raise ValueError(f"{path.name}:{n}: {exc}") from exc
            if case.id in seen:
                raise ValueError(f"{path.name}:{n}: duplicate id {case.id}")
            seen.add(case.id)
            if split and case.split != split:
                continue
            if langs and case.lang not in langs:
                continue
            if ids and case.id not in ids:
                continue
            out.append(case)
    return out
