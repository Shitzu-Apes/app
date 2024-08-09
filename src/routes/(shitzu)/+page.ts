import { redirect } from "@sveltejs/kit";

import type { PageLoad } from "./$types";

const load: PageLoad = async (props) => {
  if (props.url.hostname === import.meta.env.VITE_MEMECOOKING_HOSTNAME) {
    redirect(303, "/appetizer");
  }
};

export { load };
