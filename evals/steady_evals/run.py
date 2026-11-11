"""
Run cases against a model and write results.

    uv run --project ../services/api python -m steady_evals.run --model gpt-5-mini --split heldout
    uv run --project ../services/api python -m steady_evals.run --model medgemma-27b --base-url http://localhost:11434/v1 \
        --tool-mode prompted --fold-system

Results go to reports/runs/<timestamp>-<label>/: results.jsonl (one line per case and repeat, with the full transcript)
and summary.md. A run with any provider error is still written, and errors count as failures, never as passes.
"""

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

from . import cases as cases_mod
from . import scope
from .checks import grade
from .harness import run_case
from .providers import OpenAICompatible

REPORTS = Path(__file__).resolve().parents[1] / "reports" / "runs"


def git_rev(path: Path) -> str:
    try:
        return subprocess.run(["git", "-C", str(path), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown"


def run(args: argparse.Namespace) -> Path:
    selected = cases_mod.load(split=args.split, langs=tuple(args.lang) if args.lang else None, ids=set(args.case) if args.case else None)
    if not selected:
        sys.exit("No cases selected.")
    provider = OpenAICompatible(
        model=args.model,
        base_url=args.base_url,
        api_key_env=args.api_key_env,
        tool_mode=args.tool_mode,
        fold_system_role=args.fold_system,
        temperature=args.temperature,
        label=args.label,
    )
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    out = REPORTS / f"{stamp}-{re.sub(r'[^A-Za-z0-9._-]+', '_', provider.label)}"
    out.mkdir(parents=True, exist_ok=True)
    jobs = [(c, r) for c in selected for r in range(args.repeat)]

    def one(job):
        case, rep = job
        res = run_case(case, provider)
        return case, rep, res, grade(case, res)

    rows = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        for case, rep, res, checks in pool.map(one, jobs):
            row = {
                "case": case.id,
                "repeat": rep,
                "lang": case.lang,
                "categories": case.categories,
                "split": case.split,
                "checks": checks,
                "pass": all(v["pass"] for v in checks.values()),
                "draft": res.draft,
                "shown": res.shown,
                "withheld": res.withheld,
                "error": res.error,
                "tool_calls": res.state.calls,
                "rounds": res.rounds,
                "latency_s": round(res.latency_s, 2),
                "usage": res.usage,
                "transcript": res.transcript,
                "review": case.review,
            }
            rows.append(row)
            mark = "PASS" if row["pass"] else "FAIL"
            print(f"{mark} {case.id}#{rep} " + ", ".join(k for k, v in checks.items() if not v["pass"]), flush=True)
    rows.sort(key=lambda r: (r["case"], r["repeat"]))
    with (out / "results.jsonl").open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False, default=str) + "\n")
    meta = {
        "model": args.model,
        "label": provider.label,
        "base_url_set": bool(args.base_url),
        "tool_mode": args.tool_mode,
        "fold_system": args.fold_system,
        "temperature": args.temperature,
        "split": args.split,
        "repeat": args.repeat,
        "cases": len(selected),
        "main_rev": git_rev(Path(__file__).resolve().parents[2]),
        "api_rev": git_rev(Path(__file__).resolve().parents[2] / "services" / "api"),
        "started": stamp,
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (out / "summary.md").write_text(summarize(rows, meta, selected), encoding="utf-8")
    print(f"\nWrote {out}")
    return out


def _pct(a: int, b: int) -> str:
    return f"{a}/{b} ({100 * a / b:.0f}%)" if b else "–"


def summarize(rows: list[dict], meta: dict, selected: list) -> str:
    lines = [f"# Run {meta['started']}: {meta['label']}", ""]
    lines.append(f"Model `{meta['model']}`, tools {meta['tool_mode']}, split {meta['split']}, {meta['cases']} cases x {meta['repeat']}.")
    lines.append(f"Production prompt and tools from services/api `{meta['api_rev']}`, main `{meta['main_rev']}`.")
    lines.append("")
    lines.append(f"**All checks passed:** {_pct(sum(r['pass'] for r in rows), len(rows))}  ")
    lines.append(f"**Withheld by the production dose filter:** {sum(r['withheld'] for r in rows)}  ")
    lines.append(f"**Provider errors:** {sum(bool(r['error']) for r in rows)}")
    lines.append("")
    by_check: dict[str, list[bool]] = defaultdict(list)
    by_lang: dict[str, list[bool]] = defaultdict(list)
    by_cat: dict[str, list[bool]] = defaultdict(list)
    for r in rows:
        for k, v in r["checks"].items():
            by_check[k].append(v["pass"])
        by_lang[r["lang"]].append(r["pass"])
        for c in r["categories"]:
            by_cat[c].append(r["pass"])
    lines += ["## By check", "", "| Check | Passed |", "|---|---|"]
    lines += [f"| {k} | {_pct(sum(v), len(v))} |" for k, v in by_check.items()]
    lines += ["", "## By language", "", "| Language | Cases passing every check |", "|---|---|"]
    lines += [f"| {k} | {_pct(sum(v), len(v))} |" for k, v in sorted(by_lang.items())]
    lines += ["", "## By category", "", "| Category | Cases passing every check |", "|---|---|"]
    lines += [f"| {k} | {_pct(sum(v), len(v))} |" for k, v in sorted(by_cat.items())]
    lines += ["", "## Scope classifier on these cases (model-independent)", ""]
    lines += scope_table(selected)
    fails = [r for r in rows if not r["pass"]]
    lines += ["", f"## Failures ({len(fails)})", ""]
    for r in fails:
        bad = "; ".join(f"{k}: {v['detail']}" for k, v in r["checks"].items() if not v["pass"])
        reply = (r["draft"] or "").replace("\n", " ")[:300]
        lines.append(f"- **{r['case']}#{r['repeat']}**: {bad}  \n  reply: {reply!r}")
    review = [r for r in rows if r["review"]]
    if review:
        lines += ["", "## For human review (not graded automatically)", ""]
        for r in review:
            lines.append(f"- **{r['case']}#{r['repeat']}** ({r['review']}): {(r['draft'] or '').replace(chr(10), ' ')[:300]!r}")
    return "\n".join(lines) + "\n"


def scope_table(selected: list) -> list[str]:
    tp: dict[str, int] = defaultdict(int)
    fp: dict[str, int] = defaultdict(int)
    fn: dict[str, int] = defaultdict(int)
    for c in selected:
        got = scope.flags(c.user)
        want = set(c.scope_flags)
        for f in scope.FLAGS:
            if f in got and f in want:
                tp[f] += 1
            elif f in got:
                fp[f] += 1
            elif f in want:
                fn[f] += 1
    out = ["| Flag | Caught | Missed | False alarms |", "|---|---|---|---|"]
    out += [f"| {f} | {tp[f]} | {fn[f]} | {fp[f]} |" for f in scope.FLAGS]
    return out


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--model", required=True)
    p.add_argument("--base-url", help="OpenAI-compatible endpoint (Ollama, vLLM, ...). Omit for OpenAI.")
    p.add_argument("--api-key-env", default="OPENAI_API_KEY", help="Environment variable holding the key")
    p.add_argument("--tool-mode", choices=["native", "prompted"], default="native")
    p.add_argument("--fold-system", action="store_true", help="Merge the system prompt into the first user turn (Gemma templates)")
    p.add_argument("--temperature", type=float)
    p.add_argument("--split", choices=["dev", "heldout"], default="heldout")
    p.add_argument("--lang", action="append", choices=cases_mod.LANGS)
    p.add_argument("--case", action="append")
    p.add_argument("--repeat", type=int, default=1)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--label")
    run(p.parse_args())


if __name__ == "__main__":
    main()
