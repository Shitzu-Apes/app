export async function checkNftCount(
  accountId: string,
): Promise<number | undefined> {
  const res = await fetch(import.meta.env.VITE_NODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: import.meta.env.VITE_NFT_CONTRACT_ID,
        method_name: "nft_supply_for_owner",
        args_base64: btoa(
          JSON.stringify({
            account_id: accountId,
          }),
        ),
      },
    }),
  });
  const json = await res.json();
  if (!json.result) return;
  const result = new Uint8Array(json.result.result);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(result));
}
