<script lang="ts">
  import Button from "@smui/button";
  import Tab, { Label } from "@smui/tab";
  import TabBar from "@smui/tab-bar";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable, type Readable } from "svelte/store";
  import { match } from "ts-pattern";

  import { TokenInput } from "$lib/components";
  import { ModalContent } from "$lib/layout";
  import { wallet } from "$lib/near";

  export let nearBalance$: Readable<FixedNumber>;
  export let stake$: Readable<FixedNumber>;
  export let afterUpdateBalances: () => void;

  let newNearBalance: FixedNumber | undefined;
  let newStakeBalance: FixedNumber | undefined;

  let tabs: { label: "Stake" | "Unstake" }[] = [
    {
      label: "Stake",
    },
    {
      label: "Unstake",
    },
  ];
  let active = tabs[0];

  let input: TokenInput;
  let inputValue$ = writable<string | undefined>();
  $: input$ = input?.u128$;

  $: if (active) {
    $inputValue$ = "";
  }

  $: updateOutAmount(active.label, $input$);
  function updateOutAmount(label: "Stake" | "Unstake", val?: FixedNumber) {
    if (!val || val.valueOf() === 0n) {
      newNearBalance = undefined;
      newStakeBalance = undefined;
      return;
    }
    match(label)
      .with("Stake", () => {
        newNearBalance = $nearBalance$.sub(val);
        newStakeBalance = $stake$.add(val);
      })
      .with("Unstake", () => {
        newNearBalance = $nearBalance$.add(val);
        newStakeBalance = $stake$.sub(val);
      })
      .exhaustive();
  }

  let disabled = true;
  $: if (!newNearBalance || !newStakeBalance) {
    disabled = true;
  } else if (newNearBalance.valueOf() < 0 || newStakeBalance.valueOf() < 0) {
    disabled = true;
  } else if ($input$?.valueOf() === 0n) {
    disabled = true;
  } else {
    disabled = false;
  }

  function setMax() {
    $inputValue$ = match(active.label)
      .with("Stake", () => $nearBalance$.sub(new FixedNumber(5n, 1)).toString())
      .with("Unstake", () => $stake$.toString())
      .exhaustive();
  }

  let loading = false;
  async function runTx() {
    if (!$input$ || $input$.valueOf() === 0n) return;
    loading = true;
    await wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
        actions: [
          // TODO
          {
            type: "FunctionCall",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            params: {} as any,
            // params: isDeposit
            //   ? {
            //       methodName: "ft_transfer_call",
            //       args: {
            //         receiver_id: import.meta.env.VITE_SHITZU_HOT_ID,
            //         amount: $input$.toU128(),
            //         msg: JSON.stringify("Deposit"),
            //       },
            //       gas: "50000000000000",
            //       deposit: "1",
            //     }
            //   : {
            //       methodName: "withdraw",
            //       args: {
            //         amount: $input$.toU128(),
            //       },
            //       gas: "50000000000000",
            //       deposit: "0",
            //     },
          },
        ],
      },
      {
        onSuccess: () => {
          afterUpdateBalances();
          $inputValue$ = "";
        },
        onFinally: () => {
          loading = false;
        },
      },
    );
  }
</script>

<ModalContent header="Stake / Unstake">
  <TabBar {tabs} let:tab bind:active>
    <Tab {tab}>
      <Label>{tab.label}</Label>
    </Tab>
  </TabBar>

  <div class="tab">
    <div class="field">
      <span>Wallet balance:</span>
      <div class="balance">
        <span>{$nearBalance$.format()}</span>
        {#if newNearBalance}
          <span>⇒</span>
          <span
            class="result"
            class:more={newNearBalance > $nearBalance$}
            class:less={newNearBalance < $nearBalance$}
          >
            {newNearBalance.format()}
          </span>
        {/if}
      </div>
    </div>
    <div class="field">
      <span>Validator stake:</span>
      <div class="balance">
        <span>{$stake$.format()}</span>
        {#if newStakeBalance}
          <span>⇒</span>
          <span
            class="result"
            class:more={newStakeBalance > $stake$}
            class:less={newStakeBalance < $stake$}
          >
            {newStakeBalance.format()}
          </span>
        {/if}
      </div>
    </div>

    <div class="input-wrapper">
      <TokenInput
        bind:this={input}
        bind:value={$inputValue$}
        decimals={24}
        --width="0"
        --flex="1 0 auto"
      />
      <Button variant="outlined" class="button-small" on:click={setMax}>
        max
      </Button>
    </div>

    <Button
      variant="outlined"
      on:click={() => runTx()}
      disabled={disabled || loading}>{active.label}</Button
    >
  </div>
</ModalContent>

<style lang="scss">
  .tab {
    display: flex;
    flex-direction: column;
    margin-top: 1rem;
    gap: 0.4rem;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    border: to-rem(2px) solid lightgray;
    border-radius: 0.4rem;
    padding: 0.4rem;
    max-width: 100%;

    &:hover {
      border-color: var(--bright-blue);
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.8rem 0 0.3rem;

    &:first-child {
      padding-top: 0;
    }
    &:not(:last-child) {
      border-bottom: 1px solid var(--color-border);
    }
  }

  .balance {
    display: flex;
    align-items: center;

    > *:first-child,
    > *:last-child {
      flex: 1 1 5rem;
    }

    .result {
      text-align: end;
    }

    span {
      &.more {
        color: var(--color-ok);
      }
      &.less {
        color: var(--color-err);
      }
    }
  }

  :global(.button-small) {
    margin-left: 0.2rem;
    height: 1.6rem;
  }
</style>
