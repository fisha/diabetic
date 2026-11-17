"""
The language-model judge on evaluation turns (PM-198). Same rubric and hard rules as the production quality review
(services/api steady_api/ai/judge.py); here it reads synthetic cases only.
"""

import os

from .cases import Case
from .harness import TurnResult
from .production import prod_judge


class JudgeUnavailable(Exception):
    pass


def provider(model: str, api_key_env: str = "OPENAI_API_KEY", effort: str = "low"):
    """The production OpenAI adapter, used for the judge (structured output)."""
    from steady_api.ai.provider import OpenAIProvider

    key = os.environ.get(api_key_env)
    if not key:
        raise JudgeUnavailable(f"Set {api_key_env} in the environment to run the judge (never in a file here).")
    return OpenAIProvider(key, model, 120, effort)


def turns(case: Case, res: TurnResult) -> list[dict]:
    hist = [{"role": h["role"], "content": h.get("content") or ""} for h in case.history if h.get("role") in ("user", "assistant")]
    return [*hist, {"role": "user", "content": case.user}, {"role": "assistant", "content": res.draft or ""}]


def judge_turn(judge_provider, case: Case, res: TurnResult) -> dict:
    """{"verdicts", "reasons", "hard", "passed"} or {"error"}; a judge that cannot answer is an error, never a pass."""
    from steady_api.ai.provider import ProviderFailed

    if not res.draft:
        return {"error": "no reply to judge"}
    try:
        r = prod_judge.judge(judge_provider, turns(case, res), context=res.system_prompt or None, tools=list(res.state.calls))
    except ProviderFailed as exc:
        return {"error": f"judge failed: {exc}"}
    return {"verdicts": r.verdicts, "reasons": r.reasons, "hard": r.hard, "passed": r.passed, "rubric": r.rubric_version}
