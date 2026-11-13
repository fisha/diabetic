import pytest

from steady_evals.food import Meal, NotConfigured, RefItem, analyzer, evaluate, item_carbs, summarize


class Item:
    def __init__(self, unit, qty, gpu, c100):
        self.unit, self.qty, self.grams_per_unit, self.carbs_per_100g = unit, qty, gpu, c100


def test_item_carbs_matches_the_app():
    assert item_carbs("g", 150, None, 28) == pytest.approx(42)
    assert item_carbs("piece", 2, 60, 50) == pytest.approx(60)
    assert item_carbs("piece", 2, None, 50) is None
    assert item_carbs("cup", 1, 200, None) is None


def test_evaluate_before_and_after_portion_correction():
    meal = Meal("m1", "m1.jpg", [RefItem("rice", 180, 50.4, "label"), RefItem("salad", 100, 4, "recipe")])
    items = [Item("cup", 1, 150, 28), Item("bowl", 1, None, 5)]
    r = evaluate(meal, items, {0: 0})
    assert r["est_carbs_g"] == 42.0 and r["error_g"] == -12.4 and r["items_without_carbs"] == 1
    assert r["corrected_carbs_g"] == 50.4 and r["reference_items_missed"] == ["salad"]
    s = summarize([r, {"meal": "m2", "error": "ProviderFailed"}])
    assert s["failures"] == 1 and s["before_correction"]["n"] == 1


def test_vendor_candidates_are_not_faked():
    for name in ("logmeal", "passio"):
        with pytest.raises(NotConfigured):
            analyzer(name)
