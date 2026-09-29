<script lang="ts">
  /**
   * The page container.
   *
   * `wide` is for a page that has something to do with the extra room. The default is
   * 28rem and stays that way: most of what this app shows is a feed, a list, or a form
   * that reads better narrow, and a wide column of text is worse, not better.
   *
   * The bridge is the exception, because it is not one column of reading — it is two
   * independent ends of a transfer, and side by side is how they are actually thought
   * about. It asks for the room explicitly rather than the cap being lifted globally.
   */
  export let wide = false;
</script>

<div
  class="flex flex-col justify-start items-start {wide
    ? 'max-w-[min(64rem,100%)]'
    : 'max-w-[min(28rem,100%)]'} w-screen overflow-y-auto flex-1 px-3 py-1 mx-auto"
>
  <slot />
</div>
