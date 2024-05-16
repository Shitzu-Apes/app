export async function load() {
  const url = new URL(window.location.href);
  const isTG = !!url.searchParams.get("tg");

  return {
    isTG,
  };
}
