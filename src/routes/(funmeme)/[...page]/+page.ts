import type { MemeBid } from "$lib/models/funmeme/types.js";

export async function load({ params }) {
  // Fetch the carousel data based on the ID
  const id = params.page;

  // Simulate fetching data; replace with actual data fetch
  const memebids: MemeBid[] = await new Promise((resolve) => {
    setTimeout(() => {
      resolve([
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
      ]);
    }, 1000);
  });

  const currentMemebidsIdx = memebids.findIndex((item) => item.id === id) || 0;
  const isFunmemeHome = id === "board";

  return {
    props: {
      currentMemebidsIdx,
      memebids,
      isFunmemeHome,
    },
  };
}
