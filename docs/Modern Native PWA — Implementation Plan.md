# Modern Native PWA — Implementation Plan (revised after audit + repo cross-check)

Goal: make the MYLIBERTY portal feel like a native mobile app (iOS and Android) when installed or opened on a phone, while the desktop layout keeps working as it does today.

> **How to read this.** The original audit was produced by Claude from an uploaded project archive. This revision cross-checks the important findings against the current public `main` branch of `aymira-git/mylibertyportal-origin`. The executing agent should still verify each change in the working tree before implementation.
>
> **Cross-check scope:** `index.html`, `package.json`, `vite.config.js`, `src/main.jsx`, `src/index.css`, `src/App.jsx`, `DashboardShell.jsx`, `MobileDashboardShell.jsx`, `ToastProvider.jsx`, `Kiosk.jsx`, `KioskModal.jsx`, `KioskSidebarButton.jsx`, `ProfilePanel.jsx`, and `usePwaInstall.js` were checked directly. A full local clone/build was not available in this review environment, so repo-wide counts from the original audit should be treated as useful leads rather than verified measurements.

---

## Audit Notes

### What is already true in the code

The PWA manifest is already configured with `display: standalone`, maskable icons, shortcuts, `theme_color: #1a3a8f`, and a service-worker precache; the app already has a phone/desktop shell split; the mobile bottom nav and More sheet already account for the home-indicator safe area; `usePwaInstall.js` already detects standalone/iOS install state; and the Kiosk already has centralised success/error audio feedback. `src/main.jsx` also registers the PWA service worker immediately. citeturn963058view1turn829394view2turn595034view0

### Findings worth a second look

1. **Status-bar colour must be designed together with the mobile app bar.** `index.html` currently uses `theme-color #1e3a8a`, while the Vite PWA manifest uses `#1a3a8f`; the current app header is white and iOS status-bar style is `default`. Do not switch to `black-translucent` while keeping a white mobile bar. Either keep a light/white app bar with the existing readable status-bar treatment, or deliberately switch both to a dark brand-blue treatment. The simpler low-risk route is: keep the desktop header untouched, use a brand-blue mobile bar, and pair it with an iOS status-bar treatment whose icon colour remains readable. citeturn858224view1turn963058view1

2. **Do not remove the mobile dashboard subheader without relocating the Kiosk launcher.** `DashboardShell` passes `extraSidebarContent` into `MobileDashboardShell`, and that slot is explicitly used for the Attendance Kiosk launcher. On phones it is currently the only visible path supplied by the shell for that control. Keep it reachable or move it intentionally. citeturn829394view0turn829394view1turn236101view1

3. **Logout and Install need a phone home.** `App.jsx` currently puts both in the desktop-oriented top header, while `ProfilePanel` already contains the full install action but no logout action. Moving the avatar interaction to `ProfilePanel` is a clean phone solution; keep desktop logout behaviour unchanged. citeturn236101view0turn963058view3

4. **The active dashboard tab does not live in `App.jsx`.** `DashboardShell` owns or receives the active tab state and passes it to the mobile shell. Do not add unnecessary global state just to make the mobile header show the current tab. The mobile app bar should show stable identity (for example `MY LIBERTY` / role), while the dashboard subheader remains responsible for the current view label. citeturn829394view0turn236101view0

5. **`viewport-fit=cover` requires overlay review.** The original audit identified many full-screen overlays. The important verified examples include the idle-timeout overlay in `App.jsx`, the Kiosk modal, and the Profile panel. The Profile panel and mobile More sheet already have bottom safe-area handling; Kiosk modal and other full-screen overlays should be checked for both top and bottom insets. citeturn236101view0turn475608view3turn963058view3turn475608view0

6. **Toasts currently sit at `bottom-4`, which can overlap the mobile nav.** This is a real shared-UI change worth keeping in the plan. The toast container is globally fixed at bottom-right today. Raise it above the mobile navigation and safe-area inset, while leaving desktop placement effectively unchanged. citeturn475608view1

