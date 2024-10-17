<script lang="ts">
  export let pool_id: string;
</script>

<div id="dexscreener-embed" class="flex-1">
  <iframe
    title="Dexscreener"
    src={`https://dexscreener.com/near/refv1-${pool_id}?embed=1&theme=dark&info=0&trades=1&chart=0`}
  ></iframe>
</div>

<style>
  #dexscreener-embed {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 300px;
  }
  #dexscreener-embed iframe {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    border: 0;
  }
</style>
