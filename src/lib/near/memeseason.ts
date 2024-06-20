import { view } from "./utils";

export abstract class MemeSeason {
  public static getUserCheckpoint(accountId: string) {
    return view<string>("memeseason.0xshitzu.near", "get_user_checkpoint", {
      account_id: accountId,
    });
  }
}
