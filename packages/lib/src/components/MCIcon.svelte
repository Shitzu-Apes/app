<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import SHITZU_GLASSES from "$lib/assets/static/shitzu_not_found.png";

  export let meme: Pick<Meme, "image" | "name">;
  export let imageClass: string | undefined = undefined;

  let className: string = "";
  let imgSrc = `${import.meta.env.VITE_IPFS_GATEWAY}/${meme.image}`;
  let hasTriedOriginal = false;
  const fallbackImage = SHITZU_GLASSES; // Fallback image path

  export { className as class };
</script>

<img
  src={imgSrc}
  class={`${className} ${imageClass || ""}`}
  alt={meme.name}
  on:error={() => {
    if (!hasTriedOriginal && meme.image) {
      // First try the original image URL
      hasTriedOriginal = true;
      imgSrc = meme.image;
    } else {
      // If both IPFS and original fail, use fallback
      imgSrc = fallbackImage;
    }
  }}
/>
