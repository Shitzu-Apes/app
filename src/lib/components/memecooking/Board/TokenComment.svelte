<script lang="ts">
  let height: number = 0;
  export let id: number;
</script>

<div class="h-full" bind:clientHeight={height}>
  <script
    async
    src="https://telegram.org/js/telegram-widget.js?22"
    data-telegram-discussion="memecookingkitchen/{30 + id}"
    data-height={height}
    data-comments-limit="10"
    data-colorful="1"
    data-color="31c891"
    data-dark="1"
    data-dark-color="31c891"
  ></script>
</div>
