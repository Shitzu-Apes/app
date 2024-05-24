import { FixedNumber } from "@tarnadas/fixed-number";

export async function calculateShitzuOut(
  nearIn: FixedNumber,
): Promise<FixedNumber> {
  const args = {
    pool_id: 4369,
    token_in: "wrap.near",
    amount_in: nearIn.toU128(),
    token_out: "token.0xshitzu.near",
  };

  const args_base64 = Buffer.from(JSON.stringify(args)).toString("base64");

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
        account_id: "v2.ref-finance.near",
        method_name: "get_return",
        args_base64,
      },
    }),
  });

  const json = await res.json();
  const result = new Uint8Array(json.result.result);
  const decoder = new TextDecoder();

  const shitzuOut = JSON.parse(decoder.decode(result));

  return new FixedNumber(shitzuOut, 18);
}
