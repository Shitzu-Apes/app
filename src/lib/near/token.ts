export async function isUserRegistered(
  accountId: string,
  tokenId: string,
): Promise<boolean> {
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
        account_id: tokenId,
        method_name: "storage_balance_of",
        args_base64: btoa(
          JSON.stringify({
            account_id: accountId,
          }),
        ),
      },
    }),
  });
  const json = await res.json();
  if (!json.result) return false;
  const result = new Uint8Array(json.result.result);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(result)) != null;
}

export async function storageRequirement(tokenId: string): Promise<string> {
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
        account_id: tokenId,
        method_name: "storage_balance_bounds",
        args_base64: btoa(JSON.stringify({})),
      },
    }),
  });
  const json = await res.json();
  if (!json.result) throw new Error();
  const result = new Uint8Array(json.result.result);
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(result)).min;
}
