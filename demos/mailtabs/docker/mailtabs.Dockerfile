# Mailtabs, built from the source in ./mailtabs-src (copy the Mailtabs folder there; see README).
# Build context: the demo kit folder (docker-compose.yml sets it).

FROM node:22-bookworm-slim AS build
# Toolchain only in case better-sqlite3 has no prebuilt binary for this platform.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY mailtabs-src/package.json mailtabs-src/package-lock.json ./
RUN npm ci --omit=dev
COPY mailtabs-src/ ./

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# No .env inside the image: configuration comes from docker-compose.yml.
RUN rm -f /app/.env && mkdir -p /data && chown node:node /data
USER node
EXPOSE 3301
CMD ["node", "server.js"]
