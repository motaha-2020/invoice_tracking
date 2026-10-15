# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# صورة منظومة تتبع المستخلصات — بتتبني في GitHub Actions بس (ممنوع البناء على السيرفر).
# الـ context = جذر الـ repo:
#   docker build -f apps/web/Dockerfile --target web     -t invoice_tracking-web .
#   docker build -f apps/web/Dockerfile --target migrate -t invoice_tracking-migrate .
# المحتاج من next.config.ts:  output: 'standalone'  (+ outputFileTracingRoot = جذر الـ monorepo)
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_IMAGE=node:22-bookworm-slim

# ── base: openssl عشان Prisma schema-engine (migrate) بيحتاجه ──
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps: ملفات الـ package بس عشان الـ cache يفضل صالح طول ما الـ lockfile ماتغيرش ──
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --loglevel=error

# ── build: prisma generate + next build ──
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
# prisma.config.ts بيقرا DATABASE_URL — قيمة وهمية للبناء بس (مفيش اتصال بـ DB وقت البناء)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npx -w @it/db prisma generate
RUN npm run build -w @it/web

# ── migrate: one-shot — prisma migrate deploy + البيانات المرجعية ──
# بيستخدم node_modules من build (فيها schema-engine لـ Linux اتنزّل وقت generate)
FROM base AS migrate
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/tsconfig.base.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/db ./packages/db
COPY --from=build --chown=node:node /app/packages/domain/package.json ./packages/domain/
USER node
WORKDIR /app/packages/db
# DATABASE_URL بييجي من الـ compose وقت التشغيل
ENV PATH=/app/node_modules/.bin:$PATH
CMD ["sh", "-c", "prisma migrate deploy && tsx prisma/seed.ts --reference"]

# ── web: الـ runtime — standalone بس، من غير node_modules كاملة ──
FROM ${NODE_IMAGE} AS web
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# standalone في monorepo بيطلع بنفس شكل الـ repo: apps/web/server.js + node_modules متتبعة
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# مكان المرفقات (volume في الـ compose) — لازم يبقى ملك node قبل أول mount عشان الـ volume ياخد نفس الملكية
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
