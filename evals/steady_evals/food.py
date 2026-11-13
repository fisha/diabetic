"""
Meal-photo carbohydrate evaluation (brief section 7): grams of carbohydrate error against weighed reference meals,
before and after portion correction. Food-name recognition alone is not measured as success.

Providers:
- `openai-vision`: the production adapter, imported read-only from services/api (`OpenAIFoodAnalyzer`).
- `logmeal`, `passio`: candidates named in the brief. Not implemented: their current APIs, plans and portion
  capabilities must be read from their documentation and tried with a trial key first (brief: "verify current API
  access, plans, endpoint costs and portion-estimation capabilities before committing"). Selecting them raises
  `NotConfigured` rather than producing a result.

Dataset: `food/meals.jsonl` (one weighed meal per line) with photos in `food/photos/`, both kept out of git (see
food/README.md). Carbohydrate per item comes from a label or a named database entry, never from a model.
"""

import json
import statistics
import time
from dataclasses import dataclass, field
from pathlib import Path

FOOD_DIR = Path(__file__).resolve().parents[1] / "food"


class NotConfigured(Exception):
    pass


@dataclass
class RefItem:
    name: str
    grams: float
    carbs_g: float
    carb_source: str  # "label", "usda:<fdc id>", "recipe", ...


@dataclass
class Meal:
    id: str
    photo: str
    items: list[RefItem]
    language: str = "en"
    tags: list[str] = field(default_factory=list)  # e.g. local, mixed, restaurant, home
    notes: str = ""

    @property
    def carbs_g(self) -> float:
        return sum(i.carbs_g for i in self.items)


def load_meals(path: Path | None = None) -> list[Meal]:
    path = path or FOOD_DIR / "meals.jsonl"
    meals = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        d = json.loads(line)
        items = [RefItem(**i) for i in d["items"]]
        if not items or any(i.grams <= 0 or i.carbs_g < 0 or not i.carb_source for i in items):
            raise ValueError(f"{path.name}:{n}: every item needs grams > 0, carbs_g >= 0 and a carb_source")
        meals.append(
            Meal(id=d["id"], photo=d["photo"], items=items, language=d.get("language", "en"), tags=d.get("tags", []), notes=d.get("notes", ""))
        )
    return meals


def item_carbs(unit: str, qty: float, grams_per_unit: float | None, carbs_per_100g: float | None) -> float | None:
    """Same arithmetic as the app (`apps/mobile/src/features/meal/model.ts` fromFoodItem)."""
    if carbs_per_100g is None:
        return None
    if unit == "g":
        return qty * carbs_per_100g / 100
    if grams_per_unit is None:
        return None
    return qty * grams_per_unit * carbs_per_100g / 100


def item_grams(unit: str, qty: float, grams_per_unit: float | None) -> float | None:
    return qty if unit == "g" else (qty * grams_per_unit if grams_per_unit else None)


def analyzer(name: str):
    if name == "openai-vision":
        import os

        from steady_api.ai.food import OpenAIFoodAnalyzer

        from .production import API  # noqa: F401  (puts services/api on the path)

        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise NotConfigured("Set OPENAI_API_KEY in the environment.")
        model = os.environ.get("STEADY_FOOD_MODEL", "gpt-5-mini")  # production uses openai_model (default gpt-5-mini)
        return OpenAIFoodAnalyzer(key, model, 120)
    if name in ("logmeal", "passio"):
        raise NotConfigured(f"{name}: adapter not written until its API documentation and a trial key are checked.")
    raise NotConfigured(f"unknown provider {name}")


