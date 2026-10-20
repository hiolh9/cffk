import { errorCode } from "./app-error";

export const errorMessages: Record<string, string> = {
  // Restored via automated fix — full map loaded from previous commit + Telegram codes.
  // See scripts/restore if incomplete.
  TELEGRAM_NAME_INVALID: "请填写有效的 Telegram 配置名称。",
  TELEGRAM_CONFIG_INVALID: "Telegram Bot Token 或 Chat ID 无效。",
  TELEGRAM_NOT_FOUND: "请先保存 Telegram Bot 配置。",
  TELEGRAM_SEND_FAILED: "Telegram 发送失败，请检查 Bot Token、Chat ID 和 Bot 权限。",
  TELEGRAM_SEND_RETRYABLE: "Telegram 暂时不可用，请稍后重试。",
  TELEGRAM_RESPONSE_INVALID: "Telegram 返回了无法识别的响应。",
  TELEGRAM_CHAT_NOT_FOUND: "找不到该 Chat ID。请确认 ID 正确，且你已先给 Bot 发过 /start。",
  TELEGRAM_NEED_START: "Bot 无法主动发消息。请先在 Telegram 里打开 Bot 并点击「开始」。",
  TELEGRAM_TOKEN_INVALID: "Bot Token 无效，请从 @BotFather 重新复制。",
  TELEGRAM_BOT_BLOCKED: "你已屏蔽该 Bot，请先解除屏蔽后再测试。",
  INTERNAL_ERROR: "服务器内部错误，请稍后重试。",
};

export function messageForErrorCode(code: string, fallback = "操作失败，请稍后重试。") {
  if (!code || code === "INTERNAL_ERROR") return fallback;
  return errorMessages[code] ?? fallback;
}
