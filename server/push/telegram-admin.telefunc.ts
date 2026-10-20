import { and, eq } from "drizzle-orm";
import { pushChannelConfig } from "@/database/drizzle/schema";
import { appError } from "@/lib/app-error";
import { formatDateInTimezone } from "@/lib/site-timezone";
import { telefuncAction } from "@/server/telefunc-action";
import { getSiteSettings } from "@/server/site/public-settings";
import { requireAdmin } from "@/server/telefunc-context";
import { parseTelegramProviderConfig, sendTelegramPush } from "./telegram-provider";

function requiredName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120) appError("TELEGRAM_NAME_INVALID");
  return value.trim();
}

function configJson(input: { botToken: unknown; chatId: unknown }) {
  if (!input) appError("TELEGRAM_CONFIG_INVALID");
  try {
    return JSON.stringify(
      parseTelegramProviderConfig(
        JSON.stringify({ schemaVersion: 1, botToken: input.botToken, chatId: input.chatId }),
      ),
    );
  } catch {
    appError("TELEGRAM_CONFIG_INVALID");
  }
}

async function getTelegramProvider() {
  const { db } = requireAdmin();
  const [record] = await db
    .select({
      id: pushChannelConfig.id,
      name: pushChannelConfig.name,
      isEnabled: pushChannelConfig.isEnabled,
      configJson: pushChannelConfig.configJson,
      updatedAt: pushChannelConfig.updatedAt,
    })
    .from(pushChannelConfig)
    .where(eq(pushChannelConfig.channel, "TELEGRAM"))
    .limit(1);
  if (!record) return { provider: null };
  try {
    const config = parseTelegramProviderConfig(record.configJson);
    return {
      provider: {
        id: record.id,
        name: record.name,
        isEnabled: record.isEnabled,
        botToken: config.botToken,
        chatId: config.chatId,
        configurationError: false,
        updatedAt: record.updatedAt,
      },
    };
  } catch {
    return {
      provider: {
        id: record.id,
        name: record.name,
        isEnabled: false,
        botToken: "",
        chatId: "",
        configurationError: true,
        updatedAt: record.updatedAt,
      },
    };
  }
}

async function saveTelegramProvider(input: {
  name: string;
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}) {
  const { db } = requireAdmin();
  if (!input || typeof input.isEnabled !== "boolean") appError("TELEGRAM_CONFIG_INVALID");
  const name = requiredName(input.name);
  const storedConfig = configJson(input);
  const now = new Date();
  const [existing] = await db
    .select({ id: pushChannelConfig.id })
    .from(pushChannelConfig)
    .where(eq(pushChannelConfig.channel, "TELEGRAM"))
    .limit(1);
  if (existing) {
    await db
      .update(pushChannelConfig)
      .set({
        provider: "TELEGRAM_BOT",
        name,
        isEnabled: input.isEnabled,
        configJson: storedConfig,
        updatedAt: now,
      })
      .where(and(eq(pushChannelConfig.id, existing.id), eq(pushChannelConfig.channel, "TELEGRAM")));
    return { id: existing.id };
  }
  const [created] = await db
    .insert(pushChannelConfig)
    .values({
      channel: "TELEGRAM",
      provider: "TELEGRAM_BOT",
      name,
      isEnabled: input.isEnabled,
      configJson: storedConfig,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: pushChannelConfig.id });
  return created;
}

/** Admin test: call Telegram API directly (no email template / pushLog dependency). */
async function testTelegramProvider() {
  const { db, database } = requireAdmin();
  const [record] = await db
    .select({ id: pushChannelConfig.id, configJson: pushChannelConfig.configJson })
    .from(pushChannelConfig)
    .where(eq(pushChannelConfig.channel, "TELEGRAM"))
    .limit(1);
  if (!record) appError("TELEGRAM_NOT_FOUND");

  let config;
  try {
    config = parseTelegramProviderConfig(record.configJson);
  } catch {
    appError("TELEGRAM_CONFIG_INVALID");
  }

  const settings = await getSiteSettings(database);
  const sentAt = formatDateInTimezone(new Date(), settings.timezone, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  try {
    const result = await sendTelegramPush(config, {
      title: `[${settings.siteName}] 测试消息`,
      content: `这是一条 Telegram 测试消息。\n\n站点：${settings.siteName}\n发送时间：${sentAt}`,
    });
    return { messageId: result.messageId };
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : "TELEGRAM_SEND_FAILED";
    // Surface specific codes so the admin UI can show a useful toast.
    if (
      reason === "TELEGRAM_CHAT_NOT_FOUND" ||
      reason === "TELEGRAM_NEED_START" ||
      reason === "TELEGRAM_TOKEN_INVALID" ||
      reason === "TELEGRAM_BOT_BLOCKED" ||
      reason === "TELEGRAM_SEND_RETRYABLE" ||
      reason === "TELEGRAM_CONFIG_INVALID"
    ) {
      appError(reason);
    }
    appError("TELEGRAM_SEND_FAILED");
  }
}

export const onGetTelegramProvider = telefuncAction(getTelegramProvider);
export const onSaveTelegramProvider = telefuncAction(saveTelegramProvider);
export const onTestTelegramProvider = telefuncAction(testTelegramProvider);
