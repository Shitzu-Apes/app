<script lang="ts">
  export let number: number;
  export let totalDigits: number;

  $: absNumber = Math.abs(number);
  $: integerPartLength = Math.floor(absNumber).toString().length;

  // Helper function to format numbers with commas
  function formatWithCommas(num: number, fractionDigits: number) {
    // Clamp fractionDigits between 0 and 20
    fractionDigits = Math.max(0, Math.min(20, fractionDigits));
    return num.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

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
      const formatted = Math.floor(number * factor) / factor;

      // Use the helper function to add commas
      return formatWithCommas(formatted, digitsAfterDecimal);
    } else {
      // Use SI notation
      const SI_PREFIXES = [
        { value: 1e12, symbol: "T" },
        { value: 1e9, symbol: "B" },
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

          // Ensure digitsAfterDecimal is within valid range
          const fractionDigits = Math.max(0, Math.min(20, digitsAfterDecimal));
          const factor = Math.pow(10, fractionDigits);

          // Adjust factor for numbers with decimal part
          const formattedNum = Math.floor(scaled * factor) / factor;

          // Use the helper function to add commas
          const formattedWithCommas = formatWithCommas(
            formattedNum,
            fractionDigits,
          );
          return formattedWithCommas + SI_PREFIXES[i].symbol;
        }
      }
    }

    // For numbers smaller than 1
    const digitsAfterDecimal = totalDigits - integerPartLength;
    const fractionDigits = Math.max(0, Math.min(20, digitsAfterDecimal));
    return formatWithCommas(number, fractionDigits);
  })();
</script>

{#if typeof formattedNumber === "object" && formattedNumber.needsSubscript}
  <span>
    {formattedNumber.prefix}
    <span class="align-sub text-[0.5em] -ml-[0.5em]">
      {formattedNumber.zeroCount}
    </span>
    {formattedNumber.suffix.slice(0, totalDigits)}
  </span>
{:else}
  {formattedNumber}
{/if}
