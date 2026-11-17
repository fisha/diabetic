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
echo "EVALS_VERDICT_BEGIN"; printf '%s\n' "$out" | sed -n '/^{/,$p'; echo "EVALS_VERDICT_END"
[ "$code" -gt 1 ] && tail -n 20 /tmp/evals.err | sed 's/^/EVALS_STDERR /'
echo "EVALS_EXIT=$code"
exit "$code"
