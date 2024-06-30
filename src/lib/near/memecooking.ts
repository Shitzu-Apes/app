import type { MemeBid } from "$lib/models/funmeme";

export abstract class MemeCooking {
  public static getLatestMeme(firstMemeId?: string): Promise<MemeBid[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let mockedData = [
          {
            id: "x1Jkan",
            name: "Shitzu",
            ticker: "SHITZU",
            icon: "https://shitzu.io/shitzu.png",
            created_by: "Shitzu King",
            created_at: Date.now() - 1000,
            duration: 250,
          },
          {
            id: "p3fkqn",
            name: "Shitzu",
            ticker: "SHITZU",
            icon: "https://shitzu.io/shitzu.png",
            created_by: "Shitzu King",
            created_at: Date.now() - 1000,
            duration: 250,
          },
          {
            id: "t3fjkU5",
            name: "Shitzu",
            ticker: "SHITZU",
            icon: "https://shitzu.io/shitzu.png",
            created_by: "Shitzu King",
            created_at: Date.now() - 1000,
            duration: 250,
          },
          {
            id: "l3fjkn",
            name: "Shitzu",
            ticker: "SHITZU",
            icon: "https://shitzu.io/shitzu.png",
            created_by: "Shitzu King",
            created_at: Date.now() - 1000,
            duration: 250,
          },
          {
            id: "In6mmAnr",
            name: "Shitzu",
            ticker: "SHITZU",
            icon: "https://shitzu.io/shitzu.png",
            created_by: "Shitzu King",
            created_at: Date.now() - 1000,
            duration: 250,
          },
        ];

        if (firstMemeId) {
          mockedData = [
            {
              id: firstMemeId,
              name: "Shitzu",
              ticker: "SHITZU",
              icon: "https://shitzu.io/shitzu.png",
              created_by: "Shitzu King",
              created_at: Date.now() - 1000,
              duration: 250,
            },
            ...mockedData,
          ];
        }

        resolve(mockedData);
      }, 1000);
    });
  }
}
