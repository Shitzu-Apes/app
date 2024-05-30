<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";

  import { view } from "$lib/near/utils";

  let ranking = view<[number, string[]][]>(
    "rewarder.test.near",
    "get_leaderboard",
    {
      limit: null,
    },
  ).then((ranking) => {
    // the ranking is already sorted
    // we just need to flatten the array
    return ranking.flatMap(([score, accounts]) =>
      accounts.map((account) => ({
        account,
        score: new FixedNumber(score.toString(), 24),
      })),
    );
  });
</script>

<div class="w-full flex flex-col -mt-1">
  <div class="not-prose">
    {#await ranking}
      <p>Loading...</p>
    {:then ranking}
      <ol
        class="w-full bg-gradient-to-b bg-gradient-from-lime bg-gradient-to-emerald rounded-b-2xl py-3"
      >
        <!-- First place -->
        <li class="flex flex-col items-center">
          <div class="relative mb-4">
            <img
              class="size-28 rounded-full border-3 border-amber"
              src={`https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/${ranking[0].account}.png`}
              alt="avatar"
            />
            <div
              class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-amber text-black text-center rounded-full size-7 font-bold flex justify-center items-center"
            >
              1
            </div>
          </div>

          <div class="font-light text-lg text-black">root.near</div>
          <div class="font-bold text-lg text-black">
            {ranking[0].score.format()}
          </div>
        </li>

        <!-- Second place -->
        <div class="w-full flex justify-between px-4 -mt-14">
          <li class="flex flex-col items-center">
            <div class="relative mb-4">
              <img
                class="size-24 rounded-full border-3 border-coolgray"
                src={`https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/437.png`}
                alt="avatar"
              />
              <div
                class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-coolgray text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
              >
                2
              </div>
            </div>

            <div class="font-light text-lg text-black text-sm">root.near</div>
            <div class="font-bold text-lg text-black text-sm">
              {ranking[0].score.format()}
            </div>
          </li>

          <!-- Third Place -->
          <li class="flex flex-col items-center">
            <div class="relative mb-4">
              <img
                class="size-24 rounded-full border-3 border-red"
                src={`https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/123.png`}
                alt="avatar"
              />
              <div
                class="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-red text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
              >
                3
              </div>
            </div>

            <div class="font-light text-lg text-black text-sm">root.near</div>
            <div class="font-bold text-lg text-black text-sm">
              {ranking[0].score.format()}
            </div>
          </li>
        </div>
      </ol>
      <ol class="mt-5 flex flex-col border-2 border-lime rounded-xl">
        {#each [{ account: "555", score: new FixedNumber("1000000000000000000000000", 24) }, { account: "666", score: new FixedNumber("1000000000000000000000000", 24) }, { account: "777", score: new FixedNumber("1000000000000000000000000", 24) }, { account: "888", score: new FixedNumber("1000000000000000000000000", 24) }, { account: "999", score: new FixedNumber("1000000000000000000000000", 24) }] as { account, score }, i (account)}
          <li
            class="flex justify-center items-center text-white py-3 px-3 border-b border-lime last:border-none"
          >
            <div class="mr-3">
              <img
                class="size-12 rounded-full border-2 border-lime"
                src={`https://bafybeifqejvrnlzraceyapuzne6d2cl2s5bolosrufpwp3lw22pqfcafo4.ipfs.nftstorage.link/${account}.png`}
                alt="avatar"
              />
              <!-- Show number of position at the bottom center of the image -->
            </div>

            <div>
              <div class="font-light text-lg">root.near</div>
              <div class="font-bold text-base">
                {score.format()}
              </div>
            </div>

            <div
              class="ml-auto text-2xl flex justify-center items-center bg-lime size-5 text-black rounded-full text-sm font-bold"
            >
              {i + 4}
            </div>
          </li>
        {/each}
      </ol>
    {:catch error}
      <p>{error.message}</p>
    {/await}
  </div>
</div>
