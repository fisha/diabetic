import tomllib
from pathlib import Path

REQUIRED = {"id", "title", "publisher", "published", "url", "population", "use", "rights_status", "rights_note", "attribution", "checked"}


def test_sources_have_dates_rights_population_and_attribution():
    data = tomllib.loads((Path(__file__).resolve().parents[1] / "sources" / "sources.toml").read_text(encoding="utf-8"))
    ids = set()
    for s in data["source"]:
        assert REQUIRED <= set(s), s.get("id")
        assert s["id"] not in ids
        ids.add(s["id"])
        assert s["rights_status"] in {"unverified", "cleared", "cite-only"}
        assert s["use"] in {"reviewer-reference", "retrieval-candidate", "out-of-scope", "model-documentation"}
        # Retrieval may only use cleared sources written for adults with type 1.
        if s["use"] == "retrieval-candidate":
            assert s["rights_status"] == "cleared" and {"adult", "t1d"} <= set(s["population"])
