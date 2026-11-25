#!/usr/bin/env bash
# Inside the evals Machine (PM-203): run the regression set against the production model and print the verdict
# between markers, so `stedio-fly evals` can read it from the Machine's log. No secret is printed: the key stays in
# the environment variable that the provider reads by name.
set -uo pipefail
MODEL="${EVAL_MODEL:-${STEADY_OPENAI_MODEL:-gpt-6.1-sol}}"
JUDGE="${EVAL_JUDGE:-$MODEL}"
REPEAT="${EVAL_REPEAT:-3}"
LABEL="${EVAL_LABEL:-fly}"
QUICK=()
[ "${EVAL_QUICK:-}" = "1" ] && QUICK=(--quick)
if [ -z "${STEADY_OPENAI_API_KEY:-}" ]; then
  echo "EVALS_ERROR no OpenAI key on this app (STEADY_OPENAI_API_KEY)"; echo "EVALS_EXIT=2"; exit 2
fi
# The meal analyzer's food regression (PM-509): text cases through the production adapter and its model. One line of
# verdict (case ids, checks and the analyzer's items for these synthetic cases), no transcripts.
if [ "${EVAL_SUITE:-}" = "food" ]; then
  echo "EVALS_START suite=food label=$LABEL"
  out="$(python -m steady_evals.food_regression --api-key-env STEADY_OPENAI_API_KEY ${EVAL_MODEL:+--model "$EVAL_MODEL"} 2>/tmp/evals.err)"
  code=$?
  # A short verdict on one line (a long line can be cut in the log stream); each failing case with its items below.
  verdict="$(printf '%s\n' "$out" | python -c '
import json, sys
d = json.load(sys.stdin)
rows = [{"case": r["case"], "est": r.get("est_carbs_g"), "band": r.get("band_g"), "failed": [k for k, v in (r.get("checks") or {}).items() if not v] or r.get("error")} for r in d["rows"]]
print(json.dumps({"suite": d["suite"], "model": d.get("model"), "passed": d["passed"], "failed": d["failed"], "rows": rows}, ensure_ascii=False))' 2>/dev/null)"
  [ -n "$verdict" ] || verdict='{"passed": false, "ran": false, "errors": ["no verdict"]}'
  echo "EVALS_VERDICT $verdict"
  echo "EVALS_FAILURES_BEGIN"
  printf '%s\n' "$out" | python -c '
import json, sys
for r in json.load(sys.stdin)["rows"]:
    if not r["passed"]:
        print(json.dumps(r, ensure_ascii=False))' 2>/dev/null
  echo "EVALS_FAILURES_END"
  # Any failure shows its stderr: a crash before the verdict exits 1 too, like a failed case (PM-509, first Fly run).
  [ "$code" -ne 0 ] && tail -n 20 /tmp/evals.err | sed 's/^/EVALS_STDERR /'
  echo "EVALS_EXIT=$code"
  exit "$code"
fi
echo "EVALS_START model=$MODEL judge=$JUDGE repeat=$REPEAT quick=${EVAL_QUICK:-0} label=$LABEL"
out="$(python -m steady_evals.regression --model "$MODEL" --production --repeat "$REPEAT" --judge "$JUDGE" \
  --label "$LABEL" --api-key-env STEADY_OPENAI_API_KEY ${QUICK[@]+"${QUICK[@]}"} 2>/tmp/evals.err)"
code=$?
# The verdict only (pass rates, case ids, failed rule names); replies and transcripts stay in the Machine.
# One line: a multi-line block can lose or reorder lines in the log stream.
verdict="$(printf '%s\n' "$out" | sed -n '/^{/,$p' | python -c 'import json,sys; print(json.dumps(json.load(sys.stdin), ensure_ascii=False))' 2>/dev/null)"
[ -n "$verdict" ] || verdict='{"passed": false, "ran": false, "errors": ["no verdict"]}'
echo "EVALS_VERDICT $verdict"
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
