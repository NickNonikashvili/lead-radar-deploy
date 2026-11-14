# Demo helpers: SMTP sink (long-running) and the two one-shot seeders.
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib/ ./lib/
COPY smtp-sink.js seed-mail.js seed-demo.js ./
USER node
EXPOSE 3325
CMD ["node", "smtp-sink.js"]
