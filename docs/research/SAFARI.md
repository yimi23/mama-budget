# Safari port: what the research found (Oct 7 2026)

Sources: WXT docs (target browsers, publishing, ES modules), Apple developer docs (packaging, optimizing, permissions,
running, distributing, App Store Connect packager), MDN browser-compat-data, WebKit blog (iOS video policies, Safari 26).

## Facts that shape the build
- `wxt build -b safari --mv3` exists; output is `build/safari-mv3`. WXT builds nothing native: Apple's packager wraps
  the folder in a Mac or iOS app. Apple renamed the tool to `xcrun safari-web-extension-packager` (same flags).
- Background service worker: supported since Safari 15.4 on Mac and iOS. `storage.session` since 16.4.
- `chrome.offscreen` and `chrome.tts` do not exist in Safari. Audio has to play from the content script (shadow UI)
  or the popup; on iOS it must start inside a tap handler. Web Speech `speechSynthesis` works for the browser-voice fallback.
- Host permissions do not apply to content scripts in Safari MV3: a content script fetching our API fails page CORS,
  and an https store page cannot call `http://localhost`. Every API call already goes through the worker (CLAUDE.md
  rule), so only the platform cart JSON fetch (same origin) stays in the content script. Fine.
- `<all_urls>` is granted per site, on demand: Safari badges the extension and the user picks one use, one day or all
  sites. Apple's words: only use it when there is no other option. She is on every store, so there is no other option,
  but the first-run copy must tell the person what the badge prompt will say.
- Updates: `update_url` is ignored; a new build is a new wrapper-app version through App Store review.
- iOS: popups and service workers work; background must be non-persistent; `webRequest`, `contextMenus`, `windows.*`
  are unavailable. An iOS extension ships only inside an App Store app.
- Review path needs an Apple Developer Program account ($99 a year). Mac can also go Developer ID + notarized outside
  the Mac App Store. Without a Mac at hand, App Store Connect's Xcode Cloud "Safari Web Extension Packager" takes a zip.
- Safari 26 Developer menu has "Add Temporary Extension" to load the build folder with no Xcode at all.

## What we built from this
- `wxt.config.ts` takes the function form: for Safari the manifest drops `offscreen` and `tts`, and the worker's
  audio path falls back to the content script player when `browser.offscreen` is missing (already a flagged fallback).
- `npm run build:safari` produces `apps/extension/build/safari-mv3`; `docs/SAFARI.md` holds the packaging commands.

## Commands (Mac with Xcode 26)
```bash
cd apps/extension
npm run build:safari
xcrun safari-web-extension-packager build/safari-mv3 \
  --app-name "Mama Budget" --bundle-identifier com.mamabudget.safari \
  --swift --copy-resources --force --project-location ../safari
# Xcode opens: set the Team on the app and the extension targets, Cmd+R.
# Safari > Settings > Developer > Allow unsigned extensions, then Settings > Extensions > tick Mama Budget.
# iOS later: xcrun safari-web-extension-packager build/safari-mv3 --rebuild-project ../safari/"Mama Budget" --ios-only
```
