<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  import {
    requireNearWallet,
    requireSolanaWallet,
  } from "$lib/auth/showWalletSelector";
  import ChainEnd from "$lib/bridge/ChainEnd.svelte";
  import ConversionDone from "$lib/bridge/ConversionDone.svelte";
  import RouteList from "$lib/bridge/RouteList.svelte";
  import RouteSteps from "$lib/bridge/RouteSteps.svelte";
  import SourceTokenList from "$lib/bridge/SourceTokenList.svelte";
  import TargetTokenList from "$lib/bridge/TargetTokenList.svelte";
  import {
    formatBaseUnits,
    formatBaseUnitsExact,
    parseBaseUnits,
  } from "$lib/bridge/amount";
  import {
    buildCatalog,
    suggestTargets,
    type CatalogToken,
  } from "$lib/bridge/catalog";
  import { searchNear } from "$lib/bridge/catalog";
  import { CHAINS } from "$lib/bridge/chains";
  import {
    EMPTY_RETRY_DELAYS_MS,
    emptyRetryDelay,
    worthRetryingEmpty,
  } from "$lib/bridge/coldRouter";
  import { convertGate } from "$lib/bridge/convertGate";
  import {
    readConvertQuery,
    writeConvertQuery,
  } from "$lib/bridge/convertQuery";
  import { isDust } from "$lib/bridge/dust";
  import {
    runNearDeposit,
    runNearSourceSwap,
    type NearSwapLeg,
    runNearDestinationSwap,
    runSameChainSwap,
  } from "$lib/bridge/executeNear";
  import { runFromNear } from "$lib/bridge/executeNear";
  import { runFromSolana } from "$lib/bridge/executeSolana";
  import { runSolanaDestinationSwap } from "$lib/bridge/executeSolanaSwapLeg";
  import { PERCENTS, usdFor, type SourceOption } from "$lib/bridge/format";
  import { OMNI_NETWORK } from "$lib/bridge/omni";
  import { railAssetOnArrival, type ConvertChain } from "$lib/bridge/rail";
  import { REGISTRY } from "$lib/bridge/registry";
  import { findRoutes } from "$lib/bridge/routeSearch";
  import {
    describePlan,
    planKey,
    type RoutePlan,
    type RouteSearch,
  } from "$lib/bridge/search";
  import { phaseOf, waitForTransfer } from "$lib/bridge/status";
  import {
    costSummary,
    planSteps,
    receiveSummary,
    withProgress,
  } from "$lib/bridge/steps";
  import { TransferError } from "$lib/bridge/transfer";
  import {
    catalogSignature,
    shouldBuildCatalog,
    shouldLoadWallet,
  } from "$lib/bridge/walletLoad";
  import SummaryRow from "$lib/components/memecooking/BottomSheet/SummaryRow.svelte";
  import {
    isBottomSheetOpen$,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import { nearWallet } from "$lib/near";
  import { nearBalance } from "$lib/near/balance";
  import {
    fastNearBalances,
    ftBalances,
    intearUserTokens,
    nativeNearBalance,
  } from "$lib/near/ftBalances";
  import {
    loadNearHoldings as loadNearHoldingsFor,
    type NearBalancesDeps,
    type NearHolding,
  } from "$lib/near/holdings";
  import {
    fetchWalletTokens,
    WSOL_MINT,
    type WalletToken,
  } from "$lib/solana/tokenBalances";
  import { solanaWallet } from "$lib/solana/wallet";

  /**
   * Any token on one chain to any deliverable token on another.
   *
   * Three legs: a swap into a bridgeable token, the bridge itself, and a swap out
   * of it. Which token to bridge is searched over rather than fixed, which is the
   * whole point — see `$lib/bridge/search.ts`.
   *
   * Laid out to match the existing Solana-to-NEAR sheet: a card per chain end, a
   * scrollable token list with icons and balances, a large amount field with
   * quick-fill steps, and one summary card. Every text colour is explicit because
   * the page inherits black-on-dark from `body`; see `scripts/contrast.mjs`.
   */

  /**
   * Mainnet only. The Intear aggregator has no testnet deployment, Jupiter quotes
   * mainnet pools, and testnet's bridge contract has no wNEAR registered — so a
   * testnet conversion could never settle. Refused up front rather than after two
   * signatures.
   */
  const SUPPORTED = OMNI_NETWORK === "mainnet";

  /** How long to wait after the last keystroke before pricing. */
  const SEARCH_DEBOUNCE_MS = 400;

  /**
   * Lamports held back from a SOL balance to pay the deposit's network fee.
   * Bridging costs SOL whatever token is being moved, so this is separate from
   * the token balance — which is why "100%" on a SOL balance is not the whole
   * balance, and why a user holding tokens but no SOL cannot send.
   */
  const SOL_FEE_RESERVE = 20_000n;

  const { accountId$, selector$ } = nearWallet;
  const { publicKey$ } = solanaWallet;

  const CHAINS_NEAR = CHAINS.near;

  // --- chains -------------------------------------------------------------------

  let source: ConvertChain = "solana";
  let dest: ConvertChain = "near";

  /**
   * The four parts of a conversion, mirrored into the URL so the form is a
   * shareable link. Read once on mount; written on change. The amount is
   * deliberately excluded — see `convertQuery.ts`.
   */
  onMount(() => {
    const initial = readConvertQuery(location.search);
    source = initial.from;
    dest = initial.to;
    if (initial.target) targetTokenId = initial.target;
  });

  $: if (hydrated) {
    writeConvertQuery({ from: source, to: dest, target: targetTokenId });
  }

  /**
   * Both chains and the target are settled before the URL is written, otherwise
   * mounting would immediately rewrite a link that arrived with its own state.
   */
  let hydrated = false;
  onMount(() => {
    hydrated = true;
  });

  /**
   * Picking the chain already in use as the destination swaps the two ends.
   *
   * Anything else is left alone, because sending to the chain you are already on
   * is a legitimate choice — it is a plain swap with no bridge in it — and forcing
   * a swap there would make a one-chain token unreachable.
   */
  function pickSource(chain: ConvertChain) {
    source = chain;
    reset();
  }

  function pickDest(chain: ConvertChain) {
    dest = chain;
    reset();
  }

  // --- source token -------------------------------------------------------------

  let solanaTokens: WalletToken[] = [];
  let isLoadingSolanaTokens = false;
  let loadedFor: string | null = null;

  /**
   * Is the source chain's own wallet connected?
   *
   * The empty message used to ask "is *either* wallet connected", which is the wrong
   * question and answered itself wrongly. On `?from=near&to=solana` the NEAR wallet is
   * connected and the Solana one is not, so the From list — which is showing Solana
   * tokens as soon as the user picks that chain — was told to say "No tokens found in
   * this wallet." The app had never asked the Solana wallet anything, because the
   * Solana load is gated on the Solana key. So a wallet that was never consulted was
   * reported as a wallet with nothing in it, and the two are indistinguishable on
   * screen. That is the same class of lie as a progress panel claiming a transfer
   * finished, and it is why this read as "the balances did not load".
   */
  $: sourceWalletConnected =
    source === "near" ? Boolean($accountId$) : Boolean($publicKey$);

  /**
   * Did a read of this wallet fail, as against finding it empty?
   *
   * Worth its own flag because the two look identical from outside — both leave the
   * list empty — and they call for opposite responses. A failed read is worth
   * retrying; an empty wallet is not.
   */
  $: solanaBalancesUnreadable =
    source === "solana" &&
    Boolean($publicKey$) &&
    !isLoadingSolanaTokens &&
    solanaReadCameBackEmpty;

  let sourceTokenId = WSOL_MINT;
  $: sourceWalletToken =
    solanaTokens.find((t) => t.mint === sourceTokenId) ?? null;

  /**
   * The wallet reports native SOL under its wrapped mint, so the raw mint is the
   * one identifier available for it. Showing that as the label would answer
   * "SOL" in the list with a 44-character address, so the symbol comes from the
   * metadata the wallet loader already resolved.
   */
  /**
   * The selected source, as one value whichever chain it is on.
   *
   * `sourceTokenId` is a mint on Solana and a NEP-141 contract id (or `near`) on
   * NEAR. Everything below resolves through whichever side is showing, so the
   * amount field, the symbol and the USD hint cannot disagree with the list.
   */
  $: sourceHolding =
    nearHoldings.find((h) => h.tokenId === sourceTokenId) ?? null;
  $: sourceSymbol =
    source === "solana"
      ? (sourceWalletToken?.symbol ?? "SOL")
      : (sourceHolding?.symbol ?? "NEAR");
  $: sourceDecimals =
    source === "solana"
      ? (sourceWalletToken?.decimals ?? 9)
      : (sourceHolding?.decimals ?? 24);
  /**
   * The selected token's artwork.
   *
   * The registry first, then the on-chain record, then the chain's own icon for
   * native. The registry leads because on-chain metadata is not trustworthy here — a
   * token's own contract metadata is missing or wrong often enough that preferring it
   * meant the two ends of the form disagreed: JLU showed no icon in the spend list and
   * a correct one in the receive list, off the same token. The receive side resolves
   * through the catalogue for exactly this reason.
   */
  $: sourceIcon =
    source === "solana"
      ? sourceWalletToken?.icon
      : sourceTokenId === "near"
        ? CHAINS_NEAR.icon
        : iconFor(sourceAddress, sourceHolding?.icon, sourceSymbol);
  $: solBalance = solanaTokens.find((t) => t.native)?.balance ?? null;
  /**
   * The source token's price per whole token, for the amount field's USD hint.
   *
   * This used to be the balance's *total* USD value, which is a different number and
   * wrong by the size of the holding: a wallet with 2.00579 NEAR worth $10.81
   * showed "1.00 NEAR ≈ $10.85", because the hint multiplied the typed amount by
   * $10.81 instead of by the $5.39 that NEAR costs. The list beside it was right
   * the whole time, which is what made it look like the price was simply wrong —
   * the two numbers on screen disagreed by the balance.
   */
  $: sourcePrice =
    source === "solana"
      ? (sourceWalletToken?.usdPrice ?? 0)
      : (sourceHolding?.price ?? 0);

  // A chain change invalidates the selection: a Solana mint means nothing on NEAR.
  // Keep the selection valid against the rows actually on offer. Native NEAR is
  // always one of them — `buildSourceOptions` adds it unconditionally — so a
  // holdings call that fails or is still in flight leaves the selection on NEAR
  // rather than resetting it, and the From side is never left with nothing to
  // spend. `sourceOptions` is the input, not `nearHoldings`, because it is what
  // the user is shown.
  $: if (
    source === "near" &&
    sourceOptions.length > 0 &&
    !sourceOptions.some((o) => o.id === sourceTokenId)
  ) {
    sourceTokenId = sourceOptions[0].id;
  }
  $: if (
    source === "solana" &&
    !solanaTokens.some((t) => t.mint === sourceTokenId)
  ) {
    sourceTokenId = solanaTokens[0]?.mint ?? WSOL_MINT;
  }

  /**
   * On NEAR only native NEAR is offered. Sweeping every NEP-141 an account holds
   * is a separate piece of work, and the interesting case — arriving with a token
   * the bridge does not know — is already covered by the rail search.
   */
  // Native NEAR is selected as the bare id `near`, but the aggregators and the
  // bridge want the contract that represents it on the source chain — resolved
  // from the registry rather than written here, so there is one address for it.
  $: nearSourceAddress =
    sourceTokenId === "near"
      ? (REGISTRY.NEAR.addresses.near ?? "near")
      : sourceTokenId;
  $: sourceAddress =
    source === "solana" ? (sourceWalletToken?.mint ?? null) : nearSourceAddress;

  /**
   * Every NEP-141 balance the NEAR account holds, not just wrapped NEAR.
   *
   * The source list used to offer one token on the NEAR side, which made the whole
   * chain look empty however much the account was worth. `ft_balances` on the
   * wrapping contract enumerates them in a single view call; see
   * `src/lib/near/holdings.ts` for why that is the only tractable way to do it.
   */
  let nearHoldings: NearHolding[] = [];
  let nearLoadedFor: string | null = null;
  let isLoadingNearHoldings = false;

  $: sourceOptions = buildSourceOptions(source, solanaTokens, nearHoldings);

  /**
   * Is this the same money as native NEAR?
   *
   * Two ids reach the holdings for one balance: the bare `near` for the native
   * account, and `wrap.near` for the wrapping contract around the same tokens. They
   * are the same asset and the product calls both of them NEAR, so a list that shows
   * both is showing one balance twice — and the duplicate is the wrapped form, which
   * is not what the fee is paid in.
   */
  /**
   * The catalogue's row for a NEAR address, when there is one.
   *
   * `catalog` is the *destination* chain's list, so it only answers for NEAR while NEAR
   * is the destination. That is the case this is for: the two ends of the form are on
   * different chains, and the artwork for a held NEAR token is already resolved in the
   * catalogue whenever the receive side is NEAR.
   */
  /**
   * The product's own artwork for a token the bridge carries, by its NEAR address.
   *
   * This is an override and it is meant to be one. Two of the tokens the bridge carries
   * — JLU and XAUT — have artwork in the registry and *nothing* anywhere else: their
   * on-chain metadata carries no image, and no indexer has a pool for them to take one
   * from, so both ends of the form fell back to a placeholder while the answer was
   * sitting in a file this form already imports. It is deliberately not the destination
   * catalogue, which only answers while NEAR happens to be the receiving chain — a
   * half-fix that made a NEAR → Solana conversion look broken and a NEAR → NEAR one
   * fine, for the same token on the same wallet.
   */
  function registryIcon(
    address: string | null | undefined,
    symbol?: string | undefined,
  ): string {
    if (address) {
      const needle = address.toLowerCase();
      for (const entry of Object.values(REGISTRY)) {
        const onNear = entry.addresses?.near;
        if (onNear && onNear.toLowerCase() === needle) return entry.icon ?? "";
      }
    }
    // By symbol as well, because not every registry address is what the wallet holds
    // under that name. XAUT's is a `factory.bridge.near` contract, the shape a bridged
    // or minted asset arrives in, and an address that arrives wrapped or rewritten does
    // not match the registry while the token is plainly the same one. A symbol is a
    // weaker key than an address — two tokens can share a ticker — so it is only
    // consulted when the address found nothing, and the registry holds one entry per
    // bridge asset, so a collision means the list itself is ambiguous.
    if (symbol) {
      const wanted = symbol.trim().toLowerCase();
      if (wanted) {
        for (const entry of Object.values(REGISTRY)) {
          if (entry.symbol?.toLowerCase() === wanted) return entry.icon ?? "";
        }
      }
    }
    return "";
  }

  /**
   * A token's artwork, from whichever surface is asking.
   *
   * One function for both the spend list and the amount field, because they were
   * resolving it separately and disagreed: the list read the on-chain record while the
   * field read the registry, so a token with a broken on-chain image looked correct next
   * to the amount and blank in the list, on the same screen. Two call sites each
   * re-deriving this is how that happened, and it will happen again.
   *
   * Order: what the product ships, then the destination catalogue (which is what
   * resolves artwork for tokens the bridge does not carry), then the on-chain record,
   * which is the least trustworthy of the three.
   */
  function iconFor(
    address: string | null | undefined,
    onChainIcon: string | undefined,
    symbol?: string | undefined,
  ): string {
    return (
      registryIcon(address, symbol) ||
      catalogRow(address)?.icon ||
      onChainIcon ||
      ""
    );
  }

  function catalogRow(address: string | null | undefined) {
    if (dest !== "near" || !address) return null;
    return catalog.find((t) => t.address === address) ?? null;
  }

  function isNativeNear(tokenId: string): boolean {
    return tokenId === "near" || tokenId === "wrap.near";
  }

  function buildSourceOptions(
    chain: ConvertChain,
    tokens: WalletToken[],
    holdings: NearHolding[],
  ): SourceOption[] {
    if (chain === "near") {
      // Native NEAR is unconditional, and it is not a nicety: it is the one token
      // the account definitely has, so a list built purely from `ft_balances` is
      // empty the moment that call fails — which is what left the From side showing
      // no input token at all. The balance is one `view_account`, so it does not
      // depend on the bulk enumeration working either.
      const nativeHolding = holdings.find((h) => h.tokenId === "near");
      const native: SourceOption[] = [
        {
          id: "near",
          symbol: "NEAR",
          icon: CHAINS_NEAR.icon,
          balance: $nearBalance?.toBigInt() ?? 0n,
          decimals: 24,
          usdValue: nativeHolding?.usdValue,
          // The price, not the holding's value: the amount field's hint prices
          // what the user typed, and native NEAR is the most common thing they
          // type. Leaving it off meant no hint at all on the default token.
          price: nativeHolding?.price,
          routable: true,
          native: true,
        },
      ];
      // `holdings` also carries native NEAR under a wrapping-contract id, and a
      // row for it twice would be two entries for the same money.
      //
      // Dust goes: a wallet holds hundreds of airdropped shards it has never spent, and
      // every one is a real balance and none is a decision. Native is exempt — it is
      // listed whatever it is worth, because it is what pays the fee.
      const rest = holdings.filter(
        (holding) =>
          // Both ids, not one. Native NEAR reaches the holdings under the bare `near`
          // id, and the *same money* also reaches it as the wrapping contract — so the
          // list showed NEAR twice, once plain and once as the bridge's wNEAR asset.
          // A row for it twice is two entries for one balance, and the second one is
          // the wrapped form, which is not the thing you can spend.
          !isNativeNear(holding.tokenId) &&
          !isDust({
            balance: holding.balance,
            usdValue: holding.usdValue,
            decimals: holding.decimals,
          }),
      );
      return [
        ...native,
        ...rest.map((holding) => ({
          id: holding.tokenId,
          symbol: holding.symbol,
          icon: iconFor(holding.tokenId, holding.icon, holding.symbol),
          balance: holding.balance,
          decimals: holding.decimals,
          usdValue: holding.usdValue,
          price: holding.price,
          // Every NEP-141 the account holds is by definition swappable into
          // something, and the router answers per pair; this flags nothing off.
          routable: true,
          native: false,
        })),
      ];
    }
    // Native leads, and separately from the sort below, which orders by value.
    //
    // It is the one token the account certainly has, it is what pays the network fee,
    // and it is what a conversion is opened on — so letting a large holding push it
    // down the list means the default selection and the thing that must not run out
    // are both below the fold. The NEAR branch has always prepended it for the same
    // reason; this makes the two ends of the form agree.
    const native = tokens.filter((t) => t.native);
    const rest = tokens.filter(
      (t) => !t.native && !isDust({ balance: t.balance, usdValue: t.usdValue }),
    );
    return [...native, ...rest].map((token) => ({
      id: token.mint,
      symbol: token.symbol,
      icon: token.icon,
      balance: token.balance,
      decimals: token.decimals,
      usdValue: token.usdValue,
      price: token.usdPrice,
      // Jupiter listing the token is our proxy for "can be swapped". A token it
      // does not know may still route, so this flags rather than blocks.
      routable: token.routable,
      native: token.native,
    }));
  }

  // --- the two ends -------------------------------------------------------------

  /**
   * Derived, not called from the template.
   *
   * `address={senderAddress()}` has the same defect as above: the template would
   * re-read `senderAddress`, whose identity never changes, and so the address
   * stayed on the previous chain's wallet while the chain name and icon beside it
   * updated. Assigning these reactively is what makes them track `source`.
   */
  /**
   * Each end's address comes from *its own* chain.
   *
   * These used to be derived from `source` alone — sender is the source chain's
   * wallet, recipient is the other one — so changing the source chain flipped the
   * destination address as well. Switching From from Solana to NEAR rewrote the To
   * card's address even when To stayed on NEAR, which is plainly wrong: the
   * destination has no idea which end the user changed.
   */
  $: senderAddress =
    source === "solana" ? $publicKey$?.toBase58() : ($accountId$ ?? undefined);
  $: recipientAddress =
    dest === "solana" ? $publicKey$?.toBase58() : ($accountId$ ?? undefined);

  // --- target -------------------------------------------------------------------

  /**
   * Everything deliverable on the destination, not just what the bridge carries.
   *
   * The bridge's own eight tokens are the reliable core — they provably arrive,
   * because the bridge is what carries them — but a picker offering only those
   * makes this look like the native bridge renamed. The rest comes from the
   * destination chain's own aggregator index, merged on address so a bridged token
   * does not appear twice, with whatever the wallet holds floated to the top.
   */
  let catalog: CatalogToken[] = [];
  let isLoadingCatalog = false;
  let catalogFor: ConvertChain | null = null;
  let catalogAbort: AbortController | undefined;

  /**
   * Bumped whenever a wallet balance load lands, so the catalogue can be rebuilt.
   *
   * The destination list is *built* with the balances folded in and then held, unlike
   * the spend side which is derived and re-renders. A balance read that arrives after
   * the build therefore changed nothing on screen, and the receive side showed no
   * amounts while the spend side showed them — both reading the same arrays, and only
   * one re-reading them. Comparing the arrays by value would not detect it: nothing
   * re-assigns an equal array, so the trigger would never fire.
   */
  let holdingsVersion = 0;
  $: destWalletKey =
    dest === "near" ? ($accountId$ ?? null) : ($publicKey$?.toBase58() ?? null);
  $: heldSignature = catalogSignature({
    chain: dest,
    wallet: destWalletKey,
    version: holdingsVersion,
  });
  /** The signature the catalogue on screen was built from. */
  let catalogHeldFor = "";

  async function loadCatalog(chain: ConvertChain) {
    catalogAbort?.abort();
    const controller = new AbortController();
    catalogAbort = controller;
    isLoadingCatalog = true;
    // The list is emptied only when it is for a *different chain*, which is a
    // different set of rows entirely. A rebuild for fresh balances is the same rows
    // with amounts added, so blanking it there would flash the list empty every time
    // the wallet finishes loading — a flicker on the ordinary path, and the sort by
    // held value moves rows around underneath it besides.
    if (catalogFor !== chain) {
      // The previous chain's tokens go now rather than at the end of the fetch. The
      // spinner is honest about being a spinner only if the list under it is empty —
      // otherwise a destination that is still loading shows the chain it *was*, with
      // tokens that mean nothing on the one now selected, and a Solana mint can be
      // picked for NEAR.
      catalog = [];
    }
    catalogFor = chain;
    // Recorded with the chain rather than on success, so a slow build that lands after
    // the balances moved on does not leave the list looking current when it is not.
    catalogHeldFor = heldSignature;
    try {
      const held =
        chain === "solana"
          ? solanaTokens.map((t) => ({
              address: t.mint,
              balance: t.balance,
              symbol: t.symbol,
              decimals: t.decimals,
              usdValue: t.usdValue,
              icon: t.icon,
            }))
          : $accountId$
            ? nearHoldings.map((h) => ({
                address: h.tokenId,
                balance: h.balance,
                symbol: h.symbol,
                decimals: h.decimals,
                // Carried through so the catalogue can tell dust from a real balance.
                // It used to be dropped here, which is why the receive list could not
                // do that for itself.
                usdValue: h.usdValue,
                // The spend list has already resolved this token's artwork, so the
                // receive list is handed it rather than going to ask again.
                icon: h.icon,
              }))
            : [];
      const built = await buildCatalog(
        REGISTRY,
        chain,
        held,
        controller.signal,
      );
      // Only the current request may write. This is not defensive: an aborted request
      // does not reject, it *resolves empty* — `getJson` swallows the abort so a dead
      // section cannot break the picker — so a superseded load comes back normally and
      // overwrites whatever the newer one has since put on screen. The `finally` below
      // already knew to check this; the two paths that write `catalog` did not.
      if (catalogAbort !== controller) return;
      catalog = built;
    } catch (err) {
      // The same guard, for the same reason: a failure from a request nobody is waiting
      // for any more must not blank the list that replaced it.
      if (catalogAbort !== controller) return;
      console.error("[bridge] could not load the token list", err);
      // The bridge assets are known locally, so an aggregator outage costs the
      // extra sections rather than the whole picker.
      catalog = [];
    } finally {
      if (catalogAbort === controller) isLoadingCatalog = false;
    }
  }

  /**
   * Wait for the URL before loading anything.
   *
   * `dest` starts on its default and is corrected in `onMount` from the query string,
   * so without this the very first render asks for the *default* chain's token list and
   * the arrival link's chain a moment later. The second request aborts the first — and
   * an aborted request does not fail, it resolves empty (see `getJson`), so the
   * superseded load came back and overwrote the list the user actually asked for. The
   * symptom was `?from=near&to=solana` showing an empty Solana list until the
   * destination was toggled, which is the same load run a second time.
   *
   * `hydrated` is set after the `onMount` that reads the query, so by the time it is
   * true `dest` is the chain the link asked for.
   */
  /**
   * Wait for the URL before loading anything, and rebuild when the balances move.
   *
   * `dest` starts on its default and is corrected in `onMount` from the query string,
   * so without `hydrated` the very first render asks for the *default* chain's token
   * list and the arrival link's chain a moment later. The second request aborts the
   * first — and an aborted request does not fail, it resolves empty (see `getJson`),
   * so the superseded load came back and overwrote the list the user actually asked
   * for. `hydrated` is set after the `onMount` that reads the query, so by the time it
   * is true `dest` is the chain the link asked for.
   *
   * The second half is the fix for balances that never appeared on this side. The
   * list is built with the balances folded in and then held, so a wallet read landing
   * after the build used to change nothing here while the derived spend side updated
   * normally. Toggling the destination was the only thing that made it rebuild — which
   * is why it looked like the chain switch was the fix.
   */
  $: if (
    shouldBuildCatalog({
      hydrated,
      chain: dest,
      builtFor: catalogFor,
      builtFrom: catalogHeldFor,
      signature: heldSignature,
    })
  )
    void loadCatalog(dest);

  /**
   * Type-ahead results, kept separate from the list they replace.
   *
   * Merging them would make the search look like a filter over a list it is not:
   * on NEAR the indexer finds tokens the browsable list does not carry at all, so
   * a filtered view of that list could never contain them.
   */
  let suggestions: CatalogToken[] = [];
  let searching_ = false;
  let suggestAbort: AbortController | undefined;
  let suggestFor = "";

  /**
   * How long the token search waits for typing to stop.
   *
   * The box itself stays instant — this only defers the request. Typing "shitzzu"
   * is seven keystrokes, and each one was a live query against a public API, so a
   * search cost up to seven round trips and the results flickered as each answer
   * arrived. The route search below already waits; this is the same rule.
   */
  const SUGGEST_DEBOUNCE_MS = 250;
  let suggestDebounce: ReturnType<typeof setTimeout> | undefined;

  async function runSuggest(query: string) {
    suggestAbort?.abort();
    clearTimeout(suggestDebounce);
    if (query.trim() === "") {
      // The query has to be forgotten too, not just the results. The picker shows
      // the full catalogue again the moment the box is empty, so leaving the
      // search set in place left the list and the selection validating against
      // different sets — and the stale one could win, quietly replacing the token
      // the user had chosen with the first hit of a search they had just erased.
      suggestions = [];
      suggestFor = "";
      return;
    }
    const controller = new AbortController();
    suggestAbort = controller;
    // The query is recorded immediately so the list is in "searching" mode while
    // the debounce runs; only the request waits.
    suggestFor = query;
    searching_ = true;
    try {
      const found = await new Promise<CatalogToken[]>((resolve) => {
        suggestDebounce = setTimeout(() => {
          void suggestTargets(dest, query, {
            accountId: $accountId$ ?? undefined,
            loaded: catalog,
          })
            .then(resolve)
            .catch((err) => {
              console.error("[bridge] token search failed", err);
              resolve([]);
            });
        }, SUGGEST_DEBOUNCE_MS);
      });
      if (suggestAbort !== controller) return;
      suggestions = found;
    } finally {
      if (suggestAbort === controller) searching_ = false;
    }
  }

  function clearSuggest() {
    suggestAbort?.abort();
    clearTimeout(suggestDebounce);
    suggestions = [];
    suggestFor = "";
  }

  // A search result is a different set from the list, so the selection has to be
  // re-validated against whichever one is on screen.
  $: visibleTokens = suggestFor.trim() === "" ? catalog : suggestions;
  $: if (
    !visibleTokens.some((t) => t.tokenId === targetTokenId) &&
    visibleTokens.length > 0
  ) {
    targetTokenId = visibleTokens[0].tokenId;
  }
  $: targets = visibleTokens;
  $: target = targets.find((t) => t.tokenId === targetTokenId) ?? null;
  $: targetAddress = target?.address ?? null;

  let targetTokenId = "";

  /**
   * Prices for the receive summary, keyed by token id.
   *
   * From the same catalogue the picker is built from, so the two cannot disagree
   * about what a token is worth. `usdFor` omits the figure entirely when there is
   * no price rather than printing a confident "$0.00".
   */
  $: targetPrices = Object.fromEntries(
    catalog.map((t) => [t.tokenId, t.price]),
  );

  // --- amount -------------------------------------------------------------------

  let amountInput: string | undefined = undefined;
  $: amount = parseBaseUnits(amountInput, sourceDecimals);

  $: spendable = (() => {
    if (source === "near")
      return (
        nearHoldings.find((h) => h.tokenId === sourceTokenId)?.balance ?? null
      );
    if (!sourceWalletToken) return null;
    if (!sourceWalletToken.native || solBalance === null) {
      return sourceWalletToken.balance;
    }
    return sourceWalletToken.balance > SOL_FEE_RESERVE
      ? sourceWalletToken.balance - SOL_FEE_RESERVE
      : 0n;
  })();

  function setPercent(pct: number) {
    if (spendable === null) return;
    // Exact, not rounded: the gate compares this against the balance, and a
    // rounded "100%" can come back as more base units than the wallet holds.
    const value = (spendable * BigInt(pct)) / 100n;
    amountInput = formatBaseUnitsExact(value, sourceDecimals);
  }

  // --- search -------------------------------------------------------------------

  let search: RouteSearch | null = null;
  let searching = false;

  /**
   * May this button be pressed at all?
   *
   * One rule, used by both the `disabled` attribute and the click handler, because
   * putting it in two places is what broke this: the handler was fixed to dispatch a
   * parked press before consulting the gate, and the `disabled` attribute kept
   * consulting it first. A disabled button fires no click at all, so the handler never
   * ran and the destination swap silently never happened — with no error, no log, and
   * nothing on screen to say so.
   *
   * A parked leg is always pressable. The route is settled, the money has arrived, and
   * that press is the one that completes the conversion; the gate counts `searching`
   * and the plan list, and either can be false while a transfer is parked.
   */
  $: parkedPress =
    transferState === "awaiting-deposit" || transferState === "awaiting-final";
  $: canPress = transferDone || parkedPress || gate.canSubmit;
  /**
   * The newest search that has *started*, which is what owns the spinner.
   *
   * Not `generation`: that is bumped by `reset()` too, and a bump with no search behind
   * it would orphan the in-flight search's cleanup and strand the spinner on.
   */
  let lastSearchStarted = 0;
  let searchFailed = false;
  let pinnedRailId: string | undefined = undefined;
  let debounce: ReturnType<typeof setTimeout>;
  /**
   * Bumped per search so a slow reply cannot overwrite a newer one. Debouncing
   * alone is not enough: a request started before the user stopped typing can
   * still be the slowest of the batch.
   */
  let generation = 0;

  /**
   * Aborts the retry loop of the search in flight.
   *
   * The waits between re-runs are seconds long, and a plain `setTimeout` would keep
   * one sitting out its full delay after the user had already changed the amount —
   * the new search runs, and the old one lingers for another four seconds holding a
   * spinner it has no right to. Cancelling on supersede is what makes a long retry
   * budget affordable at all.
   */
  let searchingAbort: AbortController | undefined;

  const sleep = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      const timer = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });

  /**
   * Is the form complete enough to price?
   *
   * Split from whether to *go and price it*, because a transfer that has begun has
   * settled the route and the plan on screen is the one being executed.
   */
  $: formPriceable =
    SUPPORTED &&
    amount !== null &&
    amount > 0n &&
    sourceAddress !== null &&
    targetAddress !== null &&
    // Both ends must be known before pricing. The bridge's fee quote is made out to a
    // recipient, and an empty one is rejected by the API — which used to fail every
    // rail at once and leave the form claiming "no route available" when the truth
    // was that a wallet was not connected.
    Boolean(senderAddress) &&
    Boolean(recipientAddress);

  /**
   * The inputs the plan on screen was priced for, or null when nothing is priced.
   *
   * This is what makes the pause below safe rather than merely broad. A transfer
   * settles its route, but only for the amount and target it was asked about: change
   * either and the plan on screen is no longer the plan for what the user is now
   * asking, and it has to be re-derived. `clearAttempt` already encodes that — it
   * keeps the signed swap and re-parks, on the understanding that the bridge and the
   * destination swap are worked out again from it.
   */
  let pricedFor: { amount: bigint; target: string } | null = null;
  $: pricedTargetKey = `${target?.bridgeTokenId ?? targetTokenId}:${
    targetAddress ?? ""
  }`;

  /**
   * Read through a function on purpose.
   *
   * A `$:` that read `pricedFor` directly would close a cycle: the search trigger
   * writes it, and everything this feeds reads it back. Svelte does not track
   * dependencies through a function call, so this is the seam — and the reason it is
   * not simply inlined is that the alternative is a reactive statement that can
   * re-trigger the very search whose result it is recording.
   */
  function formMovedSincePricing(currentAmount: bigint, currentTarget: string) {
    return (
      pricedFor !== null &&
      (currentAmount !== pricedFor.amount || currentTarget !== pricedFor.target)
    );
  }
  $: formChangedSincePricing = formMovedSincePricing(
    amount ?? 0n,
    pricedTargetKey,
  );

  /**
   * Has a transfer begun, such that the route is now a fact rather than a question?
   *
   * Three states, and the middle one is the reason this exists. `awaiting-deposit` is
   * where a NEAR source sits between its two presses: the swap is signed, so the
   * account already holds the rail, and the next step is the bridge. Re-pricing there
   * re-quotes a swap that has already happened — a second, meaningless request for a
   * leg that is done, and an empty answer for it would report no route on a form that
   * is halfway through a working transfer.
   *
   * This was not a missing condition so much as a missing *idea*: the search was only
   * ever guarded for the sake of `clearAttempt`, and never for its own sake. So
   * clicking the button re-fetched every quote, and the NEAR-side swap was re-checked
   * after it had already been signed.
   *
   * Not while the form has moved on, though. A user who changes the amount or the
   * target mid-transfer has abandoned the priced route and wants a new one, and
   * re-deriving it is the whole point — see `formChangedSincePricing`.
   */
  $: searchPaused =
    (transferState === "running" ||
      transferState === "awaiting-deposit" ||
      transferState === "awaiting-final") &&
    !formChangedSincePricing;

  // The raw inputs are named here, not just the boolean derived from them, and that is
  // load-bearing rather than redundant. Svelte re-runs a `$:` when a value it depends
  // on is *assigned a different value* — a boolean that recomputes to `true` is not a
  // change. So a trigger written as `if (formPriceable && !searchPaused)` re-runs only
  // when one of those flips, and editing an amount from 1 to 2 recomputes both to the
  // values they already held. The route then silently stops recalculating on a
  // keystroke, which is what "sometimes it does not update" was.
  //
  // Naming the inputs is what makes a change to any of them re-run this block. The
  // booleans stay, because they are what the branches below are actually about.
  const SEARCH_TRACE = "[search-trace]";
  function searchTrace(why: string, detail?: Record<string, unknown>) {
    if (!import.meta.env?.DEV) return;
    console.log(`${SEARCH_TRACE} ${why}`, detail ?? "");
  }

  $: if (
    !searchPaused &&
    SUPPORTED &&
    amount !== null &&
    amount > 0n &&
    sourceAddress !== null &&
    targetAddress !== null &&
    Boolean(senderAddress) &&
    Boolean(recipientAddress)
  ) {
    debounce = setTimeout(runSearch, SEARCH_DEBOUNCE_MS);
  } else {
    searchTrace("not searching", {
      searchPaused,
      SUPPORTED,
      amount: amount === null ? "null" : amount.toString(),
      amountIsZero: amount !== null && amount <= 0n,
      sourceAddress,
      targetAddress,
      sender: senderAddress ?? null,
      recipient: recipientAddress ?? null,
      transferState,
      formPriceable,
    });
    clearTimeout(debounce);
    // Paused is not the same as unpriceable, and conflating them is what would break
    // the second press: the plan is what the deposit is built from, so it has to stay
    // on screen for as long as the transfer is under way.
    if (!formPriceable) {
      search = null;
      searchFailed = false;
      pricedFor = null;
      // The same invalidation as a recalculation, by the other route there: a form
      // that cannot be priced any more cannot be showing the progress of a transfer
      // that is under way either.
      if (transferState !== "running") clearAttempt();
    }
  }

  onDestroy(() => clearTimeout(debounce));

  async function runSearch() {
    const mine = ++generation;
    lastSearchStarted = mine;
    searching = true;
    searchTrace("searching", { amount: amount?.toString() ?? null });
    searchFailed = false;
    // A recalculation is a new route, so the previous attempt goes with it. Typing
    // an amount after a run failed used to leave that run's error message and its red
    // step on screen under a route that had never been attempted — the app reporting
    // a failure for something the user had not tried.
    //
    // Except mid-flight, where the progress *is* the truth: a search can land while
    // work is happening, and wiping it would leave a signed transfer with no visible
    // state.
    if (transferState !== "running") clearAttempt();
    try {
      // Re-run the whole search for as long as the emptiness looks like a cold
      // router, with the waits growing between attempts. `searching` stays true for
      // the lot, so the form keeps waiting rather than showing a route it does not
      // have — the alternative is a "no route available" that is a lie about a market
      // that is merely cold.
      //
      // A single re-run was not enough, and the arithmetic says so rather than the
      // feel of it: at the measured 10–30% empty rate, two searches still fail about
      // 9% of the time. The budget is only affordable because the rail whitelist cut
      // a search from eight rails to two.
      searchingAbort?.abort();
      searchingAbort = new AbortController();
      const { signal } = searchingAbort;

      let result = await runOneSearch();
      for (let attempt = 0; attempt < EMPTY_RETRY_DELAYS_MS.length; attempt++) {
        if (mine !== generation || signal.aborted) return;
        if (!worthRetryingEmpty(result)) break;
        const wait = emptyRetryDelay(attempt);
        if (import.meta.env.DEV) {
          console.debug(
            `[bridge] every rail came back empty, asking again in ${Math.round(wait)}ms`,
            result.rejected.map((r) => `${r.rail?.tokenId ?? "-"}:${r.reason}`),
          );
        }
        await sleep(wait, signal);
        if (mine !== generation || signal.aborted) return;
        result = await runOneSearch();
      }
      if (mine !== generation) return;
      search = result;
      // What this plan answers, so a later change to the amount or the target is
      // distinguishable from the same question being re-asked. Only a result with
      // plans counts: an empty one is the cold router, not a price.
      pricedFor = result.plans.length
        ? { amount: amount ?? 0n, target: pricedTargetKey }
        : null;
    } catch (err) {
      console.error("[bridge] route search failed", err);
      if (mine !== generation) return;
      search = null;
      searchFailed = true;
    } finally {
      // Cleared by the *newest* search, not by the one that happens to be current.
      //
      // `generation` is also bumped by `reset()`, which starts no search of its own. A
      // search in flight when that happened was therefore never "current" on the way
      // out, skipped this line, and left `searching` true for the rest of the session —
      // a spinner that never stops, and a button the gate refuses.
      if (mine === lastSearchStarted) searching = false;
    }
  }

  async function runOneSearch() {
    return findRoutes({
      source,
      dest,
      // The token actually selected, not a stand-in. This used to be a hardcoded
      // `"near"` on the NEAR side, left over from when NEAR offered one token —
      // but the source list now offers every NEP-141 the account holds, and
      // substituting a constant meant the search never knew what was being spent.
      sourceTokenId,
      // The registry key, not the address: the rail search reasons in keys, and
      // a target that is not a bridge asset has no key at all, which is fine —
      // such a target can never be a rail, only a destination.
      targetTokenId: target?.bridgeTokenId ?? targetTokenId,
      sourceTokenAddress: sourceAddress ?? "",
      targetTokenAddress: targetAddress ?? "",
      // The wallet already resolved this. Without it the search has only the
      // mint to go on and falls back to a shortened address, which is how
      // native SOL ended up labelled `So1111…1112` in the route readout.
      sourceSymbol,
      // The same, for the receiving token. The receive picker is almost entirely
      // tokens the bridge registry has no key for, so "what happens" was reading
      // `npro.n…near` instead of `NPRO` for every one of them, and only the
      // handful the bridge carries showed a ticker.
      targetSymbol: target?.symbol,
      // And its decimals. The search would otherwise guess 18 for anything the
      // bridge does not carry, and that guess rejects a SOL → USDC conversion
      // on the grounds that 122 million units is less than one whole token.
      targetDecimals: target?.decimals,
      amount: amount ?? 0n,
      sender: senderAddress ?? "",
      recipient: recipientAddress ?? "",
      nearAccountId: $accountId$ ?? undefined,
      pinnedRailId,
    });
  }

  function pinRail(event: CustomEvent<string>) {
    pinnedRailId = pinnedRailId === event.detail ? undefined : event.detail;
  }

  /**
   * Start the form over, so a stale quote cannot outlive its inputs.
   *
   * `keepAmount` is for changing the *target*, which does not invalidate what the
   * user typed: they picked an amount, then went back to choose a different token
   * to receive, and clearing the box made them retype a number they had already
   * decided on. Changing the *source* does clear it, because the amount is parsed
   * against the source token's decimals and the same string means something else
   * afterwards.
   */
  /**
   * Forget the previous attempt.
   *
   * Split out of `reset` because there are two reasons to do it and they are not
   * the same one. Editing the form invalidates the plan; a *recalculation* also
   * invalidates the attempt, because a new amount or target is a new route and the
   * old one's progress and failure belong to a route that is no longer on screen.
   *
   * Without this, a run that ended in an error left its red step and its message
   * sitting under a freshly priced route that had never been attempted — the app
   * reporting a failure for something the user has not tried.
   */
  function clearAttempt() {
    // A signed swap is a fact about the chain, not a value in this form.
    //
    // It was cleared here, and a recalculation runs this — so a keystroke could
    // delete a swap that had already been signed. The park went with it, the button
    // fell back to "Convert", and pressing it swapped *again*. That is the report
    // this was fixing: the router being spammed after a swap that had worked, and no
    // bridge ever offered. A swap is not a form value and cannot be un-done by
    // typing.
    //
    // It is also only valid for the amount it swapped. Changing the amount makes it
    // the wrong swap, and keeping it would bridge a stale number — so that is the
    // one thing that does discard it.
    const swapStillApplies =
      swapLeg !== null && amount !== null && amount === swapLeg.forAmount;

    // A transfer in flight is not cancelled by editing the form, but the plan the
    // progress list is rendering must not be one the user has already invalidated.
    activeStep = -1;
    stepFailed = false;
    transferDone = false;
    transferError = null;
    waitingForBridge = null;
    transferMessage = null;

    if (!swapStillApplies) {
      swapLeg = null;
      // The landed amount belongs to the transfer that produced it. Left behind, a
      // second conversion would swap the previous transfer's arrival.
      landedAmount = null;
      transferState = "idle";
      return;
    }

    // A transfer that already finished is not a transfer awaiting a deposit.
    //
    // This branch assumes that a surviving swap means there is a signed swap with
    // nothing bridged — which is true until the moment the whole thing completes, and
    // false afterwards. So a recalculation arriving after the final swap (and one does:
    // the arrival lands in the destination wallet, which is a balance change, which
    // re-prices) re-parked a finished transfer, and the button went back to offering
    // "Bridge to the destination chain" with every step already ticked. The user was
    // asked to bridge money that had arrived.
    if (transferState === "done") {
      // Keep the swap and the landed amount — they are what the receipt below is
      // built from — but do not invent a pending press out of them.
      begin("bridge");
      return;
    }

    // The swap stands, so the park does too: there is a signed swap with nothing
    // bridged, and that is a real position the button still has to act on. Its
    // target may have changed, which is fine — the swap is on the source side and
    // the bridge and destination swap are re-derived from it.
    transferState = "awaiting-deposit";
    begin("bridge");
  }

  function reset(keepAmount = false) {
    if (!keepAmount) amountInput = undefined;
    pinnedRailId = undefined;
    search = null;
    searchFailed = false;
    pricedFor = null;
    // With the search, the plan that was running. Left behind, a form that had been
    // reset would go on rendering the finished transfer's steps and quoting its numbers,
    // because `runningPlan` is deliberately sticky for the whole of a transfer and that
    // includes the gap between a NEAR source's two presses.
    runningPlan = null;
    clearAttempt();
    generation++;
  }

  // --- summary ------------------------------------------------------------------

  $: plans = search?.plans ?? [];
  $: best = plans.find((p) => planKey(p) === pinnedRailId) ?? plans[0] ?? null;
  /**
   * Which step the transfer is on, or -1 before it starts.
   *
   * Drives the same list that was shown as the plan, so what the user watches
   * happen is the plan they agreed to rather than a second, separately-written
   * list that can quietly promise steps the route does not have.
   */
  let activeStep = -1;

  /** Set once every step has finished, so the form stops offering to send. */
  let transferDone = false;

  /** Set when a step fails, so it renders as failed rather than spinning. */
  let stepFailed = false;

  /**
   * Run a transfer, advancing the plan as each leg completes.
   *
   * `onProgress` fires the step advance, so the list the user agreed to is the
   * list that ticks over — there is no second progress view that can promise
   * steps the route does not have, or skip one that failed silently.
   *
   * A failure stops the sequence where it happened rather than jumping to an
   * error, because "the swap worked and the bridge did not" is a materially
   * different situation from "nothing happened" and the user needs to know which
   * their funds are in.
   */
  async function startTransfer() {
    if (!gate.canSubmit || !best) return;
    if (!amount || !senderAddress || !recipientAddress) return;

    activeStep = -1;
    stepFailed = false;
    transferDone = false;
    transferState = "running";
    // Captured here, once, while `best` is still the plan being signed. Every later leg
    // reads this rather than the derived value, so a search landing mid-transfer cannot
    // substitute a different rail underneath the one that was signed.
    runningPlan = best;

    try {
      // A same-chain conversion is one swap and no bridge, so it never touches the
      // deposit path. It is also the only way to reach a token that exists on a
      // single chain.
      if (runningPlan.kind === "swap") {
        await runSameChainSwap({
          plan: runningPlan,
          amountIn: amount,
          chain: source,
          // The addresses the search was priced with. A same-chain plan has no rail, so
          // `plan.rail` carries none of this and the function cannot derive it — see the
          // note there.
          sourceTokenId: sourceAddress!,
          targetTokenId: targetAddress!,
          accountId: $accountId$ ?? undefined,
          selector: await $selector$,
          onProgress: ({ leg }) => {
            if (leg === "convert") begin("swap");
          },
        });
        next();
        return;
      }

      // A NEAR source that needs a swap stops after the swap, and the bridge deposit
      // is a second press.
      //
      // Each is its own wallet interaction and the second happens after the user has
      // committed, so batching them spent the one gesture on everything and left the
      // deposit nothing to answer. It also shrinks the bridge's batch to just the
      // storage deposit and the locker call, which is where a missing
      // `InitTransferEvent` almost certainly means the wallet withheld the logs
      // rather than that the deposit failed.
      if (source === "near" && runningPlan.sourceSwap) {
        swapLeg = await runNearSourceSwap({
          plan: runningPlan,
          amount,
          sourceTokenId: sourceAddress!,
          accountId: $accountId$!,
          selector: await $selector$,
          onProgress: ({ leg }) => {
            if (leg === "swap") begin("swap-in");
          },
        });
        // The swap is signed, so it is done. The deposit is not signed yet, so the
        // bridge step must not be — the whole point of the split.
        // The swap is signed, so it is done. Park on the *bridge* step, which is
        // what is actually waiting: parking on the swap rendered the finished swap as
        // pending, which is the same class of lie as a checkmark on an unsigned step.
        // The swap's own progress handler still does not advance, because at that
        // point nothing has been signed.
        begin("bridge");
        transferState = "awaiting-deposit";
        return;
      }

      // No `next()` here. `finishSourceAndTail` finishes the transfer itself when it
      // finishes it, and *parks* when a leg is waiting for a press. Calling `next()`
      // unconditionally after it meant the parked case ticked the last step, marked the
      // transfer done and opened the receipt — for a conversion whose destination swap
      // had not run. The NEAR-source branch above returns before reaching this, which is
      // why the same mistake was invisible there.
      await finishSourceAndTail();
    } catch (err) {
      console.error("[bridge] transfer failed", err);
      waitingForBridge = null;
      transferMessage = null;
      stepFailed = true;
      // A dismissed wallet popup rejects exactly like a failed transfer, and it
      // is the common case: the user closes the popup because they changed their
      // mind. Leaving the form in its submitting state meant the button stayed
      // disabled with a spinner and no way back except a reload, so "pending"
      // became a dead end rather than a state the user could act on.
      transferState = "failed";
      transferError =
        err instanceof Error ? err.message : "The transfer failed. Try again.";
    } finally {
      await reloadBalances();
    }
  }

  /** The signed-off error, shown under the step that failed. */
  let transferError: string | null = null;

  /**
   * Whether a transfer is in flight, kept apart from `activeStep`.
   *
   * `isSubmitting` used to be derived from the step index, which conflated "work
   * is happening" with "a step has been reached". A rejected signature advances no
   * step and so looked like nothing had started, while a dismissed popup left the
   * index advanced with the button permanently disabled. A transfer is running or
   * it is not, and that is a separate fact from which step is showing.
   */
  let transferState:
    | "idle"
    | "running"
    | "awaiting-deposit"
    | "awaiting-final"
    | "done"
    | "failed" = "idle";
  $: isSubmitting = transferState === "running";

  /**
   * The destination leg on its own, from a real button press.
   *
   * Split out of `startTransfer` because it has to be one. A NEAR swap is signed
   * by a wallet that opens a popup, and a popup is only permitted in direct
   * response to a user gesture — by the time the bridge has finalised, the gesture
   * that started the transfer is minutes old and no longer counts. Signing from
   * there fails with "Popup was blocked" on a bridge that worked perfectly.
   */
  /**
   * The steps of the route being run, shared by the rendering and the progress.
   *
   * Component scope rather than a local of `startTransfer`, because the second
   * press of a NEAR conversion advances the same list from outside that call.
   */
  // The steps of the plan actually running, so the progress list cannot be rendering a
  // different route from the one being executed — or from the one that just finished.
  $: steps =
    (runningPlan ?? best) ? planSteps(runningPlan ?? best!, source, dest) : [];

  /**
   * Mark the step that is *starting* as the active one.
   *
   * The code used to advance on each progress event, which made every step one
   * ahead of reality: the event named the leg about to run, so advancing on it
   * meant the step was already ticked off, and the bridge showed as complete while
   * the wallet was still open and nothing had been signed. Announcing the step that
   * begins — rather than inferring completion from the next one starting — is what
   * makes "done" mean done.
   */
  function begin(id: string) {
    const index = steps.findIndex((step) => step.id === id);
    // An id the plan does not contain leaves the current step alone rather than
    // jumping to -1 and blanking the list.
    if (index >= 0) activeStep = index;
  }

  function next() {
    // A transfer cannot be finished while a leg is waiting to be signed. Every caller
    // that advances assumes it is the last thing to happen, and one that advanced past a
    // park marked the whole conversion done and opened the receipt for a swap that had
    // not run — with no error anywhere, because from the code's point of view nothing
    // had gone wrong.
    if (
      transferState === "awaiting-deposit" ||
      transferState === "awaiting-final"
    ) {
      return;
    }
    if (activeStep + 1 >= steps.length) {
      activeStep = steps.length;
      transferDone = true;
      transferState = "done";
      showReceipt();
    } else {
      activeStep += 1;
    }
  }

  /**
   * The receipt, once the whole thing has landed.
   *
   * Opened from the two places a conversion can finish — the last step ticking over,
   * and the final swap resolving — and guarded on not being open already, because
   * `next` can be reached again by a recalculation that re-derives the steps.
   *
   * What it reports is the amount that *arrived*, not the one the plan estimated. The
   * two differ by the bridge's fee and the destination swap's spread, and a receipt
   * that quoted the estimate would be the one number on screen that is not a fact.
   */
  function showReceipt() {
    if (!transferDone || $isBottomSheetOpen$) return;
    // The plan that ran, not the one currently on offer. They are the same object
    // unless a search landed mid-transfer, which is exactly when a receipt quoting a
    // different rail's numbers would be least welcome.
    const plan = runningPlan ?? best;
    if (!plan) return;
    // What arrived, in order of how much it can be trusted.
    //
    // `receivedAmount` is the destination swap's own output and is the answer whenever
    // there was one. `landedAmount` is *not* it: that is what the bridge paid out,
    // before the final swap, so preferring it would report the pre-swap arrival as what
    // the user ended up with. The plan's guaranteed figure is the last resort, for a
    // route that had no destination swap to measure.
    const received = receivedAmount ?? plan.receiveAmount;
    if (received === null || received === undefined) return;
    const decimals = plan.targetDecimals;
    // The price comes from the catalogue entry the row is rendering — `RoutePlan`
    // carries no price of its own.
    const price = target?.price ?? null;
    const usd =
      price && price > 0 ? (Number(received) / 10 ** decimals) * price : null;
    openBottomSheet(
      ConversionDone,
      {
        steps,
        receivedAmount: formatBaseUnits(received, decimals),
        receivedSymbol: plan.targetSymbol,
        receivedUsd: usd,
        routeSummary: `${CHAINS[source].name} → ${CHAINS[dest].name} → ${plan.targetSymbol}`,
        // The token's artwork, best-effort: a token the aggregator has no icon for
        // falls back to the placeholder rather than to nothing.
        tokenIcon: target?.icon ?? "",
        chainName: CHAINS[dest].name,
        chainIcon: CHAINS[dest].icon,
        onReset: startAnother,
      },
      "m",
    );
  }

  /**
   * Start over from a finished transfer.
   *
   * A full reset, and the difference from a mere recalculation is the source token:
   * the tokens it selected belong to a transfer that has now spent them, so keeping
   * them would reopen the form on a balance the user no longer has. The amount goes
   * with them, because it was chosen for that spend.
   *
   * The destination token is kept. Nothing was spent on it, and it is usually where
   * the user wants to go next.
   */
  function startAnother() {
    swapLeg = null;
    landedAmount = null;
    receivedAmount = null;
    transferDone = false;
    amountInput = undefined;
    // The source token the previous transfer spent. Left as it was, the form would
    // reopen on a balance the user no longer has and the next attempt would be refused
    // for the wrong reason — or worse, would spend whatever arrived in its place.
    sourceTokenId = source === "solana" ? WSOL_MINT : "near";
    reset();
  }

  /**
   * The source leg for every route that is not a split NEAR one, then everything
   * that follows the bridge.
   *
   * Factored out because two paths reach it: a one-press route, and the second press
   * of a split NEAR one. The bridge wait and the destination leg are identical in
   * both, and having them in two places is how they drift.
   */
  async function finishSourceAndTail() {
    // The same guard `startTransfer` opens with. A second press arrives long after
    // the first, and the wallet or the amount can have changed in between.
    if (!amount || !recipientAddress) {
      throw new TransferError(
        "Enter an amount and make sure your destination wallet is still connected.",
      );
    }
    const result =
      source === "solana"
        ? await runFromSolana({
            plan: runningPlan!,
            amount,
            sourceMint: runningPlan!.sourceSwap
              ? sourceAddress!
              : runningPlan!.rail!.sourceAddress,
            to: dest,
            recipient: recipientAddress,
            provider: solanaWallet.getProvider()!,
            onProgress: ({ leg }: { leg: string }) => {
              if (leg === "swap") begin("swap-in");
              if (leg === "bridge") begin("bridge");
            },
          })
        : await runFromNear({
            // A straight NEAR bridge with no swap is a single transaction, so it
            // needs no split: one press signs the lot.
            plan: runningPlan!,
            amount,
            sourceTokenId: sourceAddress!,
            to: dest,
            recipient: recipientAddress,
            accountId: $accountId$!,
            selector: await $selector$,
            onProgress: ({ leg }: { leg: string }) => {
              if (leg === "swap") begin("swap-in");
            },
          });

    if (source === "near") {
      // One signature covered the lot, so the bridge step is done.
      begin("bridge");
    }
    return await afterBridge(result.arrived, result);
  }

  /**
   * Wait for the bridge to finalise, then run or park the destination leg.
   *
   * The wait is the bridge's own API rather than a balance poll, because it reports
   * the transfer's real phase and cannot confuse "in flight" with "arrived".
   */
  async function afterBridge(
    arrived: bigint,
    result: { txHash?: string; originNonce?: number; signature?: string },
  ) {
    const near = result as { txHash?: string; originNonce?: number };
    const solana = result as { signature: string };
    const transfer =
      source === "solana"
        ? await waitForTransfer({
            txHash: solana.signature,
            onPhase: (phase, attempt, total) => {
              waitingForBridge = { phase, attempt, total };
            },
          })
        : await waitForTransfer({
            // The hash is preferred: it needs nothing parsed out of a receipt log,
            // and the nonce only exists when the Omni SDK found its event.
            ...(near.txHash
              ? { txHash: near.txHash }
              : {
                  origin: { chain: "Near" as const, nonce: near.originNonce! },
                }),
            onPhase: (phase, attempt, total) => {
              waitingForBridge = { phase, attempt, total };
            },
          });
    waitingForBridge = null;

    // Indexed but not finalised means the deposit is submitted and the money is in
    // flight. Spending it would be the same mistake one phase earlier.
    if (phaseOf(transfer) !== "finalised") {
      throw new TransferError(
        "The bridge has not finalised yet. Your funds are on their way — swap them from the token list once your balance updates.",
      );
    }
    if (runningPlan!.targetSwap) {
      if (dest === "near") {
        // The swap needs the wallet, and the wallet needs a popup, and the gesture
        // that started the transfer is minutes old. So it parks and waits for a
        // real press, which is also a real decision: the user can see the balance
        // arrive before committing.
        transferState = "awaiting-final";
        landedAmount = arrived;
        // Move to the swap step and mark it waiting rather than running. Parking
        // without this left the *bridge* showing as active — a spinner on a leg the
        // API had already called finalised.
        begin("swap-out");
        return;
      }
      // Solana signs with the injected adapter and opens no popup.
      await runFinalLeg(arrived);
    }
    next();
  }

  /**
   * The second press of a split NEAR route: sign the bridge deposit.
   *
   * Separate from the swap because it is a separate wallet interaction that happens
   * after the user has committed, and because the two are different transactions
   * with different consequences — the swap can be repeated, the deposit cannot.
   */
  async function runDepositPress() {
    if (!amount || !recipientAddress) {
      transferState = "failed";
      transferError =
        "Enter an amount and make sure your destination wallet is still connected.";
      return;
    }
    if (!swapLeg) {
      transferState = "failed";
      transferError =
        "The swap's result is unknown, so the deposit cannot be signed. Your tokens are still in your account — start again.";
      return;
    }
    transferState = "running";
    transferMessage = null;
    begin("bridge");
    try {
      const result = await runNearDeposit({
        plan: runningPlan!,
        to: dest,
        recipient: recipientAddress,
        accountId: $accountId$!,
        selector: await $selector$,
        swap: swapLeg,
        onProgress: ({ message }) => {
          transferMessage = message;
        },
      });
      await afterBridge(result.arrived, result);
    } catch (err) {
      console.error("[bridge] deposit failed", err);
      waitingForBridge = null;
      transferMessage = null;
      stepFailed = true;
      transferState = "failed";
      transferError =
        err instanceof Error ? err.message : "The deposit did not go through.";
    } finally {
      await reloadBalances();
    }
    transferMessage = null;
  }

  async function runFinalLeg(amountIn: bigint) {
    begin("swap-out");
    // A NEAR route can be several transactions that depend on each other, and the
    // user signs each one. "Step 2 of 3" is the difference between three prompts
    // and the sense that something has gone wrong.
    transferMessage = null;
    try {
      // What the swap actually delivered, in the target's base units.
      //
      // Both destination swaps have always returned this and the panel threw it away,
      // which left the completion summary with nothing to report but the quote's
      // guaranteed figure. That number is a real guarantee and a poor receipt: the
      // difference between it and the truth is the swap's spread, and a receipt is the
      // one place that should not round in the user's favour.
      let produced: bigint | null = null;
      if (dest === "near") {
        const result = await runNearDestinationSwap({
          // Native NEAR, not the wrap contract: the bridge's payout unwraps, so
          // that is what the account is holding. Quoting the wrap contract asks
          // the router to unwrap first, and that transaction reverts.
          railTokenId: railAssetOnArrival(runningPlan!.rail!, "near"),
          targetTokenId: targetAddress!,
          amountIn,
          accountId: $accountId$!,
          selector: await $selector$,
          onProgress: ({ message }) => {
            transferMessage = message;
          },
        });
        produced = result.received;
      } else {
        const result = await runSolanaDestinationSwap({
          railMint: runningPlan!.rail!.destAddress,
          targetMint: targetAddress!,
          amountIn,
          provider: solanaWallet.getProvider()!,
          onProgress: ({ message }) => {
            transferMessage = message;
          },
        });
        produced = result.received;
      }
      receivedAmount = produced;
    } catch (err) {
      // A failure this late is a different situation from a failed transfer: the
      // bridge succeeded and the money is in the account. Saying so is the
      // difference between a user who swaps from the token list and a user who
      // thinks their funds are stuck in the bridge.
      console.error("[bridge] final swap failed", err);
      transferMessage = null;
      stepFailed = true;
      transferState = "failed";
      transferError =
        err instanceof Error ? err.message : "The swap did not go through.";
      return;
    } finally {
      await reloadBalances();
    }
    // Cleared on the way out as well as on the way in. The banner is set from the
    // swap's own progress callback and nothing else ever took it down, so a
    // successful swap left "Converting on Near" and a spinner sitting under a
    // finished plan — the form disagreeing with itself long after the work was
    // done.
    transferMessage = null;
    transferState = "done";
    transferDone = true;
    next();
  }

  /** The button's second half: finish the conversion from a real click. */
  async function runFinalSwap() {
    if (landedAmount === null) {
      transferState = "failed";
      transferError =
        "The bridged amount is unknown, so the swap cannot be quoted. Your funds have arrived — swap from the token list.";
      return;
    }
    transferState = "running";
    stepFailed = false;
    transferError = null;
    await runFinalLeg(landedAmount);
  }

  /**
   * What landed, held between the two halves of a NEAR-sourced conversion.
   *
   * The arrived amount is the destination swap's input, and it is only knowable
   * after the bridge has finalised. Keeping it here is what lets the swap be a
   * separate press rather than a continuation: the first press cannot know the
   * amount the second one needs.
   */
  let landedAmount: bigint | null = null;

  /**
   * What the destination swap actually delivered, in the target's base units.
   *
   * Null until it runs, and null still if it failed — in which case the receipt is not
   * shown at all, because a transfer whose last leg failed has not received anything
   * and saying otherwise would be the lie this whole sheet exists to avoid.
   */
  let receivedAmount: bigint | null = null;

  /**
   * The plan this transfer is actually running, captured when it was submitted.
   *
   * Every leg used to read `best`, which is *derived* — recomputed whenever the search
   * publishes. So the plan that got signed and the plan the later legs read were the
   * same only by accident, and a search landing mid-transfer could swap one for a
   * different rail. The symptom was a destination swap that quietly stopped existing:
   * `afterBridge` asked the *new* plan whether it had a target swap, was told no, and
   * finished the transfer without ever doing it. The receipt then opened on time the
   * user had not spent a minute on.
   *
   * A plan is what was signed, so it is held like a receipt rather than looked up again.
   */
  let runningPlan: RoutePlan | null = null;

  /**
   * What the NEAR source swap produced, held between the swap and the deposit.
   *
   * The deposit is a second press, and it needs two things only the swap half knows:
   * the rail balance from before, so the swap's real output can be isolated from
   * whatever the account already held, and the floor it was signed against.
   */
  let swapLeg: NearSwapLeg | null = null;

  /**
   * Progress of the wait for the bridge to finalise, or null when not waiting.
   *
   * This is the longest silent part of a cross-chain transfer — minutes, during
   * which nothing is happening on-chain that the user can see — so it is shown
   * rather than left as a spinner on a step that looks stalled.
   */
  /**
   * The live status of the leg being signed, when it has one to report.
   *
   * Null in the common case, and deliberately not a spinner: a Solana swap is one
   * transaction with nothing to say between the prompt and the receipt.
   */
  let transferMessage: string | null = null;

  let waitingForBridge: {
    phase: string;
    attempt: number;
    total: number;
  } | null = null;

  /** Refresh both wallets, since either may have moved. */
  async function reloadBalances() {
    if (source === "solana") {
      loadedFor = null;
      void loadSolanaTokens();
    }
    if ($accountId$) await loadNearHoldings($accountId$);
  }

  $: gate = convertGate({
    amount,
    search,
    searching,
    searchFailed,
    sourceConnected: Boolean(senderAddress),
    destConnected: Boolean(recipientAddress),
    dest,
    isSubmitting,
    awaitingFinal: transferState === "awaiting-final",
    awaitingDeposit: transferState === "awaiting-deposit",
    done: transferDone,
    available: spendable,
    nativeBalance: source === "solana" ? solBalance : null,
    nativeReserve: SOL_FEE_RESERVE,
    supported: SUPPORTED,
  });

  function connect(chain: ConvertChain) {
    if (chain === "near") void requireNearWallet("shitzu");
    else void requireSolanaWallet("shitzu");
  }

  // --- wallet discovery ---------------------------------------------------------

  /**
   * Reload whenever the wallet changes, and also when the source chain comes back
   * to Solana after a load that produced nothing.
   *
   * The guard is on the owner *and* the result, not the owner alone. Keying only
   * on the owner meant a first attempt that failed — an RPC blip, a rate limit, a
   * connection that was not ready yet — left `loadedFor` already set to this
   * wallet, so no later attempt was ever made and "Pay with" stayed empty for the
   * rest of the session. An empty list is a failure worth retrying, not a result.
   *
   * The `solanaTokens.length === 0` clause that used to sit here was not a retry and
   * could not become one. Its dependencies are the public key and the token list, and a
   * load that produces nothing changes neither — the key is the same and the list is
   * the same empty array — so re-assigning equal values re-runs nothing. It only ever
   * fired when something else happened to invalidate this block. Retrying an empty read
   * now happens inside `loadSolanaTokens`, where an attempt actually happens.
   */
  $: if (
    shouldLoadWallet({
      publicKey: $publicKey$?.toBase58() ?? null,
      loadedFor,
      loadInFlight: isLoadingSolanaTokens,
    })
  ) {
    loadedFor = $publicKey$!.toBase58();
    void loadSolanaTokens();
  }

  /**
   * Attempts a wallet read gets before the list is left empty.
   *
   * Three, because the failures are all "not ready yet" in character: a connection
   * that has not finished setting up on page load, an RPC that rate-limits the first
   * request, a token-account list that is mid-sweep. None of them is fixed by asking
   * again immediately, so the gap grows, and the whole thing is abandoned rather than
   * retried forever.
   */
  const WALLET_LOAD_ATTEMPTS = 3;
  const WALLET_LOAD_BACKOFF_MS = [400, 1200];

  /**
   * Did every attempt come back with nothing?
   *
   * Tracked because `fetchWalletTokens` cannot fail loudly: each token-program read is
   * caught and answered with an empty list, and the native balance carries its own
   * `.catch(() => 0)`. A rejected RPC therefore arrives as a *successful* read of an
   * empty wallet — not an exception, so a retry written in terms of `catch` never
   * fires. That is how a refresh left the Solana side permanently empty: nothing
   * retried, nothing logged, and the list said the wallet held nothing.
   *
   * So the retry is written in terms of the result rather than the outcome. An empty
   * list is asked about again, because it is far more likely to be a read that did not
   * land than an account holding no SOL and no tokens at all.
   */
  let solanaReadCameBackEmpty = false;

  async function loadSolanaTokens() {
    const requested = $publicKey$;
    if (!requested) return;
    const sameWallet = () => $publicKey$?.toBase58() === requested.toBase58();
    isLoadingSolanaTokens = true;
    solanaReadCameBackEmpty = false;
    try {
      for (let attempt = 1; attempt <= WALLET_LOAD_ATTEMPTS; attempt++) {
        if (attempt > 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, WALLET_LOAD_BACKOFF_MS[attempt - 2] ?? 2000),
          );
        }
        // The user switched wallets or disconnected while we were waiting. Whatever
        // comes back now belongs to an account nobody is looking at.
        if (!sameWallet()) return;
        try {
          const found = await fetchWalletTokens(
            solanaWallet.getConnection(),
            requested,
          );
          if (!sameWallet()) return;
          if (found.length === 0) {
            solanaReadCameBackEmpty = true;
            if (attempt < WALLET_LOAD_ATTEMPTS) {
              // Not a failure we can prove, and not a result we can believe either.
              // Ask again rather than telling the user their wallet is empty.
              console.warn(
                `[bridge] Solana balances came back empty (attempt ${attempt} of ${WALLET_LOAD_ATTEMPTS})`,
              );
              continue;
            }
            console.error(
              "[bridge] every attempt to read Solana balances came back empty; the RPC is not answering, or the wallet really is empty",
            );
          }
          solanaTokens = found;
          // The destination list may have been built before this landed, without it.
          holdingsVersion += 1;
          // Keep the current selection if it is still held, else fall back to the
          // first token that can actually be swapped.
          if (!found.some((t) => t.mint === sourceTokenId)) {
            sourceTokenId =
              found.find((t) => t.routable)?.mint ??
              found[0]?.mint ??
              WSOL_MINT;
          }
          return;
        } catch (err) {
          console.error(
            `[bridge] could not read Solana balances (attempt ${attempt} of ${WALLET_LOAD_ATTEMPTS})`,
            err,
          );
        }
      }
      console.error(
        "[bridge] gave up reading Solana balances; the Solana side will show no tokens",
      );
    } finally {
      // Always. Gating this on the wallet left the flag stuck at `true` whenever the
      // account changed mid-load, and `loading={isLoadingSolanaTokens}` then put a
      // spinner where the balances should be — for the rest of the session, with no
      // way for the user to tell that from a read still in progress. A newer load for
      // a newer wallet owns the flag from here.
      isLoadingSolanaTokens = false;
    }
  }

  $: if ($accountId$ && nearLoadedFor !== $accountId$) {
    nearLoadedFor = $accountId$;
    void loadNearHoldings($accountId$);
  }

  /**
   * The RPC calls the holdings loader needs, bound to this app's node.
   *
   * `ft_balances` on the wrapping contract is the one call that enumerates every
   * NEP-141 an account holds; there is no indexer endpoint that replaces it
   * without a third-party dependency, and FastNear's public balances route is
   * currently 404. Anything that fails falls back to asking per token, bounded to
   * the bridge's own assets.
   */
  const nearDeps: NearBalancesDeps = {
    userTokens: (accountId) => intearUserTokens(accountId),
    fastNearBalances: (accountId) => fastNearBalances(accountId),
    ftBalances: (accountId) => ftBalances(accountId),
    balanceOf: async (tokenId, accountId) => {
      const { Ft } = await import("$lib/near");
      return (await Ft.balanceOf(tokenId, accountId, 0)).toString();
    },
    nearBalance: (accountId) => nativeNearBalance(accountId),
    /**
     * Symbol, decimals and icon for a held token, from the indexer's list rather
     * than from `ft_metadata`.
     *
     * It used to call `ft_metadata` once per holding, which for a wallet with 68 of
     * them is 68 RPC calls on a page that already had the answers — the same
     * indexer that priced the token also publishes its metadata, and the
     * receive-list catalogue is built from exactly that. A token the curated list
     * has never heard of falls back to the RPC call, so this degrades to the old
     * behaviour for the minority rather than for everyone.
     */
    metadata: async (tokenId) => {
      const known = catalog.find((token) => token.address === tokenId);
      if (known) {
        return {
          symbol: known.symbol,
          decimals: known.decimals,
          icon: known.icon || undefined,
        };
      }
      const { Ft } = await import("$lib/near");
      const meta = await Ft.metadata(tokenId);
      return {
        symbol: meta.symbol ?? undefined,
        decimals: meta.decimals ?? undefined,
        icon: meta.icon ?? undefined,
      };
    },
  };

  async function loadNearHoldings(accountId: string) {
    isLoadingNearHoldings = true;
    try {
      const found = await loadNearHoldingsFor(
        accountId,
        REGISTRY,
        nearDeps,
        (ids) => pricesForNear(ids),
      );
      nearHoldings = found;
      // Bumped *after* the balances land, not before the request goes out. The counter
      // exists to tell the destination list that what it was built from has changed,
      // and bumping it on the way in rebuilt the list against the holdings it already
      // had — which on a first load is none — and then nothing told it the new ones
      // had arrived. So a NEAR destination listed the bridge's assets and none of the
      // wallet's own tokens, while the Solana side, which bumps after its assignment,
      // was fine.
      holdingsVersion += 1;
    } catch (err) {
      console.error("[bridge] could not read NEAR balances", err);
      nearHoldings = [];
      holdingsVersion += 1;
    } finally {
      isLoadingNearHoldings = false;
    }
  }

  /** USD prices for the tokens held, so they can be ordered by value. */
  async function pricesForNear(ids: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    const wanted = ids.filter((id) => id !== "near");
    if (wanted.length === 0) return out;
    // The indexer prices by contract id and already knows decimals, so this is
    // one request for everything held.
    const found = await searchNear(
      wanted.join(" "),
      $accountId$ ?? undefined,
    ).catch(() => []);
    for (const token of found) {
      if (token.price !== undefined) out.set(token.tokenId, token.price);
    }
    return out;
  }
