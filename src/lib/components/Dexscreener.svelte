<script lang="ts">
  import { ModalContent } from "$lib/layout";
</script>

<ModalContent header="Shitzu Price Chart">
  <div id="dexscreener-embed">
    <iframe
      src="https://dexscreener.com/near/refv1-4369?embed=1&theme=dark"
      title="Shitzu Chart"
    ></iframe>
  </div>
</ModalContent>

<style>
  #dexscreener-embed {
    position: relative;
    width: 100%;
    padding-bottom: 125%;
  }
  @media (min-width: 1400px) {
    #dexscreener-embed {
      padding-bottom: 65%;
    }
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
