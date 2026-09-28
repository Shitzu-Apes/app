/**
 * Should a wallet read be started?
 *
 * Extracted from the panel because this one boolean decides whether balances load at
 * all, and it was wrong in a way that reads as correct: it also asked for a reload
 * whenever the token list was empty, which cannot re-run — a failed read changes
 * neither the public key nor the list, so re-assigning equal values marks nothing
 * dirty. The clause looked like a retry and was a trap.
 *
 * Retrying an empty read belongs to the loader, not here. `fetchWalletTokens` answers
 * a rejected RPC with a *successful* empty result, and only another attempt can tell
 * that apart from a wallet that holds nothing; a guard has no way to make one.
 */
export function shouldLoadWallet({
  publicKey,
  loadedFor,
  loadInFlight,
}: {
  publicKey: string | null;
  loadedFor: string | null;
  loadInFlight: boolean;
}): boolean {
  // No wallet, nothing to read.
  if (!publicKey) return false;
  // Already reading for this wallet. Without this a re-render during a load would
  // start a second one, and the two would race to write the list.
  if (loadInFlight && loadedFor === publicKey) return false;
  return loadedFor !== publicKey;
}

/**
 * Identifies the balances a destination token list was built from.
 *
 * The list is not derived — it is *built*, once, with the balances folded in, and the
 * result is held. So the balances that existed at build time are baked into it, and a
 * wallet read that lands afterwards changes nothing on screen. That is the whole of
 * why the receive side showed no amounts while the spend side, which is derived and
 * re-renders, showed them: both read the same arrays, and only one of them re-reads
 * them.
 *
 * So the catalogue has to be rebuilt when those balances change, and the question is
 * what counts as "changed". Comparing the arrays by value cannot work — they are read
 * inside an async loader and nothing re-assigns an equal array — so the caller passes
 * a counter it bumps when a load lands. The wallet address is in the signature because
 * the same balances belong to one account: switching accounts has to rebuild even
 * though the token count may be identical.
 */
export function catalogSignature({
  chain,
  wallet,
  version,
}: {
  chain: string;
  wallet: string | null;
  version: number;
}): string {
  return `${chain}|${wallet ?? ""}|${version}`;
}

/**
 * Should the destination token list be rebuilt?
 *
 * Both halves matter and they are not the same question. The chain deciding means the
 * list is for a different chain and every row in it is wrong. The balances deciding
 * means the same rows are right but carry no amounts, and the held ones should be
 * ranked first.
 */
export function shouldBuildCatalog({
  hydrated,
  chain,
  builtFor,
  builtFrom,
  signature,
}: {
  hydrated: boolean;
  chain: string;
  builtFor: string | null;
  builtFrom: string;
  signature: string;
}): boolean {
  // Before the URL has been read, `chain` is a default the link is about to correct.
  if (!hydrated) return false;
  if (builtFor !== chain) return true;
  return builtFrom !== signature;
}
