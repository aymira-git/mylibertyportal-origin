# Coding Assistant Profile & Working Agreement (MyLiberties Portal)

**Note:** Written by the auditor (Claude) after reading `myliberty-portal.zip`. Claude is an AI and can be wrong. Everyone (executing agent, auditor, Kifry) is invited to double-check these lines against the real code and to propose better ones. Lines say what is preferred and why; if a different approach fits better, say so and explain.

## About the person you are helping
- Kifry has no coding experience and no budget. The agent does the heavy lifting: reading the code, writing it, and explaining only what needs explaining.
- Free tiers matter. Before adding a paid service, a new heavy dependency or a pattern that multiplies Firestore reads, check with Kifry and mention the cost.
- Deliverables are drop-in files. After each piece of work, list the files changed or added, and any command Kifry needs to run (for example deploying `firestore.rules` or `firestore.indexes.json`), in plain language.

## Actual Tech Stack (verified from the repo)
- **Frontend:** React 19 (functional components + hooks), Vite, Tailwind v4, `lucide-react` icons, `vite-plugin-pwa`.
- **Data:** Firebase Auth + Firestore, `zod` schemas in `src/schemas/`, one repository file per area (e.g. `classesRepository.js`).
- **Language:** JavaScript (`.js` / `.jsx`) type-checked with `tsc` (`checkJs`). Staying in JS with JSDoc is the current pattern; if TypeScript files are proposed, explain the gain.
- **Tests / quality:** Vitest (`npm test`), ESLint with the newer `react-hooks` rules, Prettier, `knip` for unused code.
- **Hosting / edge:** Both a Firebase Hosting config and a Cloudflare Pages + Worker setup exist in the repo (the Worker proxies the AI assistant). Please confirm which one serves production before changing deployment steps.
- **Timezone:** the school runs on WITA (UTC+8); tests are pinned to `Asia/Makassar`.

## Working Style
1. **Think step by step, in the reply, not in the code.** Give a short plan (what changes, which files, what could break) before the work. Comments in code are for lasting explanations, not for the plan of the day.
2. **Read before writing.** Check the existing helper or pattern first (`constants/`, `features/shared/`, the repositories). This repo already has shared pieces such as `Card`, `Badge`, `useToast`, `useConfirm`, `DashboardShell`, `ResponsiveTable`, `normalizeBranch`. Reuse them where they fit.
3. **Plans are proposals.** When working from an implementation plan `.md`, feel free to argue with it. Reply with what you would change and why. Kifry decides.
4. **Report honestly.** State what was run (`npm test`, `npm run lint`, `npm run build`) and the result, and what was not run or could not be verified.

## Code Preferences (with reasons)
- **Errors:** surface them to the user (toast or inline message; an `ErrorBoundary` already wraps each dashboard) and log enough to debug. Empty `catch` blocks hide problems, so a `try/catch` should either recover or report.
- **Loading / empty / failed states** for every data-driven screen, and safe handling of missing fields, because older Firestore records often lack newer fields.
- **Legacy data:** older documents may have free-text or missing values (program, branch, level). Normalize on read through a helper and keep old records working; a migration that rewrites existing data is worth confirming with Kifry first.
- **React:** immutable state; refs for anything that touches the DOM (libraries such as the QR scanner are fine); clean up listeners and Firestore subscriptions in `useEffect`; avoid `Date.now()` or setState-in-effect patterns that the `react-hooks` lint rules flag.
- **File layout:** hooks and constants in `.js` files, components in `.jsx` (the `react-refresh/only-export-components` rule). Files creeping past about 1000 lines are candidates for splitting (see the Large File Splitting plan).
- **UI:** use `useToast` / `useConfirm` instead of `alert()` / `confirm()`; put layout-only changes in `ResponsiveTable` / `DashboardShell` so business logic files stay untouched.
- **Environment:** `import.meta.env.VITE_*` (never `process.env`). Secrets belong in environment variables or the Worker, not in source files.
- **Firebase:** async calls that never block the UI; new or changed queries checked against `firestore.indexes.json`; role checks changed in `firestore.rules` together with the UI so they stay in step.
- **Tests:** new logic with branching (schedules, levels, status changes, money) gets a Vitest test next to it.

## When something is unclear
Ask Kifry one short question, offering a default so work can continue. Kifry may answer with "I don't know, suggest something"; a recommendation with the reason is welcome then.
