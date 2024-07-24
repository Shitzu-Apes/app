<script lang="ts">
  import type { paths } from "$lib/api/openapi";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let deposit: paths["/profile/{accountId}"]["get"]["responses"]["200"]["content"]["application/json"]["virtual_coins"][number];

  async function withdraw() {
    try {
      await MemeCooking.withdraw(wallet, {
        memeId: deposit.meme_id,
        amount: deposit.balance,
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="flex gap-4 items-center">
  <img
    src="{import.meta.env.VITE_IPFS_GATEWAY}/{deposit.image}"
    alt="{deposit.name} icon"
    class="rounded-lg size-24"
  />
  <div class="flex flex-col">
    <div class="">
      <h3 class="text-lg font-bold uppercase">{deposit.symbol}</h3>
    </div>
    <div class="">
      <h4 class="text-md font-normal">{deposit.name}</h4>
    </div>
    <div class="">{new FixedNumber(deposit.balance, 24).format()}</div>
    <button class="" on:click={withdraw}>[withdraw]</button>
  </div>
</div>
