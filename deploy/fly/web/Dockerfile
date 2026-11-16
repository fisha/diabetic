# The Stedio website (apps/web, Next.js) with the app's web build at /app, for Fly.io (16 Nov 2026).
# Build context: the main repository root (the website needs packages/* and apps/mobile for /app).
# Deploy with scripts/fly/stedio-fly web, which also stages the tester install files into deploy/fly/web/.install.
ARG NODE_IMAGE=node:22-slim

FROM ${NODE_IMAGE} AS build
ENV CI=1 NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile

# Public addresses and client ids (not secrets: they ship to every browser). Values come from deploy/fly/web/fly.toml.
ARG API_PUBLIC_URL
ARG API_INTERNAL_URL
ARG GOOGLE_WEB_CLIENT_ID
ARG APPLE_SERVICES_ID
ARG EAS_PROJECT_ID
ARG APP_BUNDLE_ID
ARG EXPO_OFFLINE=
# The app's web build (the personal area at /app), same as `stedio deploy-web` on the Mac.
RUN cd apps/mobile && \
    EXPO_OFFLINE="$EXPO_OFFLINE" EXPO_PUBLIC_API_URL="$API_PUBLIC_URL" EXPO_PUBLIC_APPLE_SERVICES_ID="$APPLE_SERVICES_ID" \
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="$GOOGLE_WEB_CLIENT_ID" EAS_PROJECT_ID="$EAS_PROJECT_ID" APP_BUNDLE_ID="$APP_BUNDLE_ID" \
    pnpm export:website
# STEADY_API_URL is read at build time for the /api/steady rewrite: the dashboard reaches the API over Fly's private network.
RUN cd apps/web && \
    NEXT_OUTPUT=standalone STEADY_API_URL="$API_INTERNAL_URL" \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_WEB_CLIENT_ID" NEXT_PUBLIC_APPLE_SERVICES_ID="$APPLE_SERVICES_ID" \
    pnpm exec next build

FROM ${NODE_IMAGE}
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=::
WORKDIR /srv
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
# Tester install page and IPAs (git-excluded; staged by the deploy script with this site's address in them).
COPY --chown=node:node deploy/fly/web/.install ./apps/web/public/install
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
