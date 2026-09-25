import { Bot } from "grammy";
import { config } from "./config.js";
import { handleStart, handleMenu, handleSubject } from "./handlers/start.js";
import { handleBriefing } from "./handlers/briefing.js";
import { handleLedger } from "./handlers/ledger.js";
import { handleStudy } from "./handlers/study.js";
import { handleDocument } from "./handlers/document.js";
import { handleCallback } from "./handlers/callback.js";
import { handleChatMessage } from "./handlers/chat.js";

async function main() {
  console.log("🚀 Initializing WalLearn Telegram Bot...");

  if (!config.telegramBotToken) {
    console.error("❌ Fatal Error: TELEGRAM_BOT_TOKEN is not configured.");
    process.exit(1);
  }

  const bot = new Bot(config.telegramBotToken);

  // Commands
  bot.command("start", handleStart);
  bot.command("help", handleStart);
  bot.command("menu", handleMenu);
  bot.command("study", handleStudy);
  bot.command("prep", handleStudy);
  bot.command("briefing", handleBriefing);
  bot.command("ledger", handleLedger);
  bot.command("proof", handleLedger);
  bot.command("subject", handleSubject);

  // Handlers
  bot.on("callback_query:data", handleCallback);
  bot.on("message:document", handleDocument);
  bot.on("message:text", handleChatMessage);

  // Global Error Handler
  bot.catch((err) => {
    console.error("⚠️ Error in Telegram bot update:", err);
  });

  console.log("🤖 WalLearn Bot is running on Telegram (@WalLearnBot)!");
  console.log(`⛓️ Connected to Walrus Mainnet Account: ${config.walrusAccountId}`);

  // Register native command menu in Telegram UI
  bot.api.setMyCommands([
    { command: "start", description: "Start fresh onboarding & set course" },
    { command: "study", description: "Start CBT study drill (5, 10, or 20 Qs)" },
    { command: "briefing", description: "View top weaknesses from Walrus" },
    { command: "ledger", description: "View Walrus on-chain mistake records" },
    { command: "subject", description: "Set or switch active course" },
    { command: "menu", description: "View active course menu" },
  ]).catch(() => {});

  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Logged in as @${botInfo.username} (${botInfo.id})`);
    },
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
