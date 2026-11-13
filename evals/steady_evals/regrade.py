"""
Re-grade a finished run with the current checks and cases, without calling the model again:

    uv run --project ../services/api python -m steady_evals.regrade reports/runs/<run>

Writes regraded.jsonl and regraded_summary.md next to the originals (which are kept as they were). Use it when a
check or a case expectation is corrected; the model's replies and tool calls stay exactly as recorded.
"""

import json
import sys
from pathlib import Path

from . import cases as cases_mod
from . import sim_tools
from .checks import grade
from .harness import TurnResult, build_messages
from .run import summarize


def rebuild(row: dict, case: cases_mod.Case) -> TurnResult:
    state = sim_tools.SimState(calls=row["tool_calls"])
    for c in row["tool_calls"]:
        if c["name"] == "propose_glucose" and c["result"].get("status") == "shown_for_confirmation":
            state.proposal = state.proposal or {"value": c["arguments"].get("value"), "unit": c["arguments"].get("unit")}
        if c["name"] == "remember" and c["result"].get("status") == "saved":
            state.memories_saved.append(c["arguments"].get("text", ""))
    res = TurnResult(case_id=row["case"], model="", draft=row["draft"], shown=row["shown"], withheld=row["withheld"], state=state, error=row["error"])
    res.transcript = row["transcript"]
    res.system_prompt = build_messages(case)[0]["content"]
    return res


def main(path: Path) -> None:
    meta = json.loads((path / "meta.json").read_text(encoding="utf-8"))
    rows = [json.loads(x) for x in (path / "results.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    by_id = {c.id: c for c in cases_mod.load()}
    out = []
    for r in rows:
        case = by_id[r["case"]]
        checks = grade(case, rebuild(r, case))
        out.append({**r, "checks": checks, "pass": all(v["pass"] for v in checks.values())})
    with (path / "regraded.jsonl").open("w", encoding="utf-8") as f:
        for r in out:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
    selected = [by_id[c] for c in dict.fromkeys(r["case"] for r in rows)]
    meta = {**meta, "label": meta["label"] + " (regraded)"}
    (path / "regraded_summary.md").write_text(summarize(out, meta, selected), encoding="utf-8")
    print(f"{path.name}: {sum(r['pass'] for r in out)}/{len(out)} pass after regrade (was {sum(r['pass'] for r in rows)}/{len(rows)})")


if __name__ == "__main__":
    for a in sys.argv[1:]:
        main(Path(a))
