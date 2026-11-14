# © 2026 EvoSoft Solutions
# Mailtabs, built from the source in ./mailtabs-src (copy the Mailtabs folder there; see README).
# Build context: the demo kit folder (docker-compose.yml sets it), plus the named context "branding" (the shared
# ../_branding folder with the EvoSoft copyright notice; docker-compose.yml, additional_contexts).

FROM node:22-bookworm-slim AS build
# Toolchain only in case better-sqlite3 has no prebuilt binary for this platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY mailtabs-src/package.json mailtabs-src/package-lock.json ./
RUN npm ci --omit=dev
COPY mailtabs-src/ ./
# The EvoSoft copyright notice (README "Copyright notice"): the notice files go to public/__evosoft/ and
# public/index.html gets one line that loads them. Only this image's copy changes, never mailtabs-src/.
COPY --from=branding evosoft-notice.css evosoft-notice.js add-notice.js /tmp/evosoft-branding/
COPY docker/brand-mailtabs.sh /tmp/evosoft-branding/
RUN sh /tmp/evosoft-branding/brand-mailtabs.sh /app /tmp/evosoft-branding && rm -rf /tmp/evosoft-branding

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# No .env inside the image: configuration comes from docker-compose.yml.
RUN rm -f /app/.env && mkdir -p /data && chown node:node /data
USER node
EXPOSE 3301
CMD ["node", "server.js"]
