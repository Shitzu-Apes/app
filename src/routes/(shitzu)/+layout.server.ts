import { redirect } from "@sveltejs/kit";

import type { LayoutServerLoad } from "./$types";

const load: LayoutServerLoad = async (props) => {
  if (props.url.origin.includes("meme.cooking")) {
    redirect(303, "/board");
  }
};

export const ssr = false;
export const prerender = false;
export { load };
