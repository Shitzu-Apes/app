import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

const load: PageServerLoad = async (props) => {
  if (props.url.origin.includes("meme.cooking")) {
    redirect(303, "/appetizer");
  }
};

export { load };
