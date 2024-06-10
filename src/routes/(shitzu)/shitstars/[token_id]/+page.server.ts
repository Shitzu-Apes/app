export function entries() {
  return [...Array(1000).keys()].map((i) => ({ token_id: `${i}` }));
}
export const prerender = true;
export const ssr = false;
