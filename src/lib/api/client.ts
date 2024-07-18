import createClient from "openapi-fetch";

import type { paths } from "./openapi";

export const client = createClient<paths>({
  baseUrl: "https://api-testnet.meme.cooking/",
});
