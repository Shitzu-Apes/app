<script lang="ts">
  import "@unocss/reset/tailwind.css";
  import "virtual:uno.css";
  import "../../app.scss";

  import { reconnect, watchAccount } from "@wagmi/core";
  import dayjs from "dayjs";
  import localizedFormat from "dayjs/plugin/localizedFormat";
  import { onMount, onDestroy } from "svelte";
  import { cubicIn, cubicOut } from "svelte/easing";
  import { get } from "svelte/store";
  import { blur } from "svelte/transition";

  import Toast from "$lib/components/Toast.svelte";
  import { wagmiConfig } from "$lib/evm/wallet";
  import { Footer, Body } from "$lib/layout";
  import BottomNav from "$lib/layout/BottomNav.svelte";
  import { BottomSheet } from "$lib/layout/BottomSheet";
  import { ScreenSize } from "$lib/models";
  import { nearWallet } from "$lib/near";
  import { screenSize$ } from "$lib/screen-size";
  import { refreshShitzuBalance } from "$lib/store";

  // eslint-disable-next-line import/no-named-as-default-member
  dayjs.extend(localizedFormat);

  let resizeObserver: ResizeObserver | undefined;
  onMount(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { inlineSize } = entry.contentBoxSize[0];
        if (inlineSize <= ScreenSize.Phone) {
          screenSize$.set(ScreenSize.Phone);
        } else if (inlineSize <= ScreenSize.Mobile) {
          screenSize$.set(ScreenSize.Mobile);
        } else if (inlineSize <= ScreenSize.Tablet) {
          screenSize$.set(ScreenSize.Tablet);
        } else if (inlineSize <= ScreenSize.Laptop) {
          screenSize$.set(ScreenSize.Laptop);
        } else if (inlineSize <= ScreenSize.DesktopLg) {
          screenSize$.set(ScreenSize.DesktopLg);
        } else {
          screenSize$.set(ScreenSize.DesktopXl);
        }
      }
    });

    resizeObserver.observe(window.document.body);
  });
  onDestroy(() => {
    if (!resizeObserver) return;
    resizeObserver.unobserve(window.document.body);
  });

  nearWallet.accountId$.subscribe((accountId) => {
    if (accountId == null) return;
    refreshShitzuBalance(accountId);
  });

  onMount(() => {
    reconnect(wagmiConfig);

    watchAccount(wagmiConfig, {
      onChange: async (data) => {
        const selector = await get(nearWallet.selector$);
        if (
          data.address != null &&
          selector.store.getState().selectedWalletId == null
        ) {
          selector.wallet("ethereum-wallets").then((wallet) => {
            // FIXME optional access key not yet supported by wallet selector
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wallet.signIn({} as any);
          });
        }
        if (
          data.address == null &&
          selector.store.getState().selectedWalletId === "ethereum-wallets"
        ) {
          selector.wallet("ethereum-wallets").then((wallet) => {
            wallet.signOut();
          });
        }
      },
    });
  });
</script>

<BottomSheet />

{#key "shitzu"}
  <div
    out:blur={{ duration: 500, easing: cubicOut }}
    in:blur={{ duration: 500, delay: 500, easing: cubicIn }}
    class="bg-[#222] min-h-screen w-screen max-w-full"
  >
    <div
      class="flex flex-col min-h-screen prose prose-invert prose-lime mx-auto max-w-none pb-15"
    >
      <Body>
        <slot />
      </Body>
      <Footer />
      <BottomNav />
    </div>
  </div>
  <Toast />
{/key}
