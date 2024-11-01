export async function view<T>(
  contract: string,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  return viewWithNode(import.meta.env.VITE_NODE_URL, contract, method, args);
}

export async function viewWithNode<T>(
  node: string,
  contract: string,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    const res = await fetch(node, {
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
          account_id: contract,
          method_name: method,
          args_base64: btoa(JSON.stringify(args)),
        },
      }),
    });

    const json = await res.json();
    if ("error" in json) {
      console.error("[view]: Error", json.error.data);
      throw new Error(json.error.data);
    }
    const result = new Uint8Array(json.result.result);
    const decoder = new TextDecoder();

    return JSON.parse(decoder.decode(result));
  } catch (error: unknown) {
    console.error("[view]: Error", error);
    throw error;
  }
}
