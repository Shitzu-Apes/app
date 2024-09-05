<script lang="ts">
  export let twitterLink: string;
  export let telegramLink: string;
  export let website: string;
</script>

<div class="w-full flex items-center gap-2 text-gray-4">
  {#if twitterLink.startsWith("https://twitter.com/") || twitterLink.startsWith("https://x.com/")}
    <a
      href={twitterLink}
      class="hover:underline hover:font-bold"
      target="_blank"
      rel="noopener noreferrer"
    >
      [twitter]
    </a>
  {/if}
  {#if telegramLink.startsWith("https://t.me/")}
    <a
      href={telegramLink}
      class="hover:underline hover:font-bold"
      target="_blank"
      rel="noopener noreferrer"
    >
      [telegram]
    </a>
  {/if}
  {#if website.startsWith("https://")}
    <a
      href={website}
      class="hover:underline hover:font-bold"
      target="_blank"
      rel="noopener noreferrer"
    >
      [website]
    </a>
  {/if}
</div>
