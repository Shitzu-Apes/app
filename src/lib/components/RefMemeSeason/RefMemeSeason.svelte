<script lang="ts">
  import Faq from "../Faq.svelte";

  import Claim from "./Claim.svelte";
  import RefLpInfo from "./RefLPInfo.svelte";

  import SHITZU_ICON from "$lib/assets/logo/shitzu.webp";
  import XREF_ICON from "$lib/assets/logo/xref.svg";
  import {
    MemeFarmXRefShitzu,
    MemeFarmShitzu,
    LPFarm,
    Ref,
    MemeSeason,
  } from "$lib/near";
  import { wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const { accountId$ } = wallet;

  $: xRefStaked = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    MemeFarmXRefShitzu.getFarmerSeed(
      $accountId$,
      "xtoken.ref-finance.near",
    ).then((seed) => {
      if (seed) {
        resolve(new FixedNumber(seed.free_amount, 18));
      } else {
        resolve(new FixedNumber("0", 18));
      }
    });
  }) as Promise<FixedNumber>;

  $: shitzuStaked = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    MemeFarmShitzu.getFarmerSeed($accountId$, "token.0xshitzu.near").then(
      (seed) => {
        if (seed) {
          resolve(new FixedNumber(seed.free_amount, 18));
        } else {
          resolve(new FixedNumber("0", 18));
        }
      },
    );
  }) as Promise<FixedNumber>;

  $: RefShitzuNearPool = Ref.getPool(4369);

  $: lpFarm = new Promise((resolve, reject) => {
    if (!$accountId$) {
      reject();
      return;
    }
    LPFarm.getFarmerSeed($accountId$, "v2.ref-finance.near@4369").then(
      (seed) => {
        if (seed) {
          resolve(new FixedNumber(seed.free_amount, 24));
        } else {
          resolve(new FixedNumber("0", 24));
        }
      },
    );
  }) as Promise<FixedNumber>;

  $: checkpointMilliSec = new Promise((resolve) => {
    if (!$accountId$) {
      resolve(null);
      return;
    }

    MemeSeason.getUserCheckpoint($accountId$).then((checkpoint) => {
      if (checkpoint) {
        console.log("get checkpoint", checkpoint);
        resolve(~~(+checkpoint / 1_000_000_000));
      } else {
        resolve(null);
      }
    });
  }) as Promise<number | null>;

  $: claimable = Promise.all([xRefStaked, shitzuStaked, lpFarm]).then(
    ([xRef, shitzu, lp]) => {
      const xref_shitstars = Math.min(200, 100 + Math.sqrt(xRef.toNumber()));
      const shitzu_shitstars = Math.min(
        100,
        50 + Math.sqrt(shitzu.toNumber()) / 5,
      );
      const lp_shitstars = Math.min(100, 50 + Math.sqrt(lp.toNumber()) / 0.01);

      return xref_shitstars + shitzu_shitstars + lp_shitstars;
    },
  );
</script>

<section>
  <h2>Ref Finance</h2>

  <div
    class="bg-gradient-to-t bg-gradient-from-[#0f687f] bg-gradient-to-[#18546d] text-light rounded-xl py-4 px-3 not-prose"
  >
    <div class="w-full flex justify-between">
      <div>
        <h3 class="flex items-center text-lg">Staked</h3>
        <a
          href="https://app.ref.finance/meme"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center text-sm text-gray-300"
        >
          Participate
          <div class="i-mdi:arrow-top-right size-4" /></a
        >
      </div>

      <div class="min-h-16 text-right">
        <div class="flex justify-end">
          {#await xRefStaked}
            <div class="i-svg-spinners:pulse" />
          {:then value}
            <div class="font-600 flex items-center gap-1">
              <img src={XREF_ICON} alt="XREF" class="size-5" />
              {value.format()}
            </div>
          {/await}
        </div>
        <div class="w-full flex justify-end">
          {#await shitzuStaked}
            <div class="i-svg-spinners:pulse" />
          {:then value}
            <div class="font-600 flex items-center gap-1">
              <img src={SHITZU_ICON} alt="SHITZU" class="size-5" />
              {value.format()}
            </div>
          {/await}
        </div>
      </div>
    </div>

    <div class="w-full min-h-16">
      <div class="w-full flex justify-between">
        <div>
          <h3 class="flex items-center text-lg">LP</h3>
          <a
            href="https://app.ref.finance/v2farms/4369-r"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center text-sm text-gray-300"
          >
            Participate
            <div class="i-mdi:arrow-top-right size-4" /></a
          >
        </div>
        {#await Promise.all([lpFarm, RefShitzuNearPool])}
          <div class="i-svg-spinners:pulse" />
        {:then [lpShare, poolInfo]}
          <RefLpInfo {poolInfo} share={lpShare} />
        {/await}
      </div>
      {#await Promise.all([checkpointMilliSec, claimable])}
        <div
          class="w-full h-12 py-3 bg-coolgray text-lime rounded-lg mt-6 animate-pulse"
        />
      {:then [checkpoint, claimable]}
        <Claim
          on:claimed={() => {
            checkpointMilliSec = new Promise((resolve) => {
              console.log("on claimed");
              resolve(Date.now() + 24 * 60 * 60 * 1_000);
            });
          }}
          {checkpoint}
          {claimable}
        />
      {/await}
    </div>
  </div>

  <Faq
    qnas={[
      {
        question: "How are Shitstars calculated for XREF staking?",
        answer:
          "For XREF staking, everyone starts with a base of 100 Shitstars. You can earn up to 100 additional Shitstars, calculated as the minimum between 100 and the square root of your XREF stake.",
      },
      {
        question: "How are Shitstars calculated for Shitzu staking?",
        answer:
          "For Shitzu staking, everyone starts with a base of 50 Shitstars. You can earn up to 50 additional Shitstars, calculated as the minimum between 50 and the square root of your Shitzu stake divided by 5.",
      },
      {
        question: "How are Shitstars calculated for LP staking?",
        answer:
          "For LP staking, everyone starts with a base of 50 Shitstars. You can earn up to 50 additional Shitstars, calculated as the minimum between 50 and the square root of your LP stake divided by 0.01.",
      },
    ]}
  />
</section>
