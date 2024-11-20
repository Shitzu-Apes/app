<script lang="ts">
  import { PUBLIC_TWITTER_CLIENT_ID } from "$env/static/public";

  const TWITTER_CLIENT_ID = PUBLIC_TWITTER_CLIENT_ID;
  const REDIRECT_URI =
    import.meta.env.VITE_MEME_COOKING_API + "/auth/x-callback";

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
    sessionStorage.setItem("code_verifier", codeVerifier);
    document.cookie = `code_verifier=${codeVerifier}; path=/;`;
    console.log("code_verifier", document.cookie);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: "tweet.read users.read offline.access",
      state: "state",
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
>
  <div class="i-mdi:twitter text-xl" />
  Sign in with X
</button>
