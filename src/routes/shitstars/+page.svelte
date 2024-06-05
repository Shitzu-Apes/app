<script lang="ts">
  import { slide } from "svelte/transition";

  import { Button, Faq, Donation, Squircle } from "$lib/components";
  import { Nft } from "$lib/near";
  import { wallet } from "$lib/near";
  import { Rewarder } from "$lib/near/rewarder";
  import { primaryNftTokenId, refreshPrimaryNftOf } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  let ranking: Promise<
    { token_id: string; account_id: string; score: FixedNumber }[]
  > = Rewarder.getLeaderboard(10).then(async (ranking) => {
    const primaryNft = await $primaryNftTokenId;

    const nonStakedNfts: string[] = ranking
      .flatMap(([, account]) => {
        const nonStaked = account.filter(([, accountId]) => accountId === null);
        return nonStaked.map(([tokenId]) => tokenId);
      })
      .filter((tokenId) => tokenId !== null)
      .flat() as string[];

    const nonStakedTokens = await Promise.all(
      nonStakedNfts.map(async (tokenId) => {
        const owner = await Nft.nftToken(tokenId);
        return [tokenId, owner.owner_id];
      }),
    ).then((tokens) => {
      const tokenMap = tokens.reduce(
        (acc, [tokenId, accountId]) => {
          acc[tokenId] = accountId;
          return acc;
        },
        {} as Record<string, string>,
      );

      return tokenMap;
    });

    // the ranking is already sorted
    // we just need to flatten the array
    let isInRanking = false;
    const result = ranking
      .flatMap(([score, accounts]) =>
        accounts.map((account) => {
          const token_id = account[0];
          let account_id = account[1];

          if (account_id === null) {
            if (token_id in nonStakedTokens) {
              account_id = nonStakedTokens[token_id];
            } else {
              account_id = "Anonymous";
            }
          }

          if (token_id === primaryNft?.token_id) {
            account_id = "You";
            isInRanking = true;
          }

          return {
            token_id: account[0],
            account_id,
            score: new FixedNumber(score.toString(), 18),
          };
        }),
      )
      .slice(0, 10);

    if (!isInRanking && primaryNft) {
      result.push({
        token_id: primaryNft.token_id,
        account_id: "You",
        score: primaryNft.score,
      });
    }

    return result;
  });

  const { accountId$ } = wallet;

  $: {
    if ($accountId$) {
      refreshPrimaryNftOf($accountId$);
    }
  }
</script>

