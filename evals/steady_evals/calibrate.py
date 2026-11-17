"""
Calibrating the judge against people (PM-198). The judge's numbers are trusted only as far as it agrees with Guy, Itay
and, later, a clinician on the same replies.

1. Export a labelling sheet from a run that used --judge (synthetic cases only; never production conversations):
       python -m steady_evals.calibrate export reports/runs/<run> labels/<name>.csv
   One row per reply and criterion: the case, the person's message, the reply, the criterion's text, and an empty
   `human` column. The judge's own verdict is in a separate file so labellers are not anchored by it.
2. People fill `human` with pass, fail or na (and optionally `labeller`).
3. Agreement per criterion:
       python -m steady_evals.calibrate agree labels/<name>.csv
   Raw agreement and Cohen's kappa between the judge and each labeller, and between labellers when two labelled the
   same rows. A criterion whose kappa is under KAPPA_OK is not yet trustworthy; the summary says so.
"""

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

from .production import prod_judge

VERDICTS = ("pass", "fail", "na")
KAPPA_OK = 0.6


def export(run_dir: Path, out: Path) -> int:
    rows = [json.loads(x) for x in (run_dir / "results.jsonl").read_text(encoding="utf-8").splitlines() if x]
    out.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    hidden = []
    with out.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["item", "case", "repeat", "criterion", "criterion_text", "message", "reply", "human", "labeller"])
        for r in rows:
            j = r.get("judge") or {}
            if "verdicts" not in j:
                continue
            message = next((t.get("content") for t in reversed(r.get("transcript") or []) if t.get("role") == "user"), "")
            for crit, text in prod_judge.CRITERIA.items():
                item = f"{r['case']}#{r['repeat']}:{crit}"
                w.writerow([item, r["case"], r["repeat"], crit, text, message, r.get("draft") or "", "", ""])
                hidden.append({"item": item, "judge": j["verdicts"][crit]})
                n += 1
    out.with_suffix(".judge.json").write_text(json.dumps(hidden, indent=1), encoding="utf-8")
    return n


def kappa(a: list[str], b: list[str]) -> float | None:
    """Cohen's kappa for two raters on the same items (None when undefined)."""
    if not a or len(a) != len(b):
        return None
    n = len(a)
    po = sum(x == y for x, y in zip(a, b, strict=True)) / n
    pe = sum((a.count(v) / n) * (b.count(v) / n) for v in VERDICTS)
    if pe >= 1:
        return None
    return (po - pe) / (1 - pe)


def agree(labels: Path) -> dict:
    judge = {x["item"]: x["judge"] for x in json.loads(labels.with_suffix(".judge.json").read_text(encoding="utf-8"))}
    by_crit: dict[str, dict[str, dict[str, str]]] = defaultdict(lambda: defaultdict(dict))  # crit -> labeller -> item -> verdict
    with labels.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            h = (row.get("human") or "").strip().lower()
            if h not in VERDICTS:
                continue
            by_crit[row["criterion"]][(row.get("labeller") or "person").strip() or "person"][row["item"]] = h
    out: dict = {"kappa_ok": KAPPA_OK, "criteria": {}}
    for crit, people in by_crit.items():
        res: dict = {}
        for who, items in people.items():
            ks = [k for k in items if k in judge]
            a, b = [judge[k] for k in ks], [items[k] for k in ks]
            kp = kappa(a, b)
            res[f"judge_vs_{who}"] = {
                "items": len(ks),
                "agreement": round(sum(x == y for x, y in zip(a, b, strict=True)) / len(ks), 3) if ks else None,
                "kappa": round(kp, 3) if kp is not None else None,
            }
        names = sorted(people)
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                ks = sorted(set(people[names[i]]) & set(people[names[j]]))
                kp = kappa([people[names[i]][k] for k in ks], [people[names[j]][k] for k in ks])
                res[f"{names[i]}_vs_{names[j]}"] = {"items": len(ks), "kappa": round(kp, 3) if kp is not None else None}
        judge_ks = [v["kappa"] for k, v in res.items() if k.startswith("judge_vs_") and v["kappa"] is not None]
        res["trusted"] = bool(judge_ks) and min(judge_ks) >= KAPPA_OK
        out["criteria"][crit] = res
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("export")
    e.add_argument("run_dir", type=Path)
    e.add_argument("out", type=Path)
    g = sub.add_parser("agree")
    g.add_argument("labels", type=Path)
    a = p.parse_args()
    if a.cmd == "export":
        n = export(a.run_dir, a.out)
        if not n:
            sys.exit("No judged replies in that run (run it with --judge).")
        print(f"Wrote {n} rows to {a.out}")
    else:
        print(json.dumps(agree(a.labels), indent=2))


if __name__ == "__main__":
    main()
