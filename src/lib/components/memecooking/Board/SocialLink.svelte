<script lang="ts">
  import XOauthButton from "$lib/components/XOauthButton.svelte";

  export let twitterLink: string;
  export let telegramLink: string;
  export let website: string;
</script>

<div class="">
  <div class="flex flex-col gap-4">
    {#if twitterLink && (twitterLink.startsWith("https://twitter.com/") || twitterLink.startsWith("https://x.com/"))}
      <div class="flex items-center gap-1">
        <span class="w-6 flex justify-center flex-shrink-0">
          <div class="i-mdi:twitter text-memecooking-400" />
        </span>
        <span class="text-memecooking-400 text-sm font-medium">𝕏:</span>
        <a
          href={twitterLink}
          class="text-blue-400 underline text-sm hover:text-shitzu-4 truncate"
          target="_blank"
          rel="noopener noreferrer"
        >
          {twitterLink.replace(/https:\/\/(twitter|x)\.com\//, "")}
        </a>
        <XOauthButton />
      </div>
    {/if}

    {#if telegramLink && telegramLink.startsWith("https://t.me/")}
      <div class="flex items-center gap-1">
        <span class="w-6 flex justify-center flex-shrink-0">
          <div class="i-mdi:telegram text-memecooking-400" />
        </span>
        <span class="text-memecooking-400 text-sm font-medium">TG:</span>
        <a
          href={telegramLink}
          class="text-blue-400 underline text-sm hover:text-shitzu-4 truncate"
          target="_blank"
          rel="noopener noreferrer"
        >
          {telegramLink.replace("https://t.me/", "")}
        </a>
      </div>
    {/if}

    {#if website && website.startsWith("https://")}
      <div class="flex items-center gap-1">
        <span class="w-6 flex justify-center flex-shrink-0">
          <div class="i-mdi:web text-memecooking-400" />
        </span>
        <span class="text-memecooking-400 text-sm font-medium">Web:</span>
        <a
          href={website}
          class="text-blue-400 underline text-sm hover:text-shitzu-4 truncate"
          target="_blank"
          rel="noopener noreferrer"
        >
          {website.replace("https://", "")}
        </a>
      </div>
    {/if}
  </div>
</div>
