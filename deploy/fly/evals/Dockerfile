# The companion's regression set (PM-198) as a one-off Fly Machine in stedio-api (PM-203, Guy 17 Nov 2026).
# Build context: the main repository root (the evals import services/api read-only, as on a laptop).
# Built and run only by `scripts/fly/stedio-fly evals`. It runs synthetic held-out cases, plus the food regression's photo
# cases when the Mac's checkout has them (evals/food/regression/, kept out of git: meal photos Guy gave for testing,
# PM-564), and never opens the database. The OpenAI key is the app's own secret (STEADY_OPENAI_API_KEY), read from the environment inside the
# Machine; it is never written to a file, a log or the results.
ARG PY_IMAGE=python:3.12-slim
FROM ${PY_IMAGE}

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/repo/services/api/.venv

RUN pip install --no-cache-dir uv==0.11.32

WORKDIR /repo/services/api
COPY services/api/pyproject.toml services/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY services/api/steady_api ./steady_api

WORKDIR /repo/evals
COPY evals/steady_evals ./steady_evals
COPY evals/cases ./cases
# Always present (README.md); the photo cases only when the checkout has them.
COPY evals/food ./food
COPY deploy/fly/evals/run.sh /repo/run-evals.sh

ENV PATH=/repo/services/api/.venv/bin:$PATH
RUN useradd --uid 10001 --home-dir /repo --no-create-home steady && chmod +x /repo/run-evals.sh \
    && mkdir -p /repo/evals/reports/runs && chown -R steady /repo/evals/reports
USER steady
CMD ["/repo/run-evals.sh"]
