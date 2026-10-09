# Railway deployment image for the NoteVault / DU PYQ Online Next.js app.
#
# Debian-based "slim" images (not Alpine) are used deliberately: Prisma's
# query engine and `sharp`'s native binary both ship prebuilt glibc
# binaries, and building/running on musl (Alpine) is a recurring source of
# "Prisma engine not found for this platform" / sharp install failures.
#
# Multi-stage + Next's `output: "standalone"` (next.config.ts) keeps the
# final runtime image to just the traced server output instead of the full
# repo + node_modules — this project has already hit platform function/
# image size limits once before (see next.config.ts tracing comments).

FROM node:20-slim AS base

# --- deps: install once, cached across builds unless package*.json change
FROM base AS deps
WORKDIR /app
# OpenSSL is required by Prisma's query engine at generate + run time.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- builder: full source, run the production build
FROM base AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL isn't needed to build (no DB calls at build time beyond
# `prisma generate`, which deps already ran via postinstall), but Next's
# build step does read other env vars (e.g. NEXT_PUBLIC_*) — Railway
# injects real build-time env automatically when this Dockerfile is built
# on Railway itself.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner: minimal image that actually serves traffic
FROM base AS runner
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The build step already raises V8's heap limit for `next build`
# (package.json's NODE_OPTIONS), but that flag doesn't carry over to the
# running server — CMD below is a separate `node` process with Node's
# default heap ceiling (~2GB), regardless of how much RAM the container
# actually has. This used to be set to 6144 to fix OOM crashes from large
# JSON catalog files loaded at runtime, but those catalogs are now cached/
# split (see src/lib/pyq-catalog.ts, scripts/build-papers-split.mjs) instead
# of re-parsed per request, so the real working set is small — a local
# load test against this exact build peaked at ~410MB RSS. Railway bills by
# memory used, and the 6144 cap let the process creep to 1-1.8GB average in
# production for no behavioral benefit. 768 leaves ~2x headroom over the
# measured peak; raise it again if a future data file genuinely needs it.
ENV NODE_OPTIONS=--max-old-space-size=768
# The heap cap above doesn't cover native memory (Prisma's query engine,
# sharp). glibc opens up to 8 malloc arenas per vCPU — 64 on Railway's 8 vCPU
# box — and fragments them, so RSS climbed linearly to 4+GB and crashed
# (Railway metrics 2026-10-08). 2 arenas is the standard fix for Node on glibc.
ENV MALLOC_ARENA_MAX=2

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + its pruned node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets aren't included in standalone output by design (meant to be
# served by a CDN) — copy them in manually per Next's docs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# @prisma/client is marked serverExternalPackages (require()'d at runtime,
# not traced into standalone) — copy the generated client explicitly, plus
# the query engine binaries under node_modules/.prisma it depends on.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs

# Railway sets PORT itself; Next's standalone server.js honors PORT/HOSTNAME
# env vars directly (see next.config.ts `output` comment / Next docs).
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "server.js"]
