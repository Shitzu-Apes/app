<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { z } from "zod";

  export let label: string;
  export let value: string = "";
  export let placeholder: string = "";
  export let schema: z.ZodType<string>;
  export let validateOnInput: boolean = false;

  const dispatch = createEventDispatcher();

  let inputElement: HTMLInputElement;
  let error: string | null = null;

  function validate() {
    const result = schema.safeParse(value);
    if (!result.success) {
      error = result.error.errors[0].message;

      dispatch("validate", { isValid: false, error });
      return false;
    }
    error = null;
    dispatch("validate", { isValid: true, error: null });
    return true;
  }

  function handleInput() {
    if (validateOnInput) {
      validate();
    }
    dispatch("input", value);
  }

  function handleBlur() {
    validate();
    dispatch("blur", value);
  }
</script>

<div class="space-y-2">
  <label for={label} class="block text-sm text-shitzu-4 font-600">
    {label}
  </label>
  <div
    class="w-full flex items-center gap-3 px-2 relative bg-gray-800 rounded border {error
      ? 'border-red-500'
      : 'border-white'}"
  >
    <slot name="icon"></slot>
    <input
      id={label}
      type="text"
      bind:value
      bind:this={inputElement}
      on:input={handleInput}
      on:blur={handleBlur}
      {placeholder}
      autocomplete="off"
      class="flex-1 py-2 bg-transparent text-white outline-none"
    />
  </div>
  {#if error}
    <div
      class="bg-red-300 text-black text-xs px-2 rounded-full w-fit flex items-center gap-1 py-0.5"
    >
      <div class="size-4 i-mdi:alert-circle bg-red-600" />
      {error}
    </div>
  {/if}
</div>
