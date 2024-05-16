<script lang="ts">
  export let inline = false;
  export let absolute = false;
  export let padding: number | undefined = undefined;

  export let width: number | null = null;
  export let height: number | null = null;
  export let borderWidth = 7;

  const fontSize = 16;
</script>

<div class="wrapper" class:absolute class:inline>
  <div
    class="progress-spinner"
    style:width={padding ? "auto" : width ? `${width / fontSize}rem` : null}
    style:height={padding
      ? `calc(100% - 2 * ${padding / fontSize}rem)`
      : height
        ? `${height / fontSize}rem`
        : null}
    style:border={`${borderWidth / fontSize}rem solid transparent`}
  />
</div>

<style lang="scss">
  .progress-spinner {
    width: to-rem(80px);
    height: to-rem(80px);
    border-radius: 50%;
    animation: rotate 800ms linear infinite;
    aspect-ratio: 1 / 1;
    border-top-color: var(--spinner-border-top, rgba(0, 0, 0, 0.6)) !important;
  }

  .wrapper {
    display: flex;
    width: var(--spinner-width, 100%);
    max-height: 100%;
    align-items: center;
    justify-content: var(--spinner-justify-content, center);

    &:not(.inline):not(.absolute) {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      z-index: 100;
      background-color: rgba(0, 0, 0, 0.3);
    }

    &.absolute {
      z-index: 1;
      position: absolute;
      top: var(--spinner-top, 0);
      left: var(--spinner-left, 0);
      height: 100%;
    }
  }

  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
