<div class="body">
  <slot />
</div>

<style lang="scss">
  .body {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    max-width: min(100vw, 24rem);
    overflow-y: auto;
    flex: 1 1 auto;
    padding: 1.8rem 0.8rem;
    margin: 0 auto;

    :global(> *) {
      max-width: min(100%, 50rem);
    }
  }
</style>
