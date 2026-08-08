# Launch Checklist

Everything verified before and immediately after going live.

---

## Before deploy

### Environment (production)

| Var | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Neon/managed Postgres URL | SSL connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` | **Required** — production build refuses to run without it |
| `VITALS_INGEST_KEY` | long random string | Set it, then seed so the demo org gets this exact key |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Never true in production |
| `NEXT_PUBLIC_REALTIME` | `polling` on Vercel; `sse` on a single-node host | See "realtime transport" below |
| `MODEL_API_URL` | optional | Set when your trained model is live |
| `MODEL_FALLBACK_MODE` | `fallback` initially | `strict` once the model is trusted |

### Data

- [ ] Migrations applied: `pnpm db:migrate` (or `pnpm db:push`)
- [ ] Seed ran: `pnpm seed` (demo org + demo user + demo animals) — then
      create real orgs/users via SQL or an admin script (no admin UI yet)
- [ ] Change the demo user's password or delete it before real users exist

### Build gates

- [ ] `pnpm lint` — clean
- [ ] `pnpm typecheck` — clean
- [ ] `pnpm test` — all unit tests pass
- [ ] `pnpm build` — clean, no ignored type errors

---

## Realtime transport decision

- **Vercel (serverless):** use `NEXT_PUBLIC_REALTIME=polling`. SSE streams
  hit function-duration limits and per-instance memory, and the DB-poller
  in `/api/stream` is per-process. Polling every 10s is perfectly fine for
  a dashboard.
- **Single node (VPS/Docker):** `NEXT_PUBLIC_REALTIME=sse` gives instant
  pushes. Rate limiting on `/api/vitals` is also in-memory — fine here.

## Deploy

1. Push to `main` — CI (lint → typecheck → unit tests → build → e2e) must be green
2. Set the production env vars (see table)
3. Run migrations against the production DB
4. Deploy (Vercel: import repo; VPS: `pnpm build && pnpm start` behind a
   reverse proxy)

## Post-deploy smoke test (first hour)

- [ ] `GET /` redirects to `/login`
- [ ] Login works with a real user; dashboard loads
- [ ] Ingestion: `curl -X POST /api/vitals -H "x-ingest-key: <key>" -H "content-type: application/json" -d '{"animalId":"<uuid>","heartRate":70,"pulse":72,"temperatureC":38.2,"oxygenPct":98,"digestScore":92}'` → 201
- [ ] Values change on the open dashboard (run the simulator against prod temporarily, or send one test reading)
- [ ] Two orgs cannot see each other's data (create a second org + user to verify)

## First 48 hours — watch

- Ingestion failures (auth, rate limits, validation) in logs
- Login failures / spam
- DB connection pool health under the polling loop
- Confidence values look sane (if a model is live) — calibration check
- Vitals volume vs. expected: 1 reading/10s/animal ≈ 8.6k rows/day/animal.
  Plan TimescaleDB or retention when volume becomes a cost issue.

## Rollback

- Keep the previous deployment available (Vercel: instant rollback;
  VPS: previous image/build).
- `MODEL_FALLBACK_MODE=fallback` + removing `MODEL_API_URL` instantly
  reverts analysis to rule-based — no code change, no redeploy needed.
