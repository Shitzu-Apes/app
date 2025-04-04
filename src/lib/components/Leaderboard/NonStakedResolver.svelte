<script lang="ts">
  import type { QueryObserverResult } from "@tanstack/svelte-query";
  import { onMount, createEventDispatcher } from "svelte";

  import { useNftTokensQuery } from "$lib/api/queries/nft";
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
  const nonStakedQueries = useNftTokensQuery({
    fromIndex: "0",
    limit: 1000,
  });

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
    queries: QueryObserverResult<NftToken[], Error>,
    tokenIds: string[],
  ): Record<string, string> {
    // Handle empty case
    if (!queries || !tokenIds.length) {
      return {};
    }

    // Process each query to extract data
    const tokenMap: Record<string, string> = {};

    // Safely extract data from each query
    queries.data?.forEach((query) => {
      try {
        if (query?.owner_id) {
          tokenMap[query.token_id] = query.owner_id;
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
