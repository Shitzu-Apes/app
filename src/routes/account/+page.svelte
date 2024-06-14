<script lang="ts">
  import { writable } from "svelte/store";

  // import ShitzuFace from "$lib/assets/logo/shitzu.webp";
  import Near from "$lib/assets/Near.svelte";
  import Squircle from "$lib/components/Squircle.svelte";
  import { Pool, wallet } from "$lib/near";
  import {
    primaryNftTokenId,
    refreshPrimaryNftOf,
    // refreshShitzuBalance,
    resolvedPrimaryNftTokenId,
    // shitzuBalance,
  } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  const { accountId$ } = wallet;

  // $: refreshShitzuBalance($accountId$);

  $: {
    if ($accountId$) {
      refreshPrimaryNftOf($accountId$);
    }
  }

  let stake$ = writable<FixedNumber | undefined>();

  $: fetchStake($accountId$);
  async function fetchStake(accountId?: string) {
    if (accountId == null) {
      $stake$ = undefined;
      return;
    }
    const account = await Pool.getAccount(accountId);
    stake$.set(new FixedNumber(account.staked_balance, 24));
  }

  $: accountData = [
    {
      title: "Shitstars",
      value: $primaryNftTokenId.then((token) =>
        token ? token.score.format() : "None",
      ),
      icon: {
        type: "icon",
        cls: "i-mdi:stars",
      },
    },
    {
      title: "Primary NFT",
      value: $primaryNftTokenId.then((token) =>
        token ? `#${token.token_id}` : "None",
      ),
      icon: undefined,
    },
    {
      title: "Staked",
      value: $stake$ ? $stake$.format() : "None",
      icon: {
        type: "near",
      },
    },
  ];
</script>

<div class="flex flex-col w-full">
  <div
    class="flex flex-col gap-2 justify-center items-center rounded-xl p-2 w-full"
  >
    <div class="relative">
      <Squircle
        class="size-30 text-lime flex-1"
        src={$resolvedPrimaryNftTokenId
          ? `${
              import.meta.env.VITE_NFT_BASE_URL
            }/${$resolvedPrimaryNftTokenId.token_id}.png`
          : ""}
      />
      <div class="absolute bottom-0 left-0 right-0 flex justify-center">
        <div class="bg-lime text-black text-xs px-1 py-0.5 rounded-full">
          <div class="flex items-center gap-1">
            <div class="i-mdi:pencil size-4" />
            Switch
          </div>
        </div>
      </div>
    </div>
    <h2 class="not-prose text-2xl font-bold">
      <div>
        {$accountId$}
      </div>
    </h2>
  </div>

  <ul class="w-full flex flex-wrap justify-between not-prose">
    {#each accountData as data}
      <li
        class="flex flex-col justify-center items-center min-w-[33%] border-r border-lime last:border-transparent"
      >
        <div class="flex items-center justify-center gap-1 font-bold">
          {#if data.icon}
            <div class="flex items-center size-5">
              {#if data.icon.type === "near"}
                <Near className="w-full h-full" />
              {:else if data.icon.type === "icon"}
                <div class="{data.icon.cls} w-full h-full" />
              {/if}
            </div>
          {/if}
          {#if typeof data.value === "string"}
            {data.value}
          {:else}
            {#await data.value}
              <div class="i-svg-spinners:pulse-3 size-4" />
            {:then resolvedValue}
              {resolvedValue}
            {/await}
          {/if}
        </div>
        <div class="text-sm flex items-center gap-2">
          <div>{data.title}</div>
        </div>
      </li>
    {/each}
  </ul>
</div>
