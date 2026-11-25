"""
Food regression for the meal analyzer (PM-509, Guy 25 Nov 2026): a mug of plain tea came back as "Milk in tea or
coffee, no sugar", 1¼ cup of milk, 15 g carbs, and the answer to the clarifying question did not change it; a bowl of
clear noodles came back as glass noodles, about 63 g, where Guy counted 8 g (shirataki and glass noodles look alike).

Text cases through the production adapter (`OpenAIFoodAnalyzer.parse_text`, the same instructions as a photo), so they
need no personal photos: a described drink, and the re-estimate the app sends after the person answers a question, in
the old app wording and the new one (`refineText` in apps/mobile). Each case gives a band for the whole served carbs,
from reference values, never from a model:

- Brewed black tea 0.3 g / 100 g, brewed coffee 0 g / 100 g, tap water 0 g (USDA FoodData Central SR Legacy: "tea,
  black, brewed", "coffee, brewed", "water, tap").
- Reduced-fat (2%) milk 4.8 g / 100 g (USDA SR Legacy "milk, reduced fat, 2%"). A splash in a mug is about 30-50 ml, so 1.4-2.4 g.
- Shirataki / konjac noodles: about 3 g total carbohydrate per 100 g, nearly all fiber (konjac glucomannan), so about
  0-1 g net per 100 g. Glass (mung bean) noodles: 86 g / 100 g dry (USDA SR Legacy "noodles, chinese, cellophane"); cooked they take up about
  three times their weight in water, so about 25-30 g / 100 g as served.

The bands are wide on purpose (a mug is 200-350 g): they catch the failure Guy saw (milk sized as the whole mug,
12-15 g), not a gram either way. Checks: the band, no item named after an addition alone, when a tea or coffee
case asks a question a plain option among its choices, and for clear noodles of unknown kind a question that offers
both look-alikes (English cases only; the Hebrew cases check the band). A look-alike case has no band: its carbs are
open until the question is answered. Text cases test the rules, not the eye: how well sizes are read from pixels is
measured by the weighed photo set (`steady_evals.food`, food/README.md).

Run (costs a few cents; one call per case):

    uv run --project ../services/api python -m steady_evals.food_regression   # OPENAI_API_KEY in the environment
    stedio-fly evals --food                                                    # on Fly, with the production key and model
"""

import json
import os
import re
import sys
import time
from dataclasses import dataclass, field

from .food import item_carbs


@dataclass
class FoodCase:
    id: str
    text: str
    low_g: float
    high_g: float
    language: str = "English"
    # A question on this case must offer the plain drink (no milk, no sugar) among its options.
    plain_option: bool = False
    # The case must ask a question whose options name both look-alikes (pattern per option); no band then.
    lookalikes: tuple[str, str] | None = None
    notes: str = ""
    tags: list[str] = field(default_factory=list)


# The old app wording of a re-estimate: "name (qty unit). question answer" (apps/mobile services.refine before PM-509).
_OLD = "Milk in tea or coffee, no sugar (1.25 cup). What is in the mug? "
# The new wording (`refineText`).
_NEW = "Milk in tea or coffee, no sugar, 1.25 cup in total. Question: What is in the mug? The person's answer: "

CASES: list[FoodCase] = [
    FoodCase("plain-tea", "A mug of tea, no milk, no sugar", 0, 1.5, tags=["plain"]),
    FoodCase("tea-unknown", "A mug of tea", 0, 3, plain_option=True, notes="additions unseen: read as plain or ask", tags=["plain"]),
    FoodCase("black-coffee", "A cup of black coffee", 0, 1.5, tags=["plain"]),
    FoodCase("espresso", "An espresso", 0, 1, tags=["plain"]),
    FoodCase("water", "A glass of water", 0, 0.5, tags=["plain"]),
    FoodCase("herbal-tea", "A mug of mint tea", 0, 1.5, tags=["plain"]),
    FoodCase("tea-splash-milk", "A mug of tea with a splash of milk, no sugar", 0.5, 4, tags=["milk"]),
    FoodCase("coffee-splash-milk", "A mug of coffee with a little milk, no sugar", 0.5, 4, tags=["milk"]),
    FoodCase("refine-old-with-milk", _OLD + "Tea or coffee with milk, no sugar", 0.5, 4, notes="Guy's screenshot, old app", tags=["refine"]),
    FoodCase("refine-old-plain", _OLD + "Plain tea, no milk, no sugar", 0, 1.5, tags=["refine"]),
    FoodCase("refine-new-with-milk", _NEW + '"Tea or coffee with milk, no sugar"', 0.5, 4, tags=["refine"]),
    FoodCase("refine-new-plain", _NEW + '"Plain tea, no milk, no sugar"', 0, 1.5, tags=["refine"]),
    FoodCase("he-plain-tea", "כוס תה בלי חלב ובלי סוכר", 0, 1.5, language="Hebrew", tags=["plain", "he"]),
    FoodCase("he-tea-milk", "ספל תה עם קצת חלב, בלי סוכר", 0.5, 4, language="Hebrew", tags=["milk", "he"]),
    # Milky drinks stay milky: the rule is about a splash, not about hiding real milk.
    FoodCase("glass-of-milk", "A glass of 2% milk", 9, 16, tags=["control"]),
    FoodCase("latte", "A medium latte, no sugar", 8, 22, tags=["control"]),
    # Look-alikes (Guy's noodle bowl).
    FoodCase(
        "clear-noodles-unknown",
        "A bowl of clear, thin, translucent noodles with chicken, broccoli, baby corn and mushrooms in a creamy sauce",
        0,
        1000,
        lookalikes=(r"glass|cellophane|mung|rice noodle|vermicelli", r"shirataki|konjac"),
        tags=["lookalike"],
    ),
    FoodCase("shirataki-bowl", "A bowl of shirataki noodles with chicken and broccoli in a creamy sauce", 0, 10, tags=["lookalike"]),
    FoodCase("glass-noodles-200g", "200 g of cooked glass noodles, plain", 40, 65, tags=["lookalike", "as-served"]),
    # Portion from objects in frame (Guy's cake: a few pieces on a side plate). Walnut loaf cake about 45-55 g / 100 g
    # (USDA SR Legacy "cake, pound", the nearest loaf cake); four 3-4 cm pieces about 60-110 g in all.
    FoodCase(
        "cake-pieces-side-plate",
        "Four small pieces of walnut loaf cake, each about 3-4 cm across, on a side plate next to a computer keyboard",
        20,
        60,
        tags=["portion"],
    ),
    FoodCase("he-shirataki", "קערה של אטריות שיראטאקי עם עוף וברוקולי", 0, 10, language="Hebrew", tags=["lookalike", "he"]),
]

