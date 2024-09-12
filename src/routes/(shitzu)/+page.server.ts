import { redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

const load: PageServerLoad = async (props) => {
  const shitzu = {
    urlOrigin: props.url.origin,
    memecookingHostname: import.meta.env.VITE_MEMECOOKING_HOSTNAME,
    urlHostname: props.url.hostname,
  };
  console.log("shitzuapp load", shitzu);
  if (props.url.hostname === import.meta.env.VITE_MEMECOOKING_HOSTNAME) {
    redirect(303, "/appetizer");
  }
};

export { load };
