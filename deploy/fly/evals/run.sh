#!/usr/bin/env bash
# Inside the evals Machine (PM-203): run the regression set against the production model and print the verdict
# between markers, so `stedio-fly evals` can read it from the Machine's log. No secret is printed: the key stays in
# the environment variable that the provider reads by name.
set -uo pipefail
MODEL="${EVAL_MODEL:-${STEADY_OPENAI_MODEL:-gpt-6.1-sol}}"
JUDGE="${EVAL_JUDGE:-$MODEL}"
REPEAT="${EVAL_REPEAT:-3}"
LABEL="${EVAL_LABEL:-fly}"
if [ -z "${STEADY_OPENAI_API_KEY:-}" ]; then
  echo "EVALS_ERROR no OpenAI key on this app (STEADY_OPENAI_API_KEY)"; echo "EVALS_EXIT=2"; exit 2
fi
echo "EVALS_START model=$MODEL judge=$JUDGE repeat=$REPEAT label=$LABEL"
out="$(python -m steady_evals.regression --model "$MODEL" --production --repeat "$REPEAT" --judge "$JUDGE" \
  --label "$LABEL" --api-key-env STEADY_OPENAI_API_KEY 2>/tmp/evals.err)"
code=$?
# The verdict only (pass rates, case ids, failed rule names); replies and transcripts stay in the Machine.
# One line: a multi-line block can lose or reorder lines in the log stream.
verdict="$(printf '%s\n' "$out" | sed -n '/^{/,$p' | python -c 'import json,sys; print(json.dumps(json.load(sys.stdin), ensure_ascii=False))' 2>/dev/null)"
echo "EVALS_VERDICT ${verdict:-{\"passed\": false, \"ran\": false, \"errors\": [\"no verdict\"]}}"
# The failing turns of these synthetic cases (no user data): what the model drafted, what would be shown, which checks
# and judge criteria failed and why, so a failure can be told apart from a false positive (PM-204).
echo "EVALS_FAILURES_BEGIN"
python - <<'PY'
import json, pathlib
runs = sorted(pathlib.Path("reports/runs").glob("*"), key=lambda p: p.stat().st_mtime)
rows = [json.loads(x) for x in (runs[-1] / "results.jsonl").read_text(encoding="utf-8").splitlines() if x] if runs else []
out = []
for r in rows:
    j = r.get("judge") or {}
    jf = {k: (j.get("reasons") or {}).get(k, "") for k, v in (j.get("verdicts") or {}).items() if v == "fail"}
    cf = {k: v["detail"] for k, v in r["checks"].items() if not v["pass"]}
    if cf or jf or "error" in j:
        out.append({"case": r["case"], "repeat": r["repeat"], "checks": cf, "judge": jf, "judge_error": j.get("error"),
                    "second_look": r.get("second_look"), "withheld": r.get("withheld"),
                    "tools": [{"name": c.get("name"), "status": (c.get("result") or {}).get("status") if isinstance(c.get("result"), dict) else None}
                              for c in r.get("tool_calls") or []],
                    "first_draft": (r.get("first_draft") or "")[:600] or None, "draft": (r.get("draft") or "")[:600]})
for o in out:
    print(json.dumps(o, ensure_ascii=False))
PY
echo "EVALS_FAILURES_END"
[ "$code" -gt 1 ] && tail -n 20 /tmp/evals.err | sed 's/^/EVALS_STDERR /'
echo "EVALS_EXIT=$code"
exit "$code"
