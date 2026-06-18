# Improvement Log

## 2026-06-15 - Superadmin UI Stability
- Rebuilt the public role chooser as a stable four-card shadcn/ui surface with a lightweight Aceternity-style dot/grid background.
- Removed hover, swipe, pointer-move, and dimmed-card swapping that made the Superadmin entry feel shaky and intermittently unresponsive.
- Removed React Native animated layout measurement from the Superadmin master dashboard institution toggle and header.
- Changed the PWA service worker to fetch Expo bundles network-first and force no-cache service worker updates, preventing stale Superadmin shells from staying broken after deploy.
- Added a Superadmin Windows launcher download alongside the Android APK and made the desktop build script publish the EXE into public downloads.
- Added regression tests that block reintroducing pointer-driven role swapping or animated dashboard layout primitives.

## 2026-06-15 - Superadmin Subscriptions
- Added Basic, Pro, and Max plan presentation to institute subscription management.
- Added institute feature overrides with plan-vs-override source labels.
- Hardened frontend and backend entitlement resolution, including unknown-feature denial.
- Added loading, error, retry, usage-warning, and empty states for institute management.
- Added Superadmin EXE build script and Superadmin APK/EAS role profile wiring.
- Verified tests, typecheck, SSR build, touched-file lint, local browser route, and production route.
- Deployed production: https://shii-edu.vercel.app

## 2026-06-15 - Superadmin Role Entry
- Added Superadmin as a visible, installable role on the public role chooser.
- Fixed server-rendered `/app/superadmin` title and manifest metadata before client hydration.
- Added regression tests for Superadmin role visibility and shell metadata.
- Verified tests, typecheck, SSR build, targeted lint, local browser, and production browser.
- Deployed production: https://shii-edu.vercel.app
