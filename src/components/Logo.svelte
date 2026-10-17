<script lang="ts">
  // LaPompe's hand pump, its lever in TonTuyau's teal (icons/lapompe.svg); the body follows the text's colour.
  let { size = 26 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <path
    d="M13 5.6c0-3.1 4.2-4 5.1-1.2l2.9 11.3c.3 1.3 2.2 1.1 2-.3"
    fill="none"
    stroke="var(--brand)"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
  <g fill="currentColor">
    <rect x="5.6" y="4.6" width="8.4" height="2.6" rx="1.2" />
    <rect x="7.3" y="6.6" width="5" height="12.6" rx=".4" />
    <rect x="6.2" y="10.4" width="7.2" height="2.2" rx="1.1" />
    <rect x="6.4" y="18.4" width="6.8" height="2.4" rx=".6" />
    <rect x="4.8" y="20.2" width="10" height="2.4" rx="1.2" />
    <rect x="1.6" y="11.6" width="3.1" height="1.3" rx=".65" />
  </g>
  <path
    d="M7.6 8.6H4.8c-1 0-1.7.7-1.7 1.7v1.6"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
