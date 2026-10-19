export type TelegramProviderConfig = {
  schemaVersion: 1;
  botToken: string;
  chatId: string;
};

type TelegramResponse = {
  ok?: boolean;
  result?: { message_id?: number };
  description?: string;
  error_code?: number;
};

export function parseTelegramProviderConfig(json: string): TelegramProviderConfig {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("TELEGRAM_CONFIG_INVALID");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("TELEGRAM_CONFIG_INVALID");
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.botToken !== "string" || typeof record.chatId !== "string") {
    throw new Error("TELEGRAM_CONFIG_INVALID");
  }
  const botToken = record.botToken.trim();
  const chatId = record.chatId.trim();
  if (
    !/^\d+:[A-Za-z0-9_-]+$/.test(botToken) ||
    !chatId ||
    chatId.length > 128 ||
    (!/^-?\d+$/.test(chatId) && !/^@[A-Za-z][A-Za-z0-9_]{4,}$/.test(chatId))
  ) {
    throw new Error("TELEGRAM_CONFIG_INVALID");
  }
  return { schemaVersion: 1, botToken, chatId };
}

export async function sendTelegramPush(
  config: TelegramProviderConfig,
  message: { title: string; content: string },
) {
  const text = `<b>${escapeHtml(message.title)}</b>\n\n${escapeHtml(message.content)}`.slice(0, 4096);
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error("TELEGRAM_SEND_RETRYABLE");
  }

  let result: TelegramResponse;
  try {
    result = (await response.json()) as TelegramResponse;
  } catch {
    throw new Error("TELEGRAM_RESPONSE_INVALID");
  }

  if (!response.ok || result.ok !== true) {
    const desc = (result.description || "").toLowerCase();
    if (response.status === 429 || response.status >= 500) {
      throw new Error("TELEGRAM_SEND_RETRYABLE");
    }
    if (desc.includes("chat not found") || desc.includes("chat_id is empty")) {
      throw new Error("TELEGRAM_CHAT_NOT_FOUND");
    }
    if (desc.includes("bot was blocked") || desc.includes("user is deactivated")) {
      throw new Error("TELEGRAM_BOT_BLOCKED");
    }
    if (desc.includes("unauthorized") || desc.includes("invalid token")) {
      throw new Error("TELEGRAM_TOKEN_INVALID");
    }
    if (desc.includes("bot can't initiate") || desc.includes("forbidden")) {
      throw new Error("TELEGRAM_NEED_START");
    }
    throw new Error("TELEGRAM_SEND_FAILED");
  }

  return {
    messageId: result.result?.message_id === undefined ? undefined : String(result.result.message_id),
  };
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&").replaceAll("<", "<").replaceAll(">", ">");
}