</script>

<section class="space-y-4 text-shitzu-1">
  {#if !SUPPORTED}
    <div
      class="rounded-xl bg-white/5 border border-amber-300/45 p-4 text-sm text-amber-200"
    >
      <div class="font-semibold mb-1">Not available on testnet</div>
      <div class="text-shitzu-2">
        Converting between tokens needs mainnet. The swap aggregator has no
        testnet deployment, so a transfer could be signed but never settle.
      </div>
    </div>
  {/if}

  <!--
    From and To, each one card: which chain, whose address, and which token.

    These were four stacked blocks — both chain pickers, then both token lists —
    so the chain you were paying *from* sat directly above the chain you were
    paying *to*, with the tokens belonging to each one somewhere else entirely.
    Picking a chain and then a token on it is a single decision, and it now reads
    as one. It also retires the "Pay with" and "Receive" headings, which said the
    same thing as From and To while implying they were something else.
  -->
  <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
    <ChainEnd
      bare
      label="From"
      network={source}
      address={senderAddress}
      connected={Boolean(senderAddress)}
      onPick={pickSource}
      onConnect={() => connect(source)}
    />

    <!--
      One list, whichever chain the source is on. The two branches used to differ
      only in which balance they loaded, and having them as separate blocks meant
      the NEAR side quietly never learned to show anything but native NEAR.
    -->
    <div class="mt-3">
      <SourceTokenList
        options={sourceOptions}
        selectedId={sourceTokenId}
        showHeading={false}
        loading={source === "solana"
          ? isLoadingSolanaTokens
          : isLoadingNearHoldings}
        emptyMessage={sourceWalletConnected
          ? solanaBalancesUnreadable
            ? "Couldn't read this wallet's balances. Reconnect and try again."
            : "No tokens found in this wallet."
          : "Connect your wallet to see your balances."}
        on:select={(e) => {
          sourceTokenId = e.detail;
          reset();
        }}
      />
    </div>

    <!--
      The amount is a card inside the From card, not a sibling of it.
      Everything about spending — which chain, which wallet, which token, how much
      of it — is one decision, and it had been split across two cards with the
      To card in between. It also puts the token the balance refers to directly
      above the number that balance is about.
    -->
    <div class="mt-3 rounded-lg bg-white/5 border border-shitzu-4/45 p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-medium">Amount</span>
        <span class="text-xs text-shitzu-2 text-right">
          {#if spendable === null}
            Balance &mdash;
          {:else}
            Balance {formatBaseUnits(spendable, sourceDecimals)}
            {sourceSymbol}
          {/if}
        </span>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <input
          class="flex-1 bg-transparent outline-none text-3xl font-semibold w-full min-w-0 text-shitzu-1 placeholder:text-shitzu-500"
          type="text"
          inputmode="decimal"
          placeholder="0.0"
          bind:value={amountInput}
          on:input={() =>
            searchTrace("amount typed", {
              raw: amountInput ?? null,
              parsed: amount === null ? "null" : amount.toString(),
              sourceDecimals,
              sourceTokenId,
            })}
        />
        {#if sourceIcon}
          <img
            src={sourceIcon}
            alt={sourceSymbol}
            class="w-6 h-6 rounded-full"
          />
        {/if}
        <span class="text-base font-medium text-shitzu-2 shrink-0"
          >{sourceSymbol}</span
        >
      </div>
      {#if amount !== null && amount > 0n && sourcePrice > 0}
        <div class="text-xs text-shitzu-2 mt-1">
          ≈ {usdFor(amount, sourceDecimals, sourcePrice)}
        </div>
      {/if}
      <div class="grid grid-cols-4 gap-1.5 mt-3">
        {#each PERCENTS as pct (pct)}
          <button
            type="button"
            class="px-2 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-shitzu-1 border border-shitzu-4/45 hover:bg-white/10 transition-colors disabled:text-shitzu-600 disabled:hover:bg-white/5"
            disabled={!spendable || spendable <= 0n}
            on:click={() => setPercent(pct)}
          >
            {pct}%
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
    <ChainEnd
      bare
      label="To"
      network={dest}
      address={recipientAddress}
      connected={Boolean(recipientAddress)}
      onPick={pickDest}
      onConnect={() => connect(dest)}
    />

    <div class="mt-3">
      <TargetTokenList
        options={targets}
        network={dest}
        selectedId={targetTokenId}
        prices={targetPrices}
        showHeading={false}
        loading={isLoadingCatalog || searching_}
        sameChain={source === dest}
        searching={searching_}
        on:search={(e) => void runSuggest(e.detail)}
        on:clearSearch={clearSuggest}
        on:select={(e) => {
          targetTokenId = e.detail;
          // The amount is not touched: it was already decided, and the quote is
          // re-run for the new target.
          reset(true);
        }}
      />
    </div>
  </div>

  <!--
    One summary card: the route, what the swap yields, what the bridge takes, and
    what actually lands. The bridge deducts its fee from the deposited amount, so
    slightly less than the swap output arrives, and that difference used to be
    invisible.
  -->
  <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 space-y-1.5">
    {#if plans.length > 0}
      <div class="space-y-1.5 pb-1.5">
        <div
          class="text-xs font-semibold uppercase tracking-wide text-shitzu-3"
        >
          {plans.length === 1 ? "Route" : `${plans.length} routes`}
        </div>
        <RouteList
          {plans}
          pending={searching}
          selectedRailId={best ? planKey(best) : undefined}
          on:select={pinRail}
        />
      </div>
    {/if}

    {#if best}
      <SummaryRow
        label="Via"
        value={describePlan(best)}
        tone="muted"
        pending={searching}
      />
      <!--
        No "Bridge fee" row when there is no bridge. A same-chain swap is charged
        by the DEX, whose cost is already inside the quoted output, so the honest
        statement is that the row does not exist rather than a zero or a dash —
        a bridge fee on a route with no bridge in it is a contradiction on screen.
      -->
      {#if best.kind !== "swap" && best.rail}
        <SummaryRow
          label="Bridge fee"
          value={best.sourceSwap || best.nativeFee > 0n
            ? costSummary(best, source) || null
            : null}
          tone="warning"
          pending={searching}
        />
      {/if}
      <SummaryRow
        label="You receive"
        value={best.receiveAmount === null
          ? null
          : receiveSummary(best, targetPrices[targetTokenId])}
        tone="strong"
        pending={searching}
      />
    {:else if !searching}
      <SummaryRow
        label="Route"
        value={gate.noRoute
          ? "No route available"
          : searchFailed
            ? "Couldn't price this"
            : "Enter an amount"}
        tone={gate.noRoute || searchFailed ? "warning" : "muted"}
      />
    {/if}
  </div>

  <!--
    The full plan, spelled out, before anything is signed.

    Three of these steps need three separate signatures across two wallets, and
    the last cannot even be signed until the bridge has finalised. Collapsing that
    into "Via SHITZU" hid all of it, and left the destination swap looking like
    something that had already happened.
  -->
  {#if best && amount !== null && amount > 0n}
    <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
      <div
        class="text-xs font-semibold uppercase tracking-wide text-shitzu-3 mb-2.5"
      >
        What happens
      </div>
      <RouteSteps
        steps={withProgress(
          steps,
          activeStep,
          stepFailed,
          transferState === "awaiting-final" ||
            transferState === "awaiting-deposit",
        )}
      />
      {#if transferMessage}
        <!--
          A NEAR route can be several transactions that depend on each other, and
          the user signs every one. "Step 2 of 3" is the difference between three
          prompts and the sense that something has gone wrong.
        -->
        <div class="text-xs text-shitzu-2 mt-2 flex items-center gap-2">
          <span class="i-mdi:loading animate-spin" aria-hidden="true" />
          {transferMessage}
        </div>
      {/if}
      {#if waitingForBridge}
        <!--
          The bridge step stays in flight for this, which is the honest state: the
          deposit is signed, and the tokens are on the bridge rather than in the
          account. Said out loud, because it is the longest silent stretch of a
          cross-chain transfer and a spinner alone reads as a hang.
        -->
        <div class="text-xs text-shitzu-2 mt-2 flex items-center gap-2">
          <span class="i-mdi:loading animate-spin" aria-hidden="true" />
          Bridge {waitingForBridge.phase} — check {waitingForBridge.attempt} of
          {waitingForBridge.total}. Your funds are on their way.
        </div>
      {/if}
    </div>
  {/if}

  {#if gate.insufficientBalance && amount !== null && amount > 0n}
    <div class="text-sm text-red-300">
      More than the {formatBaseUnits(spendable ?? 0n, sourceDecimals)}
      {sourceSymbol} available.
    </div>
  {/if}

  {#if gate.insufficientGas}
    <div class="text-sm text-red-300">
      Not enough SOL to pay the network fee.
    </div>
  {/if}

  {#if gate.tooSmall}
    <div class="text-sm text-amber-300">
      That amount is too small to cover the bridge fee.
    </div>
  {/if}

  {#if gate.noRoute}
    <div class="text-sm text-amber-300">
      Nothing can carry that between these two chains right now. Try another
      token, or bridge a token unchanged from the Bridge tab.
    </div>
  {/if}

  {#if transferError}
    <div class="text-sm text-red-300">{transferError}</div>
  {/if}

  <button
    type="button"
    class="w-full px-4 py-3 rounded-lg font-semibold transition-colors {gate.canSubmit ||
    transferDone
      ? 'bg-shitzu-4 text-black hover:bg-shitzu-5'
      : 'bg-white/10 text-shitzu-3 border border-shitzu-4/45'}"
    disabled={!canPress}
    on:click={() => {
      // A finished transfer's button is a way out, not a way to redo the conversion.
      // It was inert before, which left the form sitting on a completed plan with
      // nothing to press.
      if (transferDone) return startAnother();
      // The parked presses come *before* the gate, and must stay there. A pending
      // final leg is the one thing that has to remain pressable — the route is settled,
      // the money has arrived, and this is the press that completes the conversion.
      //
      // A `canSubmit` check placed above them made the button silently inert: the gate
      // counts `usable.length` and `searching`, and a balance or a search landing while
      // the transfer was parked can leave either false, at which point pressing the
      // button did nothing at all and the destination swap simply never ran. Before
      // this was a ternary, the parked presses were dispatched first and the gate could
      // not reach them.
      if (transferState === "awaiting-deposit") return runDepositPress();
      if (transferState === "awaiting-final") return runFinalSwap();
      if (!gate.canSubmit) return;
      if (gate.needsSourceConnect) return connect(source);
      if (gate.needsDestConnect) return connect(dest);
      return startTransfer();
    }}
  >
    {transferDone
      ? "Start another conversion"
      : gate.needsSourceConnect
        ? `Connect ${CHAINS[source].name} wallet`
        : gate.needsDestConnect
          ? `Connect ${CHAINS[dest].name} wallet`
          : gate.label}
  </button>
</section>
