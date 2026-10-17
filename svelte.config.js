/** @type {import("@sveltejs/vite-plugin-svelte").SvelteConfig} */
export default {
  compilerOptions: {
    // Each component's markup built with createElement, not a <template>'s innerHTML: the same DOM, but Mozilla's
    // review flags any innerHTML assignment ("Unsafe assignment to innerHTML"), even Svelte's fixed markup.
    fragments: 'tree',
  },
}
