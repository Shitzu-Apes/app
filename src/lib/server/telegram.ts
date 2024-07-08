const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, (match) => `\\${match}`);
}

// 3 possible values 5m, 1h, 1d
function durationMsToHumanReadable(durationMs: string): string {
  const duration = parseInt(durationMs);
  if (duration < 0) {
    return "Invalid duration";
  }

  if (duration < 300000) {
    return `${duration / 1000} seconds`;
  }

  if (duration < 3600000) {
    return `${duration / 60000} minutes`;
  }

  if (duration < 86400000) {
    return `${duration / 3600000} hours`;
  }

  return `${duration / 86400000} days`;
}

export default abstract class Telegram {
  static async broadcastNewToken(
    name: string,
    ticker: string,
    description: string,
    durationMs: string,
    imageCID: string,
    telegramLink: string | null,
    twitterLink: string | null,
    websiteLink: string | null,
  ): Promise<void> {
    const message = `
${escapeMarkdown(name)} \\- *$${escapeMarkdown(ticker)}*

${escapeMarkdown(description)}


Cooking time: *${durationMsToHumanReadable(durationMs)}*

[${escapeMarkdown("[Let's cook!]")}](${`https://memecooking.com/${ticker}`})

${telegramLink ? `[${escapeMarkdown("[telegram]")}](${telegramLink})` : ""} ${twitterLink ? `[${escapeMarkdown("[twitter]")}](${twitterLink})` : ""} ${websiteLink ? `[${escapeMarkdown("[website]")}](${websiteLink})` : ""}
    `;

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            link_preview_options: {
              is_disabled: false,
              url: `https://cf-ipfs.com/ipfs/${imageCID}`,
              show_above_text: true,
            },
            parse_mode: "MarkdownV2",
          }),
        },
      );

      const json = await res.json();
      console.log(json);
    } catch (e) {
      console.error(e);
    }
  }
}
