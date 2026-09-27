import { Bot } from "grammy";
import { config } from "./config.js";
import { handleStart, handleMenu, handleSubject } from "./handlers/start.js";
import { handleBriefing } from "./handlers/briefing.js";
import { handleLedger } from "./handlers/ledger.js";
import { handleRestore } from "./handlers/restore.js";
import { handleAnalyze } from "./handlers/analyze.js";
import { handleHealth } from "./handlers/health.js";
import { handleStudy } from "./handlers/study.js";
import { handleDocument } from "./handlers/document.js";
import { handlePhoto } from "./handlers/photo.js";
import { handleCallback } from "./handlers/callback.js";
import { handleChatMessage } from "./handlers/chat.js";
import { walrus } from "./walrus/client.js";

async function main() {
  console.log("🚀 Initializing WalLearn Telegram Bot...");

  if (!config.telegramBotToken) {
    console.error("❌ Fatal Error: TELEGRAM_BOT_TOKEN is not configured.");
    process.exit(1);
  }

  const bot = new Bot(config.telegramBotToken);

  // Global Logging Middleware
  bot.use(async (ctx, next) => {
    const updateType = Object.keys(ctx.update).filter((k) => k !== "update_id")[0];
    const fromUser = ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name || `user:${ctx.from?.id}`);
    const chatId = ctx.chat?.id;

    if (ctx.message?.document) {
      console.log(`📥 [${fromUser} | chat:${chatId}] Uploaded Document: "${ctx.message.document.file_name}" (${ctx.message.document.mime_type}, ${ctx.message.document.file_size} bytes)`);
    } else if (ctx.message?.photo) {
      console.log(`🖼️ [${fromUser} | chat:${chatId}] Uploaded Photo`);
    } else if (ctx.message?.text) {
      console.log(`💬 [${fromUser} | chat:${chatId}] Text: "${ctx.message.text.substring(0, 80)}"`);
    } else if (ctx.callbackQuery) {
      console.log(`🔘 [${fromUser} | chat:${chatId}] Callback: "${ctx.callbackQuery.data}"`);
    } else {
      console.log(`🔔 [${fromUser} | chat:${chatId}] Update: ${updateType}`);
    }

    await next();
  });

  // Commands
  bot.command("start", handleStart);
  bot.command("help", handleStart);
  bot.command("menu", handleMenu);
  bot.command("study", handleStudy);
  bot.command("prep", handleStudy);
  bot.command("analyze", handleAnalyze);
  bot.command("restore", handleRestore);
  bot.command("mistakes", handleRestore);
  bot.command("briefing", handleBriefing);
  bot.command("ledger", handleRestore);
  bot.command("proof", handleLedger);
  bot.command("health", handleHealth);
  bot.command("status", handleHealth);
  bot.command("subject", handleSubject);

  // Handlers
  bot.on("callback_query:data", handleCallback);
  bot.on("message:document", handleDocument);

  // Photo / Image Handler (Gemini Multimodal Vision)
  bot.on("message:photo", handlePhoto);

  // Media Fallback
  bot.on(["message:audio", "message:video", "message:voice"], async (ctx) => {
    const { formatTelegramMarkdown } = await import("./utils/telegram-format.js");
    await ctx.reply(
      formatTelegramMarkdown(
        "📄 Please upload your course materials as a *Document* (PDF, Word, PPTX), *Image* (JPEG, PNG), or *Text message* to generate a personalized CBT quiz."
      ),
      { parse_mode: "Markdown" }
    );
  });

  // Text message handler (chat, answers, course setup)
  bot.on("message:text", handleChatMessage);

  // Global Error Handler
  bot.catch((err) => {
    console.error("⚠️ Error in Telegram bot update:", err);
  });

  console.log("🤖 WalLearn Bot is running on Telegram (@WalLearnBot)!");
  console.log(`⛓️ Connected to MemWal Account: ${walrus.getAccountId()}`);

  // Register native command menu in Telegram UI
  bot.api.setMyCommands([
    { command: "start", description: "Start fresh onboarding & setup" },
    { command: "study", description: "Start CBT study drill" },
    { command: "analyze", description: "Analyze department past MCQ questions" },
    { command: "restore", description: "Restore past mistakes from Walrus Mainnet" },
    { command: "briefing", description: "View top weaknesses & mastery streaks" },
    { command: "health", description: "System health & Walrus connectivity" },
    { command: "subject", description: "Set or switch active course" },
    { command: "menu", description: "View active session menu" },
  ]).catch(() => {});

  await bot.start({
    allowed_updates: ["message", "callback_query"],
    onStart: (botInfo) => {
      console.log(`✅ Logged in as @${botInfo.username} (${botInfo.id})`);
    },
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
