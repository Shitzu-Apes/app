import Telegram from "$lib/server/telegram";

export async function POST(e) {
  const form = await e.request.formData();
  const imageCID = form.get("imageCID") as string;
  const name = form.get("name") as string;
  const ticker = form.get("ticker") as string;
  const description = form.get("description") as string;
  const durationMs = form.get("durationMs") as string;
  const telegramLink = form.get("telegramLink") as string | null;
  const twitterLink = form.get("twitterLink") as string | null;
  const websiteLink = form.get("website") as string | null;

  await Telegram.broadcastNewToken(
    name,
    ticker,
    description,
    durationMs,
    imageCID,
    telegramLink,
    twitterLink,
    websiteLink,
  );

  return new Response(null, {
    status: 204,
  });
}