_ADDITION_ONLY = re.compile(r"^\s*(milk|sugar|cream|creamer|חלב|סוכר)\b", re.I)
_PLAIN = re.compile(r"\b(no milk|without milk|plain|black|nothing added)\b", re.I)


def grade(case: FoodCase, items: list) -> dict:
    """Checks one case against the analyzer's FoodItem objects. A food without carbs counts as a failure."""
    est = [item_carbs(i.unit, i.qty, i.grams_per_unit, i.carbs_per_100g) for i in items]
    total = round(sum(e for e in est if e is not None), 1)
    checks = {
        "returned": bool(items),
        "carbs_known": bool(items) and all(e is not None for e in est),
        "in_band": bool(items) and case.low_g <= total <= case.high_g,
        "named_by_drink": all(not _ADDITION_ONLY.match(i.name) for i in items) or case.id in ("glass-of-milk",),
    }
    if case.plain_option:
        asked = [i.question for i in items if i.question is not None]
        checks["plain_option"] = all(any(_PLAIN.search(o) for o in q.options) for q in asked)
    if case.lookalikes:
        asked = [i.question for i in items if i.question is not None]
        checks["asks_lookalike"] = any(all(any(re.search(p, o, re.I) for o in q.options) for p in case.lookalikes) for q in asked)
    return {
        "case": case.id,
        "est_carbs_g": total,
        "band_g": [case.low_g, case.high_g],
        "passed": all(checks.values()),
        "checks": checks,
        "items": [
            {
                "name": i.name,
                "unit": i.unit,
                "qty": i.qty,
                "grams_per_unit": i.grams_per_unit,
                "carbs_per_100g": i.carbs_per_100g,
                "question": i.question.model_dump() if i.question else None,
            }
            for i in items
        ],
    }


def analyzer(api_key_env: str, model: str | None):
    from steady_api.ai.food import OpenAIFoodAnalyzer

    from .production import API  # noqa: F401  (puts services/api on the path)

    key = os.environ.get(api_key_env)
    if not key:
        raise SystemExit(f"Set {api_key_env} in the environment.")
    # The production choice: the vision model when set, else the main model (config.openai_vision_model / openai_model).
    model = model or os.environ.get("STEADY_OPENAI_VISION_MODEL") or os.environ.get("STEADY_OPENAI_MODEL") or "gpt-6.1-sol"
    effort = os.environ.get("STEADY_OPENAI_REASONING_EFFORT", "low")
    return OpenAIFoodAnalyzer(key, model, 120, effort), model


def run(an, cases: list[FoodCase] | None = None) -> dict:
    rows = []
    for c in cases or CASES:
        t0 = time.monotonic()
        try:
            items = an.parse_text(c.text, c.language)
        except Exception as exc:  # a provider failure fails the case, never a guessed answer
            rows.append({"case": c.id, "passed": False, "error": f"{type(exc).__name__}: {str(exc)[:200]}"})
            continue
        row = grade(c, items)
        row["latency_s"] = round(time.monotonic() - t0, 1)
        rows.append(row)
    failed = [r["case"] for r in rows if not r["passed"]]
    return {"suite": "food", "cases": len(rows), "passed": not failed, "failed": failed, "rows": rows}


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="Food regression for the meal analyzer (PM-509)")
    p.add_argument("--model", help="defaults to the production vision model")
    p.add_argument("--api-key-env", default="OPENAI_API_KEY")
    a = p.parse_args()
    an, model = analyzer(a.api_key_env, a.model)
    out = run(an)
    out["model"] = model
    print(json.dumps(out, ensure_ascii=False, indent=2))
    sys.exit(0 if out["passed"] else 1)
