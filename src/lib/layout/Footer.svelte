<script lang="ts">
  import { mdiGithub, mdiTwitter } from "@mdi/js";
  import { Icon } from "@smui/common";

  import { BuiltOnNear, Telegram } from "$lib/assets";
</script>

<div class="footer">
  <div class="links">
    <a href="https://near.org/" target="_blank" rel="noopener">
      <BuiltOnNear style="height: 1rem;" />
    </a>
    <a href="https://github.com/Protocol-Pawns" target="_blank" rel="noopener">
      <Icon tag="svg" viewBox="0 0 24 24" style="height: 1rem;">
        <path fill="currentColor" d={mdiGithub} />
      </Icon>
    </a>
    <a href="https://twitter.com/ProtocolPawns" target="_blank" rel="noopener">
      <Icon tag="svg" viewBox="0 0 24 24" style="height: 1rem;">
        <path fill="currentColor" d={mdiTwitter} />
      </Icon>
    </a>
    <a href="https://t.me/protocolpawns" target="_blank" rel="noopener">
      <Telegram style={`height: ${12 / 16}rem`} />
    </a>
  </div>
</div>

<style lang="scss">
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-width: 100%;
    max-width: 100%;
    padding: 0.4rem 0.6rem;
  }

  .links {
    display: flex;
    align-items: center;
    gap: to-rem(7px);

    a {
      display: flex;
      color: rgba(255, 255, 255, 0.6);
    }
  }
</style>
