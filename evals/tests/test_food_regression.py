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


def test_guys_rice_plate_fails_at_67_and_passes_at_his_count():
    """PM-564: the 67 g reading (a full cup of rice, breading at fried-food density) fails; Guy's 25 g passes."""
    c = case("rice-breaded-stars-salad")
    read = [
        Item("Cooked white rice", "cup", 1, 160, 28),
        Item("Breaded chicken cutlets", "piece", 2, 40, 20),
        Item("Lettuce, cucumber and tomato salad", "bowl", 1, 200, 3),
        Item("Water", "cup", 1, 250, 0),
    ]
    bad = grade(c, read)
    assert not bad["passed"] and bad["est_carbs_g"] == 66.8
    counted = [
        Item("Cooked white rice", "g", 60, None, 28),
        Item("Breaded chicken cutlets", "piece", 2, 25, 12),
        Item("Lettuce, cucumber and tomato salad", "bowl", 1, 150, 2),
        Item("Water", "cup", 1, 250, 0),
    ]
    assert grade(c, counted)["passed"]


def test_photo_cases_are_read_from_the_folder_kept_out_of_git(tmp_path, monkeypatch):
    import json

    from steady_evals import food_regression as fr

    monkeypatch.setattr(fr, "PHOTO_DIR", str(tmp_path))
    assert fr.photo_cases() == []
    (tmp_path / "plate.jpg").write_bytes(b"\xff\xd8\xff")
    lines = [{"id": "p1", "photo": "plate.jpg", "low_g": 18, "high_g": 45}, {"id": "p2", "photo": "missing.jpg", "low_g": 1, "high_g": 2}]
    (tmp_path / "cases.jsonl").write_text("\n".join(json.dumps(x) for x in lines), encoding="utf-8")
    [(c, path)] = fr.photo_cases()
    assert c.id == "p1" and c.low_g == 18 and path.endswith("plate.jpg")

    class Seen:
        def __init__(self):
            self.photos = 0

        def parse_text(self, text, language):
            return [Item("Water", "cup", 1, 250, 0)]

        def analyze_photo(self, image, content_type, language):
            self.photos += 1
            return [Item("Cooked white rice", "g", 80, None, 28)]

    an = Seen()
    out = run(an)
    assert an.photos == 1 and next(r for r in out["rows"] if r["case"] == "p1")["passed"]


def test_a_photo_out_of_band_passes_only_when_an_amount_answer_fixes_it():
    from steady_evals.food_regression import _fixable_by_answer

    c = FoodCase("photo", "", 18, 45)
    rice = Item("Cooked white rice", "g", 160, None, 28, question=Q(["About 80 g", "About 160 g", "About 240 g"]))
    stars = Item("Breaded chicken", "piece", 2, 30, 15)
    row = grade(c, [rice, stars])
    assert not row["passed"] and row["est_carbs_g"] == 53.8
    _fixable_by_answer(c, [rice, stars], row)
    assert row["passed"] and row["est_after_amount_answer_g"] == 31.4 and row["in_band_as_read"] is False
    unasked = Item("Cooked white rice", "g", 160, None, 28)
    row = grade(c, [unasked, stars])
    _fixable_by_answer(c, [unasked, stars], row)
    assert not row["passed"]
