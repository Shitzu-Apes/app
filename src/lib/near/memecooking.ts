import type { MCMemeInfo, MCAccountInfo } from "$lib/models/memecooking";

export abstract class MemeCooking {
  public static getLatestMeme(firstMemeId?: string): Promise<MCMemeInfo[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let mockedData: MCMemeInfo[] = [
          {
            id: "150",
            owner: "shitzu.near",
            end_timestamp_ms: Date.now() + 1000,
            name: "shhh",
            symbol: "SHHH",
            icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
            decimals: 18,
            total_supply: "100000000000000000000000000",
            banner:
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
            deposit_token_id: "wrap.near",
            description: "Shitzu is a meme token.",
            links: [["https://twitter.com/shitzuonnear", ""]],
          },
        ];

        if (firstMemeId) {
          mockedData = [
            {
              id: firstMemeId,
              owner: "root.near",
              end_timestamp_ms: Date.now() + 1000,
              name: "drrragon",
              symbol: "ddr",
              icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
              decimals: 18,
              total_supply: "100000000000000000000000000",
              banner:
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
              deposit_token_id: "wrap.near",
              description: "Illia resurected the dragon.",
              links: [["https://twitter.com/drrragon", ""]],
            },
            ...mockedData,
          ];
        }

        resolve(mockedData);
      }, 1000);
    });
  }

  public static getMeme(id: string): Promise<MCMemeInfo | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockedData: MCMemeInfo = {
          id,
          owner: "shitzu.near",
          end_timestamp_ms: Date.now() + 1000,
          name: "shhh",
          symbol: "SHHH",
          icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
          decimals: 18,
          total_supply: "100000000000000000000000000",
          banner:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
          deposit_token_id: "wrap.near",
          description: "Shitzu is a meme token.",
          links: [["https://twitter.com/shitzuonnear", ""]],
        };

        resolve(mockedData);
      }, 1000);
    });
  }

  public static getAccount(accountId: string): Promise<MCAccountInfo | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const deposits: MCAccountInfo["deposits"] =
          Math.random() > 0.5 ? [[0, "100000000000000000000000"]] : [];

        const mockedData = {
          account_id: accountId,
          deposits,
        };

        resolve(mockedData);
      }, 1000);
    });
  }
}
