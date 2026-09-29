export function load({ params }) {
  return { props: { token_id: params.token_id } };
}

export const prerender = "auto";
