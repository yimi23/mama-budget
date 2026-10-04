import { defineConfig } from 'wxt';

// Loaded unpacked into your own Chrome (logged into Amazon), so WXT does not launch a browser.
export default defineConfig({
  // Visible folder (not .output) so Load unpacked can find it in Finder.
  outDir: 'build',
  webExt: { disabled: true },
  manifest: {
    name: 'Mama Budget',
    description: 'Mama sits in your cart. Rice, she says nothing. AirPods, she asks what for.',
    permissions: ['storage', 'offscreen'],
    host_permissions: ['http://localhost:8787/*'],
    // Her faces load as <img> inside the shadow root on store pages.
    web_accessible_resources: [{ resources: ['faces/*/*.svg'], matches: ['<all_urls>'] }],
  },
});
