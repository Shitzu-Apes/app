<div
  class="pointer-events-none absolute h-full w-full overflow-hidden opacity-50 [perspective:200px] -z-0"
>
  <div class="absolute inset-0 [transform:rotateX(35deg)]">
    <div
      class={[
        "animate-grid",

        "[background-repeat:repeat] [background-size:60px_60px] [height:600vh] [inset:0%_0px] [margin-left:-50%] [transform-origin:100%_0_0] [width:300vw]",

        "[background-image:linear-gradient(to_right,rgba(255,255,255,0.5)_1px,transparent_0),linear-gradient(to_bottom,rgba(255,255,255,0.5)_1px,transparent_0)]",
      ].join(" ")}
    />
  </div>
</div>

<style scoped>
  .animate-grid {
    animation: grid 15s linear infinite;
  }

  @keyframes grid {
    0% {
      transform: translateY(-50%);
    }
    100% {
      transform: translateY(0);
    }
  }
</style>
