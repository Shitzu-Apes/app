<svelte:options accessors />

<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { derived, writable } from "svelte/store";

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
  on:input={onInputChange}
  on:change={(event) => formatWithMaxDecimals(event, decimals)}
  class:readonly
  autocomplete="off"
/>

<style lang="scss">
  input {
    width: var(--width, unset);
    flex: var(--flex, unset);
    font-size: var(--font-size, unset);

    &.readonly {
      cursor: default;
    }
  }
</style>
