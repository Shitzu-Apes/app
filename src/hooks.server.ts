import type { Handle } from "@sveltejs/kit";

import MEMECOOKING_LOGO from "$lib/assets/logo/meme-cooking.webp";

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  if (
    response.headers.get("content-type")?.startsWith("text/html") &&
    /^(\/|\/account|\/shitstars\/|\/stake)$/.test(event.url.pathname) === false
  ) {
    let html = await response.text();

    // Determine favicon based on route (example logic)
    const faviconPath = MEMECOOKING_LOGO;

    // Replace all favicon-related tags
    const faviconReplacements = [
      {
        search: /<link rel="icon".*?>/g,
        replace: `<link rel="icon" href="/assets/meme-cooking.ico" >`,
      },
      {
        search: /<link rel="apple-touch-icon".*?>/g,
        replace: `<link rel="apple-touch-icon" sizes="180x180" href="${faviconPath}">`,
      },
      {
        search: /<link rel="apple-touch-icon-precomposed".*?>/g,
        replace: `<link rel="apple-touch-icon-precomposed" sizes="180x180" href="${faviconPath}">`,
      },
      {
        search: /<link rel="icon" type="image\/png" sizes="32x32".*?>/g,
        replace: `<link rel="icon" type="image/webp" sizes="32x32" href="${faviconPath}">`,
      },
      {
        search: /<link rel="icon" type="image\/png" sizes="16x16".*?>/g,
        replace: `<link rel="icon" type="image/webp" sizes="16x16" href="${faviconPath}">`,
      },
      {
        search: /<title>.*?<\/title>/g,
        replace: `<title>Meme Cooking</title>`,
      },
    ];

    faviconReplacements.forEach(({ search, replace }) => {
      html = html.replace(search, replace);
    });

    return new Response(html, {
      status: response.status,
      headers: response.headers,
    });
  }

  return response;
};
