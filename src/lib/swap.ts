import { FixedNumber } from "@tarnadas/fixed-number";
import { view } from "./near/utils";

export async function calculateShitzuOut(
  nearIn: FixedNumber,
): Promise<FixedNumber> {
  const args = {
    pool_id: 4369,
    token_in: "wrap.near",
    amount_in: nearIn.toU128(),
    token_out: "token.0xshitzu.near",
  };

  const shitzuOut = await view("v2.ref-finance.near", "get_return", args);

  return new FixedNumber(shitzuOut, 18);
}
