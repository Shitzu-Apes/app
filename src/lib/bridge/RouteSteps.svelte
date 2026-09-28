<script lang="ts">
  import { formatBaseUnits } from "./amount";
  import type { RouteStep, StepState } from "./steps";

  /**
   * The route as a list of what will happen, and then as a list of what is
   * happening.
   *
   * One component for both, because they are the same information at two moments.
   * A user is signing up to three transactions across two wallets with a bridge
   * wait in the middle, and the destination swap cannot be signed until the funds
   * have landed — so seeing the whole shape before starting is the difference
   * between consent and surprise. Splitting this into a "preview" and a
   * "progress" component is how the two drift apart and the progress view ends
   * up promising steps the plan did not have.
   */
  export let steps: RouteStep[];

  const LABEL: Record<StepState, string> = {
    pending: "text-shitzu-2",
    active: "text-shitzu-1 font-medium",
    done: "text-shitzu-2",
    failed: "text-red-300 font-medium",
  };

  const ICON: Record<StepState, string> = {
    pending: "i-mdi:circle-small text-shitzu-4/40",
    active: "i-mdi:loading animate-spin text-shitzu-4",
    done: "i-mdi:check-circle text-shitzu-4",
    failed: "i-mdi:alert-circle text-red-400",
  };
</script>

<ol class="flex flex-col gap-2.5">
  {#each steps as step (step.id)}
    <li
      class="flex items-start gap-2.5"
      aria-current={step.state === "active" ? "step" : undefined}
    >
      <div class="{ICON[step.state]} text-base leading-none mt-0.5 shrink-0">
        <!--
          Decorative: the state is already carried by the text, the colour and
          `aria-current`, and a screen reader announcing "check circle" before
          every step is noise rather than information.
        -->
        <span aria-hidden="true" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="text-sm {LABEL[step.state]}">{step.title}</div>
        {#if step.detail}
          <div class="text-xs text-shitzu-2">{step.detail}</div>
        {/if}
      </div>

      <div class="text-right shrink-0">
        <div class="text-xs font-mono {LABEL[step.state]}">
          {step.amount !== null && step.amount > 0n
            ? formatBaseUnits(step.amount, step.amountDecimals)
            : "—"}
        </div>
        <div class="text-[10px] text-shitzu-2">{step.symbol}</div>
      </div>
    </li>
  {/each}
</ol>
