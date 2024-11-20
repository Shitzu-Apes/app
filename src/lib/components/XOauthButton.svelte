<script lang="ts">
  import { PUBLIC_TWITTER_CLIENT_ID } from "$env/static/public";
  import type { Meme } from "$lib/api/client";

  const TWITTER_CLIENT_ID = PUBLIC_TWITTER_CLIENT_ID;
  const REDIRECT_URI =
    import.meta.env.VITE_MEME_COOKING_API + "/auth/x-callback";

  export let meme: Meme;

  async function generateCodeChallenge(verifier: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function handleSignIn() {
    // Generate code verifier
    const array = new Uint32Array(56);
    crypto.getRandomValues(array);
    const codeVerifier = Array.from(array, (dec) =>
      ("0" + dec.toString(16)).substr(-2),
    ).join("");

    // Generate code challenge
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code verifier in sessionStorage
    document.cookie = `code_verifier=${codeVerifier}; path=/;`;

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "tweet.read users.read offline.access",
      state: meme.meme_id.toString(),
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    // Redirect to Twitter auth page
    window.location.href = `https://twitter.com/i/oauth2/authorize?${params}`;
  }
</script>

<button
  on:click={handleSignIn}
  class="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg font-medium transition-colors"
  aria-label={`Verify ${meme.symbol} with X (Twitter)`}
>
  <div class="i-mdi:check-decagram text-lg" />
  <span>Verify {meme.symbol}</span>
  <div class="i-mdi:twitter text-lg" />
  <span class="sr-only">with X (Twitter)</span>
</button>
