"""PM-509: the food regression grades the analyzer's items; these tests run without a provider."""

from steady_evals.food_regression import CASES, FoodCase, grade, run


class Q:
    def __init__(self, options):
        self.text, self.options = "?", options

    def model_dump(self):
        return {"text": self.text, "options": self.options}


class Item:
    def __init__(self, name, unit="cup", qty=1.25, gpu=244, c100=0.2, question=None):
        self.name, self.unit, self.qty, self.grams_per_unit, self.carbs_per_100g, self.question = name, unit, qty, gpu, c100, question


def case(cid: str) -> FoodCase:
    return next(c for c in CASES if c.id == cid)


def test_guys_tea_fails_and_plain_tea_passes():
    milk = Item("Milk in tea or coffee, no sugar", c100=4.9)
    bad = grade(case("refine-old-with-milk"), [milk])
    assert not bad["passed"] and bad["est_carbs_g"] == 14.9
    assert not bad["checks"]["in_band"] and not bad["checks"]["named_by_drink"]
    good = grade(case("refine-old-plain"), [Item("Tea")])
    assert good["passed"] and good["est_carbs_g"] == 0.6


def test_a_question_on_unseen_additions_must_offer_the_plain_drink():
    c = case("tea-unknown")
    assert not grade(c, [Item("Tea", question=Q(["A splash of milk", "Milk and sugar"]))])["passed"]
    assert grade(c, [Item("Tea", question=Q(["No milk, no sugar", "A splash of milk"]))])["passed"]
    # No question at all is fine when the drink is read as plain.
    assert grade(c, [Item("Tea")])["passed"]


def test_clear_noodles_must_ask_about_both_lookalikes():
    c = case("clear-noodles-unknown")
    noodles = dict(unit="bowl", qty=1, gpu=300, c100=20)
    assert not grade(c, [Item("Glass noodles with chicken", **noodles)])["passed"]
    asked = Q(["Glass noodles", "Shirataki (konjac) noodles"])
    assert grade(c, [Item("Clear noodles with chicken", question=asked, **noodles)])["passed"]


def test_a_food_without_carbs_or_no_food_fails():
    assert not grade(case("water"), [])["passed"]
    assert not grade(case("water"), [Item("Water", c100=None)])["passed"]


def test_a_provider_failure_fails_the_case():
    class Broken:
        def parse_text(self, text, language):
            raise RuntimeError("down")

    out = run(Broken(), [case("water")])
    assert not out["passed"] and out["failed"] == ["water"] and "error" in out["rows"][0]


def test_every_case_has_a_sensible_band():
    assert len({c.id for c in CASES}) == len(CASES)
    for c in CASES:
        assert 0 <= c.low_g <= c.high_g, c.id


def test_the_analyzer_loads_as_in_the_evals_image(tmp_path):
    # The first Fly run (25 Nov 2026) crashed: steady_api was imported before services/api was on the path. Run the
    # import in a fresh interpreter from evals/, with nothing else on the path, as the evals image does.
    import os
    import subprocess
    import sys
    from pathlib import Path

    code = "import os; os.environ['K'] = 'x'; from steady_evals.food_regression import analyzer; print(type(analyzer('K', 'm')[0]).__name__)"
    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
    out = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[1], env=env, capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert out.stdout.strip() == "OpenAIFoodAnalyzer"