7. **The animation audit should be broader than the More sheet.** `package.json` has Tailwind 4 but no `tailwindcss-animate` / `tw-animate-css`, and the live Kiosk code already uses classes such as `animate-in`, `fade-in`, and `zoom-in`. A one-off slide-up animation for the More sheet would leave existing animation classes inconsistent. Decide on one small CSS animation layer in `index.css` and cover every animation class that this PWA actually relies on. Tailwind 4 supports custom utilities through `@utility`. citeturn858224view0turn475608view2turn616223search0

8. **Keep the viewport zoomable.** Do not add `maximum-scale=1` or `user-scalable=no`. Instead, prevent iOS input zoom by ensuring phone inputs/selects/textareas render at 16px or larger. This preserves pinch-zoom accessibility.

9. **Key mobile layout rules from width, not `display-mode: standalone`.** `display-mode: standalone` can also describe installed desktop/tablet PWAs. `md:hidden` / `hidden md:flex` is already the correct separation mechanism in this project, so keep it that way. citeturn829394view0turn236101view1

10. **Do not globally disable vertical overscroll.** `overscroll-behavior-y: none` would also remove the normal Android pull-to-refresh gesture. Prefer containment on sheets/full-screen surfaces where needed (`overscroll-contain`) rather than disabling it globally. Add a deliberate refresh affordance only if a future kiosk workflow requires one.

11. **Treat haptics as progressive enhancement.** The Vibration API is not universally supported; unsupported browsers/devices simply do nothing. Do not make haptics part of the functional contract, and test on real Android hardware rather than relying on desktop emulation. citeturn616223search3turn616223search4

12. **The Kiosk status hook has an `info` type as well as success/error.** `showStatus()` is central and is already the right place for one haptic call, but the helper must not accidentally treat `"info"` as an error vibration. Use a tiny mapping such as success → short feedback, error → stronger feedback, info → none. The existing sound logic also treats every non-success as error today, so avoid expanding the refactor beyond the requested mobile haptic enhancement. citeturn963058view2

13. **Receipt sharing should remain WhatsApp-first.** The Kiosk/portal's receipt message builder is not the transport layer. The existing WhatsApp flow should remain the primary one because the recipient is already known. Native Share can be a secondary action where it makes sense, especially for file sharing, rather than replacing recipient-aware WhatsApp flows.

14. **Do not add an unused app-badge helper.** `updateAppBadge(count)` needs a real caller and lifecycle rules before it is worth introducing. If no important surface can own the count, leave it out of this implementation rather than creating dead utility code.

15. **Treat iOS splash images as cosmetic/last-mile work.** Do not let splash-screen completeness delay the actual native-feel shell. Add it after the functional mobile pass and only if the installed iOS launch experience still needs improvement.

16. **Real-device testing is mandatory for the things emulation cannot prove.** Chrome DevTools is useful for responsive layout but does not reliably reproduce safe-area insets, native share sheets, or hardware vibration. Keep those checks on an actual iPhone and Android device.

17. **Spacing mismatch discovered in the live code.** `App.jsx` uses `p-3` on phones and `sm:p-4`, while `MobileDashboardShell` currently uses `-mx-4 -mt-4` and then `sm:-mx-6 -mt-6`. Those negative margins do not match the parent padding. The revised implementation should normalise the mobile shell to the actual parent spacing (`-3` / `-4` equivalents) or, better, make the mobile shell own the edge-to-edge container explicitly instead of relying on fragile negative margins. citeturn236101view0turn236101view1

18. **Avoid two competing sticky headers.** `MobileDashboardShell` already has a `sticky top-0` subheader. Adding another independent sticky app bar in `App.jsx` would create stacking/scroll-position edge cases. The revised plan should either merge the app bar and mobile subheader into one mobile header stack, or make the lower dashboard header explicitly stick below the app-bar height. Do not ship two unrelated `top-0` sticky surfaces. citeturn236101view1

