<div
  class="mx-auto w-fit h-screen flex flex-col justify-center items-center gap-10 overflow-hidden"
>
  <h1
    class="text-6xl md:text-8xl text-center tracking-widest font-semibold text-white animate-shake-x animate-count-infinite px-3"
  >
    Coming <br />Soon
  </h1>

  <ul class="text-white">
    {#each ["Staking Price Discovery", "No Presale", "No Dev/Team Allocation", "DEX LP Locked", "0% Loss Pre-DEX Launch"] as item}
      <li class="flex items-center">
        <div class="i-mdi:check-circle size-5 text-shitzu-400 mr-2" />
        {item}
      </li>
    {/each}
  </ul>

  <a href="/" class="text-white text-xl"> [ Back ] </a>

  <div class="mt-6 w-full px-2 py-3 text-white">
    <div class="flex justify-center items-center max-w-lg">
      <div class="flex items-center gap-4">
        <a href="https://twitter.com/_funmeme" target="_blank" rel="noopener">
          [ twitter ]
        </a>
        <a href="https://t.me/+wIFBaPQJmAcwYTc0" target="_blank" rel="noopener">
          [ telegram ]
        </a>
      </div>
    </div>
  </div>
</div>
