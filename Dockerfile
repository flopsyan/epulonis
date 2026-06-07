# ---- Build-Stage: Abhängigkeiten installieren (better-sqlite3 wird kompiliert) ----
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Build-Werkzeuge für die native Erweiterung better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Runtime-Stage: schlankes Image ohne Build-Werkzeuge ----
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    SITE_NAME=Epulonis \
    SEED_DEMO=true

WORKDIR /app

# Kompilierte Abhängigkeiten aus der Build-Stage übernehmen
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public

# Datenverzeichnis anlegen und Rechte an den Non-Root-User geben
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
VOLUME ["/app/data"]

# Healthcheck über die in Node 22 eingebaute fetch-API
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
