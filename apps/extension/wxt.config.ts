import { defineConfig } from 'wxt';

// Loaded unpacked into your own Chrome (logged into Amazon), so WXT does not launch a browser.
// Safari (`npm run build:safari`, then Apple's packager; docs/research/SAFARI.md): no offscreen document and no tts
// API exist there, so the manifest drops both and the worker hands audio to the content script instead.
export default defineConfig({
  // Visible folder (not .output) so Load unpacked can find it in Finder.
  outDir: 'build',
  webExt: { disabled: true },
  manifest: ({ browser }) => ({
    name: 'Mama Budget',
    description: 'Your weekly fun money, with someone in your cart who speaks before you pay, not after.',
    permissions: browser === 'safari' ? ['storage'] : ['storage', 'offscreen', 'tts'],
    host_permissions: ['http://localhost:8787/*', 'https://api.mamabudget.com/*'],
    // Her faces load as <img> inside the shadow root on store pages.
    web_accessible_resources: [{ resources: ['faces/*/*.svg'], matches: ['<all_urls>'] }],
  }),
});
