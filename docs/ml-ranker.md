# Progress metrics, learning data and the insight ranker

Guy asked for this on 13 Nov 2026. It is internal work and runs on his Mac with testers who are development
partners. It does not recommend doses or change treatment, and it does not retrain the conversation model.

## 1. Progress metrics (`services/api/steady_api/metrics.py`)

The API, the research tool and the outcome windows all use the same functions.

- **Sensor rhythm.** No frequency is assumed. Each source's interval is measured as the median gap between its
  readings and snapped to 1, 5 or 15 minutes when it is close. Each reading stands for the time until the next one,
  up to 1.2 times its interval. Coverage means time covered divided by time in the window. Before this change,
  CareLink at 5 minutes and LibreLinkUp at 15 minutes were both measured against 288 readings a day, so a full
  Libre day counted as 33 %. That 288 assumption is also removed from the app's day bars, the estimated A1c, the
  follow-up coverage and the daily check.
- **Duplicates and overlaps.** Readings from the same source less than 30 s apart are counted once. When two sources
  cover the same time, the one that covered more of that local day leads, and the other only fills its gaps.
- **Two kinds of range.** The person's own range (typed, or taken from the pump or CareLink) is reported separately
  from the published consensus thresholds (Battelino 2019): 70-180, below 70 and 54, above 180 and 250, and 14 days
  at 70 % for a reliable picture. GMI is given only with the consensus amount of data.
- **Baseline and sustained change.**
  - The baseline is the first 14 local days with at least 70 % coverage on at least 10 days.
  - Each of the last 12 complete weeks is compared with it.
  - A change counts as *sustained* only if each of the last 3 weeks after the baseline had enough data (70 %
    coverage, 5 days), had time in range at least 5 points above the baseline, and had time below range no more
    than 1 point above it.
  - One good week is not enough.
  - Missing data gives `insufficient_data`. It is never read as improvement or decline.
  - There is no score and no claim about cause.
- **Typical day.** Time-weighted percentiles (10/25/50/75/90) by hour. It needs at least 5 days. An hour with
  readings on fewer than 3 days stays empty.
- **Endpoints.** `GET /metrics/progress`, `GET /metrics/typical-day?from&to`, `GET /metrics/quality`. Share viewers
  may read the first two.
- **App.** For a week, 2 weeks or a month, the Overview shows "A typical day" and "Progress against your starting
  period", in all four languages. The same app runs on the website at `/app`.

## 2. Learning data (`steady_api/learning.py`, `learning_models.py`)

