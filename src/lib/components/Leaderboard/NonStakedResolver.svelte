<script lang="ts">
  import type { QueryObserverResult } from "@tanstack/svelte-query";
  import { onMount, createEventDispatcher } from "svelte";

  import { useNftTokenQueries } from "$lib/api/queries/nft";
  import type { NftToken } from "$lib/near/nft";

  // Define the expected props
  export let nonStakedTokenIds: string[] = [];

  // Set up event dispatcher for when the resolved data is ready
  const dispatch = createEventDispatcher<{
    resolved: Record<string, string>;
  }>();

  // Track loaded status
  let isLoaded = false;

  // Query non-staked NFT tokens
  $: nonStakedQueries = useNftTokenQueries(nonStakedTokenIds);

  // Process the non-staked token queries into a map of token ID to owner ID
  $: nonStakedTokenMap = createNonStakedMap(
    $nonStakedQueries,
    nonStakedTokenIds,
  );

  // When the map is ready, dispatch the resolved event
  $: if (nonStakedTokenMap && isLoaded) {
    dispatch("resolved", nonStakedTokenMap);
  }

  // Function to create a map of token ID to owner ID from queries
  function createNonStakedMap(
    queries: QueryObserverResult<NftToken, Error>[],
    tokenIds: string[],
  ): Record<string, string> {
    // Handle empty case
    if (!queries || !tokenIds.length) {
      return {};
    }

    // Process each query to extract data
    const tokenMap: Record<string, string> = {};

    // Safely extract data from each query
    queries.forEach((query) => {
      try {
        if (query?.data && query?.data?.owner_id) {
          tokenMap[query.data.token_id] = query.data.owner_id;
        }
      } catch (e) {
        console.error("Error processing query:", e);
      }
    });

    return tokenMap;
  }

  onMount(() => {
    isLoaded = true;
  });
</script>

<!-- This is a utility component with no UI -->
