"""Side by side comparison of runs: `python -m steady_evals.compare reports/runs/A reports/runs/B ...`."""

import json
import sys
from collections import defaultdict
from pathlib import Path


def load(path: Path) -> tuple[dict, list[dict]]:
    meta = json.loads((path / "meta.json").read_text(encoding="utf-8"))
    rows = [json.loads(x) for x in (path / "results.jsonl").read_text(encoding="utf-8").splitlines() if x.strip()]
    return meta, rows


def table(paths: list[Path]) -> str:
    runs = [load(p) for p in paths]
    checks = sorted({k for _, rows in runs for r in rows for k in r["checks"]})
    langs = sorted({r["lang"] for _, rows in runs for r in rows})
    head = "| | " + " | ".join(m["label"] for m, _ in runs) + " |"
    sep = "|---|" + "---|" * len(runs)
    lines = [head, sep]

    def cell(rows: list[dict], pred) -> str:
        sel = [r for r in rows if pred(r) is not None]
        ok = sum(1 for r in sel if pred(r))
        return f"{ok}/{len(sel)}" if sel else "–"

    lines.append("| **all checks** | " + " | ".join(cell(rows, lambda r: r["pass"]) for _, rows in runs) + " |")
    for k in checks:
        lines.append(
            f"| {k} | " + " | ".join(cell(rows, lambda r, k=k: r["checks"][k]["pass"] if k in r["checks"] else None) for _, rows in runs) + " |"
        )
    for lang in langs:
        lines.append(
            f"| lang {lang} | " + " | ".join(cell(rows, lambda r, lang=lang: r["pass"] if r["lang"] == lang else None) for _, rows in runs) + " |"
        )
    lat = []
    for _, rows in runs:
        v = [r["latency_s"] for r in rows if not r["error"]]
        lat.append(f"{sorted(v)[len(v) // 2]:.1f}s" if v else "–")
    lines.append("| median latency | " + " | ".join(lat) + " |")
    # Cases where runs disagree, for reading.
    by_case: dict[str, list[str]] = defaultdict(list)
    for _, rows in runs:
        res = defaultdict(list)
        for r in rows:
            res[r["case"]].append(r["pass"])
        for c, v in res.items():
            by_case[c].append(f"{sum(v)}/{len(v)}")
    diff = [c for c, v in sorted(by_case.items()) if len(set(v)) > 1]
    if diff:
        lines += ["", "Cases where the runs differ: " + ", ".join(diff)]
    return "\n".join(lines)


if __name__ == "__main__":
    print(table([Path(a) for a in sys.argv[1:]]))