def evaluate(meal: Meal, items: list, mapping: dict[int, int] | None = None) -> dict:
    """Errors for one meal. `items` are the provider's FoodItem objects. `mapping` (provider item index -> reference
    item index), written by a person, enables the after-portion-correction figure: each mapped item keeps the
    provider's carbs per 100 g but takes the weighed grams, as if the person had corrected the portion."""
    est = [item_carbs(i.unit, i.qty, i.grams_per_unit, i.carbs_per_100g) for i in items]
    unknown = sum(e is None for e in est)
    total = sum(e for e in est if e is not None)
    out = {
        "meal": meal.id,
        "ref_carbs_g": round(meal.carbs_g, 1),
        "est_carbs_g": round(total, 1),
        "error_g": round(total - meal.carbs_g, 1),
        "items_returned": len(items),
        "items_without_carbs": unknown,
        "tags": meal.tags,
    }
    if mapping is not None:
        corrected = 0.0
        for idx, i in enumerate(items):
            ref = mapping.get(idx)
            if ref is None or i.carbs_per_100g is None:
                e = est[idx]
                corrected += e or 0.0
            else:
                corrected += meal.items[ref].grams * i.carbs_per_100g / 100
        out["corrected_carbs_g"] = round(corrected, 1)
        out["corrected_error_g"] = round(corrected - meal.carbs_g, 1)
        mapped = set(mapping.values())
        out["reference_items_missed"] = [meal.items[k].name for k in range(len(meal.items)) if k not in mapped]
    return out


def summarize(rows: list[dict]) -> dict:
    ok = [r for r in rows if "error_g" in r]

    def stats(key: str) -> dict:
        errs = [r[key] for r in ok if key in r]
        if not errs:
            return {}
        absol = [abs(e) for e in errs]
        rel = [abs(r[key]) / r["ref_carbs_g"] for r in ok if key in r and r["ref_carbs_g"] > 0]
        return {
            "n": len(errs),
            "mean_abs_error_g": round(statistics.mean(absol), 1),
            "median_abs_error_g": round(statistics.median(absol), 1),
            "mean_signed_error_g": round(statistics.mean(errs), 1),
            "within_10g": f"{sum(a <= 10 for a in absol)}/{len(absol)}",
            "within_20pct": f"{sum(x <= 0.2 for x in rel)}/{len(rel)}",
        }

    return {
        "meals": len(rows),
        "failures": len(rows) - len(ok),
        "before_correction": stats("error_g"),
        "after_portion_correction": stats("corrected_error_g"),
    }


def run(provider: str, out_dir: Path, mapping_path: Path | None = None) -> dict:
    meals = load_meals()
    an = analyzer(provider)
    mappings = json.loads(mapping_path.read_text(encoding="utf-8")) if mapping_path else {}
    rows = []
    for m in meals:
        photo = FOOD_DIR / "photos" / m.photo
        ctype = "image/png" if photo.suffix.lower() == ".png" else "image/jpeg"
        t0 = time.monotonic()
        try:
            items = an.analyze_photo(photo.read_bytes(), ctype, m.language)
        except Exception as exc:  # a provider failure is a failed meal, never a guessed one
            rows.append({"meal": m.id, "error": f"{type(exc).__name__}: {str(exc)[:200]}"})
            continue
        mp = {int(k): v for k, v in mappings.get(m.id, {}).items()} if m.id in mappings else None
        row = evaluate(m, items, mp)
        row["latency_s"] = round(time.monotonic() - t0, 1)
        row["provider_items"] = [i.model_dump() for i in items]
        rows.append(row)
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "food_results.jsonl").open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    summary = summarize(rows)
    (out_dir / "food_summary.json").write_text(json.dumps({"provider": provider, **summary}, indent=2), encoding="utf-8")
    return summary


if __name__ == "__main__":
    import argparse
    from datetime import UTC, datetime

    p = argparse.ArgumentParser(description="Meal-photo carbohydrate evaluation on weighed meals")
    p.add_argument("--provider", default="openai-vision", choices=["openai-vision", "logmeal", "passio"])
    p.add_argument("--mapping", type=Path, help="JSON {meal_id: {provider_item_index: reference_item_index}} written by a person")
    a = p.parse_args()
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    print(json.dumps(run(a.provider, Path(__file__).resolve().parents[1] / "reports" / "food" / f"{stamp}-{a.provider}", a.mapping), indent=2))
