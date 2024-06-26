<!-- 

<script
  async
  src="https://comments.app/js/widget.js?3"
  data-comments-app-website="v7gGUBF7"
  data-limit="5"
  data-page-id="/1"
></script> -->

<script lang="ts">
  let height: number = 0;
  export let id: number;
</script>

<div class="h-full" bind:clientHeight={height}>
  <script
    async
    src="https://comments.app/js/widget.js?3"
    data-comments-app-website="v7gGUBF7"
    data-limit="10"
    data-height={height}
    data-page-id="/{id}"
    data-color="31C891"
    data-dark="1"
  ></script>
</div>