19. **PWA update behaviour deserves a deliberate check.** The project currently uses `registerType: 'autoUpdate'` in `vite.config.js` and `registerSW({ immediate: true })` in `main.jsx`. That is convenient, but this is an operational portal with attendance/payment workflows, so the mobile pass should verify that a new deployment cannot interrupt a staff action in progress. If the current behaviour is too aggressive, the update UX should be changed before calling the PWA shell "production-safe". citeturn963058view1turn595034view0

20. **Offline scope is UI-shell offline, not database offline.** The service worker precaches application assets but deliberately does not cache Firebase/database/API calls. The plan should verify this distinction: an installed app should be able to open its shell offline, but staff-facing data operations may still require connectivity. The existing connectivity banner should remain part of that experience. citeturn963058view1

21. **Minor: viewport height.** `#root` already uses `min-height: 100svh`, so the plan does not need a broad viewport-height rewrite. The `App.jsx` wrapper can still move from `min-h-screen` to a mobile-safe viewport utility if testing shows a visible issue, but this is lower priority than the header/safe-area work. citeturn963058view0turn236101view0

22. **Minor: selection behaviour.** `user-select: none` should be limited to navigation controls. Phone numbers, names, tables, and other staff data should remain selectable/copyable.

---

## Current Stance

- **Desktop layout stays as it is.** Mobile presentation changes are width-gated (`md:hidden` / `hidden md:flex`); desktop markup and behaviour should not be redesigned. citeturn829394view0
- **No paid services and no heavy frameworks.** Use the existing React/Tailwind/PWA stack and small browser APIs.
- **Native-only capabilities degrade quietly.** Haptics, native share, badges, and install affordances should be optional enhancements, never prerequisites for core workflows.
- **Operational safety beats cosmetic polish.** Attendance, payments, logout, connectivity, and overlay usability come before splash screens, badges, or decorative animation.
- **Avoid duplicate navigation state.** Reuse `DashboardShell`'s existing active-tab flow rather than lifting it into `App.jsx`.
- **Prefer CSS and existing components over dependency additions.** The project is already on Tailwind 4 and has no animation plugin; only add a dependency if a concrete implementation need cannot be handled cleanly with the existing stack.

---

## Proposed Changes

Phases are suggestions; the executing agent can merge or split tasks, but should preserve the priority order below.

### Phase 0 — Baseline + implementation guardrails

#### [REVIEW] Existing architecture
- Keep `DashboardShell` as the shared desktop/mobile source of truth for tabs and role-specific content.
- Keep `App.jsx` responsible for authentication/session state and the global mobile app bar only.
- Do not duplicate active-tab state in `App.jsx`.
- Before changing mobile surfaces, note the current desktop layout at `md` and above and verify it remains structurally unchanged.

#### [CHECK] PWA update behaviour
- Reproduce a deployed-update scenario while a form/modal is open.
- Confirm whether `autoUpdate` + immediate registration can reload or otherwise disrupt in-progress staff work.
- Keep current behaviour if it is proven non-disruptive; otherwise add a controlled update path before finalising the native shell.

### Phase 1 — Shell, safe areas and web-feel removal

#### [MODIFY] `index.html`
- Viewport: `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- Keep viewport zoom enabled; do **not** add `maximum-scale=1` / `user-scalable=no`.
- Add `mobile-web-app-capable`.
- Align the HTML `theme-color` with the PWA manifest (`#1a3a8f`) unless a deliberate alternative is chosen.
- Choose the iOS status-bar style together with the mobile app-bar colour so status icons remain readable.
- iOS splash tags: optional, last-mile only.

