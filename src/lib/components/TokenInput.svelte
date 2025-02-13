<svelte:options accessors />

<script lang="ts">
  import { derived, writable } from "svelte/store";

  import { FixedNumber } from "$lib/util";
  import {
    filterAllowedCharacters,
    formatWithMaxDecimals,
    getFormattedNumber,
    getNumberAsUInt128,
  } from "$lib/util";

  export let value: string | undefined = undefined;
  export let id: string | undefined = undefined;
  export let readonly = false;
  export let placeholder = "0.0";
  export let decimals: number | undefined;
  let className: string | undefined = undefined;
  export { className as class };
  export let style: string | undefined = undefined;
  // eslint-disable-next-line @typescript-eslint/ban-types
  export let afterInputChange: Function | undefined = undefined;

  const u128 = writable<FixedNumber | undefined>(undefined);
  export const u128$ = derived(u128, (val) => val);

  function onInputChange() {
    if (afterInputChange) {
      afterInputChange();
    }
  }

  $: if (value != null && decimals != null) {
    value = filterAllowedCharacters(value);
    let quantity = getFormattedNumber(value, decimals);
    const [res] = getNumberAsUInt128(quantity, decimals);
    u128.set(new FixedNumber(res, decimals));
  } else {
    u128.set(undefined);
  }
</script>

<input
  type="string"
  {id}
  bind:value
  {readonly}
  {placeholder}
  {style}
  on:input={onInputChange}
  on:change={(event) => formatWithMaxDecimals(event, decimals)}
  class:readonly
  autocomplete="off"
  class={className}
/>