| What | Table | Kind |
|---|---|---|
| Listed on screen (once per insight per local day: rank, engine, rules and model version, mode, evidence: certainty, basis, coverage, counts, part of day, update kind) | `insight_exposures` | listing |
| Opened (`/state` read) | `insight_events` type `open` | click |
| Looked closer (why, what was left out, the records) | `insight_events` type `detail` | click |
| Talked it over with the companion | `insight_events` type `action` | action |
| Useful, wrong data, known, not relevant, other, mute | `insight_events` type `feedback` | what they said |
| Glucose before and after the first listing (7, 14 and 28 days; overall, and for the insight's part of the day) | `insight_outcomes` | outcome, observational |
| Which order was served and which order the model would have served | `ranking_decisions` | ranking |

- A listing is recorded only when the client sends `shown=true`. Only the Overview list does, and only for the
  current window. A viewer of a shared account, or an admin, leaves no listing and no decision behind.
- When either side of an outcome window lacks data, it is `insufficient_data`. Outcomes are not used as features or
  labels, and they are not described as caused by the insight.
- Gap (G-61): the design has no explicit "I'll try this" confirmation. The only action the app can record today is
  talking it over with the companion.

## 3. Consent

- **Service.** Listings, events and outcomes are kept for every account. They serve that person's own experience
  and are never shared.
- **Training.** The onboarding and Privacy toggle (`consents` kind `training`) is off by default and enforced in
  code:
  - A dataset reads only people whose latest training consent is granted at build time, and checks each person
    again just before reading their rows.
  - Withdrawing it (`PUT /profile` with training false), or deleting the account, removes that person's rows from
    every dataset and marks those datasets `consent_revoked`. Every model trained on such a dataset is also marked
    `consent_revoked` and stops being used at once, so the server falls back to the rules. Such a dataset cannot be
    trained on again, and such a model cannot be made current again.
  - Rows use a keyed pseudonym (an HMAC of the account id), with no email, key text or food names. A pseudonym is
    not anonymisation: the server key links it back, so these tables are health data like the rest.
  - The research tool shows only people with the training consent, or an admin's own account.

## 4. Training (`services/api/steady_ml/`, a separate process)

- **Target (label `l1`).**
  - Relevant (1): the person said the insight was useful, or acted on it, within 7 days of the listing.
  - Not relevant (0): they said wrong, known or not relevant, muted it, or it was listed again on 2 later days and
    never opened.
  - No signal gives no label. An open alone is a click, not relevance.
  - The ranker predicts engagement. It is not evidence of better glucose.
- **Features (`f1`, `ranking_features.py`, shared with the server).**
  - The insight's family, tone, certainty, basis, coverage, share, update kind, age, unread state, whether it is
    about the current part of the day, and its rank in the rules order.
  - The person's history strictly before the listing: listings, open rate, positive rate, open rate in that family,
    and whether that insight was opened, liked or waved away before.
- **No leakage.**
  - A listing is used only once its whole 7-day label window lies before the dataset cutoff.
  - The history used for a listing comes only from before it.
  - A test checks that adding a later event does not change any earlier feature.
- **Versioning.** Datasets (`ml_datasets` and rows, with a sha256 of the canonical rows), models (`ml_models`:
  weights as plain numbers, no pickles) and evaluations (stored on the model) are kept in PostgreSQL.
- **Evaluation.**
  - One person in three is held out by hash, and time is split at the 70th percentile of listing days.
  - The model trains on the other people before that day and is judged on the held-out people from that day on,
    against the rules order on the same rows: AUC, Brier and NDCG@3 per day's list.
  - Gate: at least 200 training rows, 50 test rows, 2 unseen people and 10 test lists with a relevant item; AUC of
    at least 0.6; NDCG@3 at least 0.02 above the rules.
  - A model that fails is kept as `failed_gate`, with its reasons.
- **Jobs.**
  - `uv run python -m steady_ml.jobs enqueue train` (or the research tool) only queues a job. The worker runs one
    job per tick.
  - `uv run python -m steady_ml.jobs run` runs the queue in its own process.
  - Nothing trains on a page load.
- **Scheduled retraining (13 Nov 2026).**
  - The worker queues one training run every `STEADY_ML_RETRAIN_HOURS` (24 by default; 0 turns it off) and runs it like
    any queued job. Each run builds a new dataset from the people who consent at that moment.
  - With too little data the run is still kept, as `failed_gate` with its reasons (for example too few rows), and the
    server keeps serving the rules' order.
  - A model that passes its gate becomes current on its own while the ranker is in shadow or off
    (`STEADY_ML_AUTO_PROMOTE`, on by default). In active mode it stays a candidate until a person promotes it.
- **Health check.** `uv run python -m steady_ml.status` prints counts, statuses and times only: listings, events,
  outcomes, decisions, jobs, datasets, models, the current model and the last training run.
- **Registry.** `uv run python -m steady_ml.registry list | promote <version> | rollback`.

## 5. Serving (`steady_api/ranking.py`, in `GET /insights`)

- The rules decide which insights exist: validity, the person's range, safety, muting and the client's `kinds`. The
  ranker only reorders that list. It cannot add, drop or change an insight.
- Insights about time below range and about pump suspensions always stay first.
- `STEADY_RANKER_MODE`:
  - `shadow` (the default): the rules order is served, and the current model's order is logged beside it.
  - `active`: the model's order is served only to the emails in `STEADY_RANKER_TESTERS`, only if the model passed
    its gate, and only if the person has at least `STEADY_RANKER_MIN_USER_DAYS` (5) days of listings.
  - `off`.
- `ranking.reason` says why the rules order was served: `no_model`, `model_invalid`, `feature_mismatch`,
  `insufficient_user_data`, `not_a_tester`, `shadow`, `mode_off` or `model_error`.
- Rollback: `steady_ml.registry rollback`, or set the mode to `shadow` or `off`.
- The app sorts the cards by `ranking.order`. Older app code ignores it.
- The lock-screen card keeps its own kinds of priority (device first, then what to watch), and between cards of the same
  kind it follows `ranking.order` (14 Nov 2026).
- The companion (text, voice and live voice) gets the latest served order from the last 2 days and what the person
  said about each insight in the last 90 days (useful, talked over, already known, not relevant, wrong data), so it
  starts from the same insights and doesn't raise the ones waved away (`learning.describe_for_companion`, 14 Nov 2026).
- Insight pushes keep the rules' policy and are not reordered by the model.

## 6. Research tool (`services/api/steady_research/app.py`, Streamlit)

```
cd services/api
STEADY_RESEARCH_TOKEN=<any long secret> uv run --group research streamlit run steady_research/app.py --server.address 127.0.0.1
```

- It runs locally only. A public tunnel needs Guy's explicit approval.
- Tabs:
  - Data quality: sources and rhythm, duplicates, overlaps, gaps, coverage per day.
  - Progress: weekly time in range, time below, CV, coverage and consensus time in range, against the baseline.
  - Typical day.
  - Insight to action to outcome: clicks, actions and outcomes in separate columns.
  - Model vs rules: versions, gate, unseen-people metrics, why the rules were served, top-1 agreement.
  - Jobs: queue a dataset or a training run.

## 7. Verified so far

- API: 231 tests (`uv run pytest`), including `test_metrics.py`, `test_learning.py`, `test_ranker_pipeline.py`
  (synthetic data, tests only: dataset, leakage, training, gate, promote, shadow, active, every fallback, consent
  withdrawal, rollback, jobs) and `test_research_app.py` (Streamlit AppTest, run with `--group research`).
- Browser: `tools/e2e/progress.cjs` on the app's web build, against the real API with 45 days of synthetic
  15-minute readings. Day bars, the typical day, the trend card and its wording, the server order, and listing,
  click and action events all pass, with no page errors.
- Mac check, 13 Nov 2026 23:48 UTC: listings, events and decisions are being recorded; 3 accounts have training
  consent. Before the schedule above, no training run had ever been queued. Outcomes start 7 days after the first
  listing (13 Nov), so none are due before 20 Nov.
- Mac check, 14 Nov 2026 09:27 UTC: the scheduled run ran at 00:02 UTC with 0 rows and was kept as `failed_gate`
  (could_not_train). That is expected, because a listing becomes a training row only once its 7-day label window has
  closed, and the first listings were on 13 Nov. Rows start on 20 Nov, and the gate needs 200 training rows.
- Not yet: real data on the Mac, a model trained on real listings (there are none yet), and active mode for testers.
