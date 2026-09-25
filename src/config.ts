import dotenv from "dotenv";
dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  aiModel: process.env.AI_MODEL || "google/gemini-3.5-flash-lite",

  memwalCredsDir: process.env.MEMWAL_CREDS_DIR || "~/.memwal-wallearn",
  walrusAccountId: process.env.WALRUS_ACCOUNT_ID || "0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140",
  walrusWalletAddress: process.env.WALRUS_WALLET_ADDRESS || "0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2",
  walrusDelegateAddress: process.env.WALRUS_DELEGATE_ADDRESS || "0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa",
  walrusRelayerUrl: process.env.WALRUS_RELAYER_URL || "https://relayer.memory.walrus.xyz",

  defaultSubject: "pcl301",
};

if (!config.telegramBotToken) {
  console.warn("⚠️ Warning: TELEGRAM_BOT_TOKEN is not set in .env!");
}
if (!config.openRouterApiKey) {
  console.warn("⚠️ Warning: OPENROUTER_API_KEY is not set in .env!");
}
