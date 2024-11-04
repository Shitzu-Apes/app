<script lang="ts">
  export let number: number;
  export let totalDigits: number;

  $: absNumber = Math.abs(number);
  $: integerPartLength = Math.floor(absNumber).toString().length;

  $: formattedNumber = (() => {
    // Handle small numbers with many leading zeros
    if (absNumber > 0 && absNumber < 0.00001) {
      const numStr = absNumber.toString();
      const match = numStr.match(/0\.0+/);
      if (match) {
        const zeroCount = match[0].length - 2; // Subtract 2 for "0."
        const significantDigits = numStr.slice(match[0].length);
        return {
          prefix: "0.0",
          zeroCount,
          suffix: significantDigits,
          needsSubscript: true,
        };
      }
    }

    if (integerPartLength <= totalDigits) {
      // Format the number to have a fixed total number of digits
      const digitsAfterDecimal = totalDigits - integerPartLength;
      const factor = Math.pow(10, digitsAfterDecimal);
      return Math.floor(number * factor) / factor;
    } else {
      // Use SI notation
      const SI_PREFIXES = [
        { value: 1e12, symbol: "T" },
        { value: 1e9, symbol: "G" },
        { value: 1e6, symbol: "M" },
        { value: 1e3, symbol: "k" },
        { value: 1, symbol: "" },
      ];

      // Find the appropriate SI prefix
      for (let i = 0; i < SI_PREFIXES.length; i++) {
        if (absNumber >= SI_PREFIXES[i].value) {
          const scaled = number / SI_PREFIXES[i].value;
          const scaledAbs = Math.abs(scaled);
          const scaledIntegerLength = Math.floor(scaledAbs).toString().length;
          const digitsAfterDecimal = totalDigits - scaledIntegerLength;
          const factor = Math.pow(10, digitsAfterDecimal);

          // Adjust factor for numbers with decimal part
          const formatted = Math.floor(scaled * factor) / factor;
          return formatted + SI_PREFIXES[i].symbol;
        }
      }
    }
    return number.toString();
  })();
</script>

{#if typeof formattedNumber === "object" && formattedNumber.needsSubscript}
  <span>
    {formattedNumber.prefix}
    <span class="align-sub text-[0.5em] -ml-[0.5em]"
      >{formattedNumber.zeroCount}</span
    >{formattedNumber.suffix.slice(0, totalDigits)}
  </span>
{:else}
  {formattedNumber}
{/if}