#### [MODIFY] `src/index.css`
- `-webkit-tap-highlight-color: transparent`.
- `touch-action: manipulation` on buttons/links where it improves touch response.
- `-webkit-touch-callout: none` and `user-select: none` only on navigation/control surfaces.
- Add phone-only `16px` minimum font sizing for `input`, `select`, and `textarea` where needed to prevent iOS focus zoom.
- Add safe-area utilities (`pt-safe`, `pb-safe`, `px-safe`) using Tailwind 4 `@utility`.
- Add one consistent, small animation layer for the mobile sheet and the existing `animate-in` family actually used in the codebase; respect `prefers-reduced-motion`.
- Use `overscroll-contain` on modal/sheet surfaces where appropriate. Do not globally disable vertical overscroll.
- Keep the existing `#root` `100svh` behaviour unless real-device testing proves an app-wrapper change is necessary. citeturn963058view0turn616223search0

#### [MODIFY] `src/features/shared/ToastProvider.jsx`
- On phones, lift the toast stack above the bottom navigation and home-indicator area.
- Keep desktop toast placement effectively unchanged. citeturn475608view1

#### [REVIEW] Full-screen overlays
- Audit the existing full-screen/fixed overlays, prioritising:
  - `KioskModal.jsx`
  - `ProfilePanel.jsx`
  - `PaymentModal.jsx`
  - the idle-timeout overlay in `App.jsx`
  - `LoginPage`
- Apply safe-area padding only where content can actually collide with the notch/home indicator.
- Preserve existing centred-modal spacing when it is already safe.
- Verify scroll containment and background interaction while overlays are open. citeturn236101view0turn475608view3turn963058view3

### Phase 2 — Navigation and mobile header

#### [MODIFY] `src/App.jsx`
- Add a **phone-only compact app bar**, leaving the desktop header untouched:
  - Left: school crest + stable `MY LIBERTY` identity.
  - Centre: role or other stable context; **do not attempt to mirror the active dashboard tab from local App state**.
  - Right: avatar opening `ProfilePanel`.
- Make the app bar sticky if that is the chosen shell, but coordinate it with the existing mobile dashboard subheader so there is only one coherent sticky header stack.
- Move phone logout into `ProfilePanel`; keep desktop logout where it is.
- Keep the mobile Install action inside `ProfilePanel` (it already renders `InstallButton variant="full"`).
- Hide the desktop footer on phones if desired; the footer's install action should remain available on desktop.
- Consider `min-h-dvh` only after the real-phone shell test.

#### [MODIFY] `src/features/auth/ProfilePanel.jsx`
- Add a phone-visible Logout action using an `onLogout` prop from `App.jsx`, so authentication state remains owned by `App`.
- Keep the existing install button and profile/password-reset functionality.
- Preserve the existing bottom safe-area padding. citeturn963058view3

#### [MODIFY] `src/features/shared/MobileDashboardShell.jsx`
- **Do not remove `extraSidebarContent`** unless the Kiosk launcher is deliberately relocated.
- Fix the parent/child spacing mismatch:
  - current parent: `p-3` / `sm:p-4`
  - current shell negatives: `-mx-4 -mt-4` / `sm:-mx-6 -mt-6`
  - revised shell should use matching edge-to-edge offsets or an explicit full-bleed wrapper.
- Keep the current active-tab data flow.
- Keep the bottom nav safe-area padding.
- Keep the More sheet's existing drag handle and safe-area handling.
- Add the missing sheet animation through the shared animation layer.
- Optional: frosted-glass/floating-nav visual treatment only after usability is stable.
- Respect `prefers-reduced-motion`.

### Phase 3 — Attendance and native helpers

#### [NEW] `src/features/shared/mobileUtils.js`
Create this file only for helpers that have an immediate caller.

- `triggerHaptic(type)`:
  - success → short vibration where supported
  - error → stronger/double feedback where supported
  - info/unknown → no vibration
  - unsupported device → no-op
- `shareNativeOrFallback({ title, text, url, files })` only if a second real caller beyond the current file-share flow exists.
- Do **not** add `updateAppBadge(count)` unless a real UI source and clear lifecycle are identified.

