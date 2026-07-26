// Thin Telegram Bot API transport for the support bot. All calls are best-effort
// and never throw into the webhook handler — a failed Telegram call must not make
// us return a non-200 to Telegram (which would trigger endless retries).
import { ENV } from "./env.js";

const API = () => `https://api.telegram.org/bot${ENV.TELEGRAM_BOT_TOKEN}`;

export function botEnabled(): boolean {
  return !!ENV.TELEGRAM_BOT_TOKEN;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

async function call(method: string, payload: Record<string, unknown>): Promise<any> {
  if (!ENV.TELEGRAM_BOT_TOKEN) return { ok: false, description: "bot token not configured" };
  try {
    const res = await fetch(`${API()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json().catch(() => ({ ok: false }));
  } catch (e: any) {
    console.error(`[telegram] ${method} failed:`, e?.message || e);
    return { ok: false, description: String(e?.message || e).slice(0, 160) };
  }
}

export function sendMessage(
  chatId: string | number,
  text: string,
  keyboard?: InlineButton[][],
): Promise<any> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function editMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  keyboard?: InlineButton[][],
): Promise<any> {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function answerCallback(callbackId: string, text?: string): Promise<any> {
  return call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

// Send a ticket into the support/ops group and return the group message id so
// staff replies to it can be matched back to the ticket.
export async function sendToSupport(text: string, keyboard?: InlineButton[][]): Promise<number | null> {
  if (!ENV.TELEGRAM_SUPPORT_GROUP_ID) return null;
  const r = await call("sendMessage", {
    chat_id: ENV.TELEGRAM_SUPPORT_GROUP_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  return r?.ok && r.result?.message_id ? Number(r.result.message_id) : null;
}

// Forward a user's payment-proof photo into the ops group (reusing the file_id
// Telegram gave us for the incoming photo). Returns the group message id.
export async function sendPhotoToSupport(fileId: string, caption: string, keyboard?: InlineButton[][]): Promise<number | null> {
  if (!ENV.TELEGRAM_SUPPORT_GROUP_ID) return null;
  const r = await call("sendPhoto", {
    chat_id: ENV.TELEGRAM_SUPPORT_GROUP_ID,
    photo: fileId,
    caption: caption.slice(0, 1024),
    parse_mode: "HTML",
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  return r?.ok && r.result?.message_id ? Number(r.result.message_id) : null;
}

// The persistent bottom-of-menu buttons (Open App / Channel / Group).
export function linkButtons(): InlineButton[][] {
  return [
    [
      { text: "📲 Open App", url: ENV.APP_PUBLIC_URL },
      { text: "📢 Channel", url: ENV.TELEGRAM_CHANNEL_URL },
    ],
    [{ text: "👥 Group", url: ENV.TELEGRAM_GROUP_URL }],
  ];
}

export function mainMenu(): InlineButton[][] {
  return [
    [{ text: "🆘 Deposit not credited", callback_data: "deposit_issue" }],
    [{ text: "💸 Withdrawal not received", callback_data: "withdrawal_issue" }],
    [{ text: "❓ FAQ / How to use the app", callback_data: "faq_menu" }],
    ...linkButtons(),
  ];
}

// Register the webhook with Telegram (called from the admin setup endpoint).
export function setWebhook(url: string, secret: string): Promise<any> {
  return call("setWebhook", {
    url,
    secret_token: secret || undefined,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export function getWebhookInfo(): Promise<any> {
  return call("getWebhookInfo", {});
}

// Register the bot's command list → Telegram shows a "Menu" quick-action button
// beside the message box, and "/" lists these. Keeps users from retyping /start.
export function setMyCommands(): Promise<any> {
  return call("setMyCommands", {
    commands: [
      { command: "start", description: "🏠 Open the support menu" },
      { command: "deposit", description: "🆘 Deposit not credited" },
      { command: "withdraw", description: "💸 Withdrawal not received" },
      { command: "faq", description: "❓ How to use the app" },
      { command: "support", description: "👋 Talk to support" },
    ],
  });
}

// Show the "Menu" button (commands list) beside the input on every chat.
export function setMenuButton(): Promise<any> {
  return call("setChatMenuButton", { menu_button: { type: "commands" } });
}
