import createClient from "openapi-fetch";

import type { paths } from "./openapi";

export const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_MEME_COOKING_API,
});

export type Trade =
  paths["/trades"]["get"]["responses"]["200"]["content"]["application/json"][number];

export type Meme =
  paths["/meme"]["get"]["responses"]["200"]["content"]["application/json"][number];
