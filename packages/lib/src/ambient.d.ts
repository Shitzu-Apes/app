/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />
/// <reference types="dayjs/plugin/duration" />

// Standalone type declarations for the SvelteKit virtual modules the lib uses.
// The apps generate these in .svelte-kit/ambient.d.ts; the lib checks on its own,
// so it needs its own copy. Values are strings at build time, per SvelteKit.
declare module "$env/static/private" {
  export const ACCOUNT_ID: string;
  export const ENDPOINT_SECRET: string;
  export const PINATA_JWT: string;
  export const PRIVATE_KEY: string;
  export const VITE_NETWORK_ID: string;
  export const VITE_NODE_URL: string;
  export const VITE_WRAP_NEAR_CONTRACT_ID: string;
}
