<script lang="ts">
  import { onDestroy } from "svelte";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import { MemeCooking, wallet } from "$lib/near";

  // page data
  let { meme_id } = $page.params as { meme_id: string };

  const { accountId$ } = wallet;

  let interval: number;
  function retryPromise<T>(
    fn: () => Promise<T>,
    retry: number = 10,
  ): Promise<T> {
    return new Promise((resolve) => {
      interval = setInterval(async () => {
        const result = await fn();
        retry--;
        if (result || retry === 0) {
          clearInterval(interval);
          resolve(result);
        }
      }, 1000) as unknown as number;
    });
  }

  onDestroy(() => {
    clearInterval(interval);
  });

  let meme = retryPromise(
    () =>
      client
        .GET("/meme/{id}", {
          params: {
            query: {
              accountId: $accountId$,
            },
            path: { id: meme_id },
          },
        })
        .then((res) => {
          console.log("[meme]", res.data);
          return res.data;
        }),
    20,
  );
  let required_stake = MemeCooking.requiredStake(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
  );
</script>

<div class="mt-10 w-full p-2">
  <div class="mx-auto flex">
    <a href="/board" class="text-white text-2xl mx-auto mb-10">[go back]</a>
  </div>
  {#await Promise.all([meme, required_stake])}
    <div class="w-full text-center text-2xl">Loading...</div>
  {:then [detail, required_stake]}
    {#if detail}
      <MemeDetail meme={detail.meme} {required_stake} />
    {:else}
      <div>Meme not found</div>
    {/if}
  {:catch error}
    <div>Error: {error.message}</div>
  {/await}
</div>