#### [MODIFY] `src/features/attendance/Kiosk.jsx`
- Add one haptic call inside `showStatus`.
- Preserve all existing success/error sound behaviour.
- Be careful with the existing `"info"` status path so it does not produce error-style haptics. citeturn963058view2

#### [MODIFY] `src/features/attendance/KioskModal.jsx`
- Apply safe-area padding/containment only where the overlay audit identifies a real edge collision.
- Preserve the existing full-screen scanner workflow and high z-index. citeturn475608view3

#### [DISCUSS] Receipt sharing
- Keep the existing WhatsApp action as the primary recipient-aware workflow.
- Add native Share only as a secondary action where it provides a genuine benefit without removing the selected recipient.
- Do not modify `receiptMessages.js` merely to add mobile sharing.

### Phase 4 — Polish / optional last-mile work

#### [OPTIONAL] iOS splash screens
- Add only after the functional mobile shell passes on a real iPhone.

#### [OPTIONAL] Bottom-nav visual polish
- Frosted/translucent treatment, floating shape, and active-tab micro-animation.
- Do not trade hit area or legibility for visual effects.

#### [OPTIONAL] App badge
- Add only if there is a clear staff workflow that owns a count and can keep it fresh.

---

## Verification Plan

### Automated
- `npm run lint` passes.
- `npm run build` passes and the PWA service worker is generated.
- Confirm no new dead helper exports/files are introduced.
- Confirm the mobile-only changes do not alter desktop markup behaviour at `md` and above.

### Manual checks on a real iPhone and Android phone

1. Install the app to the home screen. Confirm the top-bar/status-bar colours keep the clock and battery readable.
2. Scroll the main dashboard. Confirm the app bar/subheader do not produce two competing sticky layers or cover content.
3. Rotate portrait → landscape → portrait. Confirm notch/cutout and home-indicator areas stay clear.
4. Open Attendance Kiosk from Admin, Front Office, and Instructor phone views. Confirm the Kiosk launcher is still reachable.
5. Scan a valid badge and an invalid badge. Confirm existing sound behaviour remains correct; on supported Android hardware, confirm success/error haptics.
6. Open the Kiosk's class-selection/transition sheets and other large overlays. Confirm no controls sit under the notch or home indicator.
7. Trigger a toast. Confirm it appears above the bottom navigation.
8. Focus phone inputs/selects/textareas on iPhone. Confirm the page does not unexpectedly zoom.
9. Copy/select a phone number or table text. Confirm navigation-only `user-select: none` rules did not make useful data unselectable.
10. Log out from the phone view. Confirm logout works from `ProfilePanel` and returns to the login screen.
11. Open the payment receipt → WhatsApp flow and confirm the intended parent's chat remains the primary action.
12. Test an installed-app update scenario while a non-destructive modal/form is open. Confirm the app does not interrupt active work.
13. Launch the app while offline. Confirm the shell loads as expected and that the UI clearly communicates when live Firebase data is unavailable.
14. Open the app on desktop and confirm the header, footer, sidebar, dashboard content, and interactions remain as before.

### Emulation (useful but limited)
- Chrome DevTools: breakpoint/layout and touch-target checks.
- Do **not** treat emulation as proof for safe-area inset rendering, real hardware vibration, native Share behaviour, or final PWA install/update UX.

---

## Implementation order

**1.** Baseline + PWA update check  
**2.** Mobile header/subheader relationship + spacing fix  
**3.** Safe areas + toast positioning + input zoom prevention  
**4.** Phone logout/install flow  
**5.** Kiosk haptics + overlay review  
**6.** Animation cleanup / native-feel polish  
**7.** Optional splash / badge work

The target is not “make the web page look mobile.” The target is a stable phone-first operational shell that feels app-like without breaking attendance, payments, authentication, or the unchanged desktop experience.