<div>
  <div class="w-full flex flex-col -mt-1">
    <div class="not-prose">
      {#await ranking}
        <div
          transition:slide
          class="flex items-center justify-center w-full h-xs"
        >
          <div class="i-svg-spinners:blocks-wave text-size-20 text-lime" />
        </div>
      {:then ranking}
        <ol
          transition:slide
          class="w-full bg-gradient-to-b bg-gradient-from-lime bg-gradient-to-emerald rounded-b-2xl py-3"
        >
          <div class="w-full flex justify-end">
            <a
              href="/account"
              class="text-black flex text-sm items-center mb-3 mr-3"
            >
              Participate{" "}
              <div class="i-mdi:arrow-right size-3" />
            </a>
          </div>
          <!-- First place -->
          <li class="flex flex-col items-center">
            <div class="relative mb-4">
              <Squircle
                src={"https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/" +
                  ranking[0].token_id +
                  ".png"}
                class="text-amber size-34"
              />
              <div
                class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-amber text-black text-center rounded-full size-7 font-bold flex justify-center items-center"
              >
                1
              </div>
            </div>

            <div
              class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
            >
              {ranking[0].account_id}
            </div>
            <div
              class="font-bold text-lg bg-amber rounded-full px-2 mt-2 text-black flex items-center gap-1"
            >
              <div class="i-mdi:stars size-6" />
              {ranking[0].score.format()}
            </div>
          </li>

          <!-- Second place -->
          <div class="w-full flex justify-between px-2 -mt-4">
            {#if ranking.length > 1}
              <li class="flex flex-col items-center">
                <div class="relative mb-4">
                  <Squircle
                    class="size-28 text-coolgray"
                    src="https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/{ranking[1]
                      .token_id}.png"
                  />
                  <div
                    class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-coolgray text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
                  >
                    2
                  </div>
                </div>

                <div
                  class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
                >
                  {ranking[1].account_id}
                </div>
                <div
                  class="font-bold text-lg bg-coolgray rounded-full px-2 mt-2 text-black flex items-center gap-1"
                >
                  <div class="i-mdi:stars size-6" />
                  {ranking[1].score.format()}
                </div>
              </li>
            {/if}

            {#if ranking.length > 2}
              <!-- Third Place -->
              <li class="flex flex-col items-center">
                <div class="relative mb-4">
                  <Squircle
                    class="size-28 text-red"
                    src="https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/{ranking[2]
                      .token_id}.png"
                  />
                  <div
                    class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-red text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
                  >
                    3
                  </div>
                </div>

                <div
                  class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
                >
                  {ranking[2].account_id}
                </div>
                <div
                  class="font-bold text-lg bg-red rounded-full px-2 mt-2 text-black flex items-center gap-1"
                >
                  <div class="i-mdi:stars size-6" />
                  {ranking[2].score.format()}
                </div>
              </li>
            {/if}
          </div>
        </ol>

        {#if ranking.length > 3}
          <ol
            class="mt-5 flex flex-col border-2 border-lime rounded-xl bg-black"
          >
            {#each ranking.slice(3) as { token_id, account_id, score }, i (account_id)}
              <li
                class="flex justify-center items-center text-white py-3 px-3 border-b border-lime last:border-none {account_id ===
                'You'
                  ? 'bg-lime/50'
                  : ''}"
              >
                <div class="mr-3">
                  <Squircle
                    class="size-18 text-lime"
                    src="https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/{token_id}.png"
                  />
                </div>

                <div class="max-w-[200px]">
                  <div class="font-light text-lg text-ellipsis overflow-hidden">
                    {account_id}
                  </div>
                  <div class="font-bold text-base flex items-center">
                    <div class="i-mdi:stars size-5 mr-1" />
                    {score.format()}
                  </div>
                </div>

                <div
                  class="ml-auto text-2xl flex justify-center items-center bg-lime size-5 text-black rounded-full text-sm font-bold"
                >
                  {i + 4 <= 10 ? i + 4 : "-"}
                </div>
              </li>
            {/each}
          </ol>
        {/if}

        <Button href="/account" class="mt-3">
          Stake & earn Shitstars now
          <div class="i-mdi:arrow-right size-6 ml-2" />
        </Button>
      {:catch error}
        <p>{error.message}</p>
      {/await}
    </div>
  </div>

  <Donation />
  <Faq
    qnas={[
      {
        question: "What is Shitstars?",
        answer:
          "Shitstars is a point and reputation system within the SHITZU ecosystem. It rewards users for their participation and contributions. The individual who earns the most Shitstars is also called the Shitstar.",
      },
      {
        question: "What is the relationship between Shitstars and NFTs?",
        answer:
          "Shitstars are attached to a single primary NFT, and remain attached even if the owner of the NFT changes.",
      },
      {
        question: "How are Shitstars earned?",
        answer:
          "Shitstars can be earned in three ways: Donating $SHITZU, Participating in Shitzu Boost, and Staking with Shitzu Pool.",
      },
      {
        question: "How do I get started with earning Shitstars?",
        answer:
          "To get started, you will need to acquire SHITZU Revival NFT, staked, and then follow the instructions for one of the three methods of earning Shitstars.",
      },
      {
        question: "How do I earn Shitstars through donation?",
        answer:
          "Donate SHITZU to rewards.0xshitzu.near and receive Shitstars equal to four times the donation amount.",
      },
      {
        question: "How do I earn Shitstars through Shitzu Boost?",
        answer:
          "Participate in Shitzu Boost and receive Shitstars equal to the Shitzu reward earned (x2 normal amount).",
      },
      {
        question: "How do I earn Shitstars through staking with Shitzu Pool?",
        answer:
          "Stake with the Shitzu pool and receive Shitstars equal to three times the Shitzu earned upon burning $DOGSHIT.",
      },
    ]}
  />
</div>
