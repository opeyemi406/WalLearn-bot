import { Context, InlineKeyboard } from "grammy";
import { sessions, pendingSlides, awaitingSubject } from "../state.js";

export async function handleClear(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Clear in-memory session state
  sessions.delete(chatId);
  pendingSlides.delete(chatId);
  awaitingSubject.delete(chatId);

  const keyboard = new InlineKeyboard()
    .text("🎯 Start Drill (/study)", "start_drill")
    .text("📊 Briefing", "view_briefing")
    .row()
    .text("🔄 Change Course", "change_subject")
    .text("🚀 Main Menu (/start)", "main_menu");

  const msg = `🧹 *Conversation & Active Session Cleared!*\n\n• Active quiz sessions terminated.\n• Uploaded temporary materials reset.\n• Walrus Protocol on-chain mistake records remain securely preserved on Mainnet.\n\n_(Tip: To clear the visible chat bubbles from your screen, tap the ⋮ menu at the top right of Telegram and choose "Clear History".)_\n\n_What would you like to do next?_`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}
