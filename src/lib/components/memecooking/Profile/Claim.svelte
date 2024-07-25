<script lang="ts">
  import type { paths } from "$lib/api/openapi";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let claim: paths["/profile/{accountId}"]["get"]["responses"]["200"]["content"]["application/json"]["coins_held"][number];

  async function claiming() {
    const token_id = `${claim.symbol.toLowerCase()}-${claim.meme_id}.${import.meta.env.VITE_MEME_COOKING_CONTRACT_ID}`;
    try {
      await MemeCooking.claim(wallet, {
        token_ids: [token_id],
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="flex gap-4 items-start">
  <img
    src="{import.meta.env.VITE_IPFS_GATEWAY}/{claim.image}"
    alt="{claim.name} icon"
    class="rounded-lg w-24"
  />
  <div class="flex flex-col">
    <div class="">
      <h3 class="text-lg font-bold uppercase">{claim.symbol}</h3>
    </div>
    <div class="">
      <h4 class="text-md font-normal">{claim.name}</h4>
    </div>
    <div class="">{new FixedNumber(claim.balance, 24).format()}</div>
    <button class="" on:click={claiming}>[claim]</button>
  </div>
</div>
