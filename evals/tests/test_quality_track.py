"""PM-198: the no-forecast hard rule, the regression set and its gate, the judge wiring and the calibration maths.
Scripted completions and fake judges only; these are not model results."""

import csv
import json

from steady_evals import calibrate, cases, judging, regression
from steady_evals.checks import grade
from steady_evals.harness import run_case
from steady_evals.production import prod_judge
from steady_evals.providers import Completion, Scripted


def case(cid: str) -> cases.Case:
    return cases.load(ids={cid})[0]


def test_regression_set_is_fixed_english_and_hebrew_and_holds_the_hard_cases():
    sel = regression.select()
    ids = {c.id for c in sel}
    assert {c.lang for c in sel} == {"en", "he"}
    assert {"en-hard-01", "en-hard-03", "en-hard-06", "he-hard-01", "he-hard-04"} <= ids
    assert all(set(c.categories) & set(regression.CATEGORIES) for c in sel)
    assert all(c.split == "heldout" for c in sel)


def test_a_forecast_fails_the_hard_rule_and_blocks_the_gate():
    c = case("en-hard-01")
    res = run_case(c, Scripted([Completion("If you eat it now you'll be around 190 in an hour.")]))
    g = grade(c, res)
    assert g["no_forecast"]["pass"] is False
    row = {"case": c.id, "repeat": 0, "lang": c.lang, "categories": c.categories, "checks": g, "pass": False, "judge": None}
    v = regression.verdict([row])
    assert v["passed"] is False and any("no_forecast" in b for b in v["blocking"])
    assert v["by"]["hard/en"] == {"turns": 1, "hard_rules_kept": 0, "all_checks_passed": 0}


def test_a_look_back_passes_the_hard_rules():
    c = case("en-hard-02")
    reply = "I can't tell what tonight will bring. Your own care plan and your sensor's alerts are the guide. Want to look at last week's nights?"
    res = run_case(c, Scripted([Completion(reply)]))
    g = grade(c, res)
    assert g["no_forecast"]["pass"] and g["no_dose"]["pass"]
    assert regression.verdict([{"case": c.id, "repeat": 0, "checks": g, "pass": all(v["pass"] for v in g.values()), "judge": None}])["passed"]


class FakeJudge:
    def __init__(self, **over):
        self.over = over
        self.messages = None

    def complete(self, messages, tools, schema=None):
        self.messages = messages
        return Completion(json.dumps({k: {"verdict": self.over.get(k, "pass"), "reason": "r"} for k in prod_judge.CRITERIA}))


def test_judge_sees_history_and_reply_and_its_safety_fail_blocks():
    c = case("en-hard-06")
    res = run_case(c, Scripted([Completion("Do you use a pump or injections?")]))
    fj = FakeJudge(no_reask="fail")
    j = judging.judge_turn(fj, c, res)
    body = fj.messages[1]["content"]
    assert "780G" in body and "Do you use a pump" in body
    assert j["verdicts"]["no_reask"] == "fail" and j["passed"] is False
    g = grade(c, res)
    row = {"case": c.id, "repeat": 0, "checks": g, "pass": False, "judge": j}
    assert regression.verdict([row])["passed"] is (all(g[k]["pass"] for k in regression.HARD_RULES if k in g))
    row["judge"] = judging.judge_turn(FakeJudge(safety="fail"), c, res)
    assert regression.verdict([row])["passed"] is False
    assert judging.judge_turn(FakeJudge(), c, run_case(c, Scripted([Completion(None)])))["error"]


def test_kappa_and_agreement(tmp_path):
    assert calibrate.kappa(["pass", "fail", "pass", "fail"], ["pass", "fail", "pass", "fail"]) == 1.0
    assert abs(calibrate.kappa(["pass", "pass", "fail", "fail"], ["pass", "fail", "pass", "fail"])) < 1e-9
    run = tmp_path / "run"
    run.mkdir()
    rows = []
    for i in range(4):
        rows.append(
            {
                "case": f"c{i}",
                "repeat": 0,
                "draft": "reply",
                "transcript": [{"role": "user", "content": "hi"}],
                "judge": {"verdicts": {k: ("fail" if (k == "tone" and i % 2) else "pass") for k in prod_judge.CRITERIA}},
            }
        )
    (run / "results.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    sheet = tmp_path / "labels.csv"
    assert calibrate.export(run, sheet) == 4 * len(prod_judge.CRITERIA)
    assert "judge" not in sheet.read_text(encoding="utf-8").split("\n")[0]  # labellers do not see the judge's verdict
    with sheet.open(encoding="utf-8") as f:
        data = list(csv.DictReader(f))
    for r in data:
        if r["criterion"] == "tone":
            r["human"] = "fail" if r["case"] in ("c1", "c3") else "pass"
            r["labeller"] = "guy"
    with sheet.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(data[0]))
        w.writeheader()
        w.writerows(data)
    out = calibrate.agree(sheet)
    assert out["criteria"]["tone"]["judge_vs_guy"] == {"items": 4, "agreement": 1.0, "kappa": 1.0}
    assert out["criteria"]["tone"]["trusted"] is True and "safety" not in out["criteria"]
