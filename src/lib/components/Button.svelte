<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";
  import { P, match } from "ts-pattern";

  export let type: "primary" | "secondary" | "custom" = "primary";
  export let onClick: MouseEventHandler<HTMLButtonElement> | undefined =
    undefined;
  export let href: string | undefined = undefined;
  export let disabled: boolean | undefined = undefined;
  export let spinnerColor = "text-lime";

  let className: string = "";
  export { className as class };

  let loading = false;
</script>

{#if href != null}
  <a
    {href}
    class:rounded-xl={!className.includes("rounded") && type !== "custom"}
    class="{className} {match(type)
      .with('primary', () => 'bg-lime text-black hover:bg-lime/85')
      .with('secondary', () => 'bg-transparent text-lime hover:bg-lime/15')
      .with('custom', () => '')
      .exhaustive()} {match(type)
      .with(
        P.union('primary', 'secondary'),
        () =>
          'font-bold border-2 border-lime flex justify-center items-center decoration-none px-4 py-2 relative disabled:bg-gray-5 disabled:border-gray-5 disabled:cursor-not-allowed',
      )
      .with(
        'custom',
        () =>
          'relative disabled:bg-gray-5 disabled:border-gray-5 disabled:cursor-not-allowed',
      )
      .exhaustive()}"
  >
    <slot />
  </a>
{:else}
  <button
    on:click={async (event) => {
      if (!onClick) return;
      loading = true;
      try {
        await onClick(event);
      } catch (err) {
        console.error(err);
      } finally {
        loading = false;
      }
    }}
    disabled={disabled || loading}
    class:rounded-xl={!className.includes("rounded") && type !== "custom"}
    class="{className} {match(type)
      .with('primary', () => 'bg-lime text-black hover:bg-lime/85')
      .with('secondary', () => 'bg-transparent text-lime hover:bg-lime/15')
      .with('custom', () => '')
      .exhaustive()} {match(type)
      .with(
        P.union('primary', 'secondary'),
        () =>
          'font-bold border-2 border-lime flex justify-center items-center decoration-none px-4 py-2 relative disabled:bg-gray-5 disabled:border-gray-5 disabled:cursor-not-allowed',
      )
      .with(
        'custom',
        () =>
          'relative disabled:bg-gray-5 disabled:border-gray-5 disabled:cursor-not-allowed',
      )
      .exhaustive()}"
  >
    <slot />
    {#if loading}
      <div
        class="flex items-center justify-center absolute w-full h-full top-0 left-0"
      >
        <div class="i-svg-spinners:6-dots-rotate text-size-6 {spinnerColor}" />
      </div>
    {/if}
  </button>
{/if}
