# MYLIBERTY Portal — Session Audit (2026-09-21)

Role note for the executing agent: this file is the auditor's read of the
project as uploaded this session. Nothing here is a final decision —
verify with the owner (no coding background, no budget) before acting,
and prefer the cheapest/free option when choices are open.

## Issue: Cloudflare Pages build failing

**Symptom (from owner's log):**
```
added 36 packages ...
Executing user build command: bun run build
error: Script not found "build"
```

**Findings:**
- Only 36 packages installed → npm install ran inside `cloudflare-worker/`
  (deps: `jose`, `wrangler`), not the repo root (root has react/vite/tailwind
  etc., far more than 36). So the Pages project's "Root directory" is set
  to `cloudflare-worker/`.
- `cloudflare-worker/package.json` DOES have a `"build"` script
  (`node build.js`), so the "Script not found" error is odd given a plain
  `npm run build` — but the log shows the configured build command is
  `bun run build`, run via `bun`. Root cause of the exact mismatch (bun
  path/resolution vs. root directory setting) wasn't reproducible from the
  zip alone — check the Pages project's actual Framework preset / Build
  command / Root directory settings in the Cloudflare dashboard directly.
- More importantly: `cloudflare-worker/build.js` is a no-op placeholder
  (`console.log(...)`) — it was never meant to be a real build step. The
  worker is meant to ship via `wrangler deploy`, not a Pages build.
- Repo already has two working, separate deploy paths that don't involve
  Cloudflare Pages at all:
  - App → Firebase Hosting, via `.github/workflows/*firebase*.yml`
    (`npm ci && npm test && npm run build`, then Firebase hosting deploy)
  - AI proxy worker → Cloudflare Worker via `wrangler.toml` +
    `wrangler deploy` (manual or CI, not Pages)

**Open question for the owner (do not assume):**
Why does a Cloudflare Pages project exist at all here? Three possibilities,
not mutually exclusive with pros/cons — pick based on what the owner
actually wants, don't default silently:

1. **It's a leftover/accidental connection.** Nothing in the repo needs
   Pages. → Just disconnect/delete the Pages project. Zero risk, zero cost.
2. **Intent was to deploy the Worker via Cloudflare's git-connected
   "Workers Builds."** That's a different project *type* than Pages in the
   Cloudflare dashboard. If this is the goal, recreate it as a Worker
   project (not Pages), root directory `cloudflare-worker`, and let
   wrangler handle building — no custom build command needed.
3. **Intent was to migrate the whole app off Firebase Hosting onto
   Cloudflare Pages** (also free tier). Bigger decision — would need root
   directory = repo root, build command `npm run build`, output dir
   `dist`, plus re-pointing env vars/domain. Only worth it if there's a
   reason to move off Firebase; no reason to do this just to fix the error.

## Not yet reviewed this session
Full app code (React components, Firestore rules/indexes, docs/*
implementation plans) wasn't audited beyond what was needed to diagnose
the build error above — scope this session was the Cloudflare failure
only, per owner's request to keep sessions efficient.
