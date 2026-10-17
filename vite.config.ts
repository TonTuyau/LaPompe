import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vitest/config'

// The extension's pages: the popup (the toolbar button) and the settings page. The background and the content script
// are built apart, as single files (scripts/build.ts).
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  // Extension pages load their files by relative paths.
  base: './',
  build: {
    rollupOptions: { input: { popup: 'popup.html', options: 'options.html' } },
    // No data: URLs: an extension page's default Content-Security-Policy is strict.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    globals: true,
    restoreMocks: true,
  },
})
