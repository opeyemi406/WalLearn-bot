import dotenv from "dotenv";
import os from "os";
import path from "path";
dotenv.config();

export function resolveCredsDir(rawPath?: string): string {
  if (!rawPath) {
    return path.join(os.homedir(), ".memwal-wallearn");
  }
  // Expand tilde if provided in .env (e.g. ~/.memwal-wallearn)
  if (rawPath === "~" || rawPath.startsWith("~/")) {
    return path.join(os.homedir(), rawPath.slice(1));
  }
  return path.resolve(rawPath);
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  aiModel: process.env.AI_MODEL || "google/gemini-2.5-flash",

  memwalCredsDir: resolveCredsDir(process.env.MEMWAL_CREDS_DIR),
  memwalAccountId: process.env.MEMWAL_ACCOUNT_ID || process.env.WALRUS_ACCOUNT_ID || "",
  memwalServerUrl: process.env.MEMWAL_SERVER_URL || process.env.WALRUS_RELAYER_URL || "https://relayer.memory.walrus.xyz",
  memwalWalletAddress: process.env.MEMWAL_WALLET_ADDRESS || process.env.WALRUS_WALLET_ADDRESS || "",
  memwalDelegateAddress: process.env.MEMWAL_DELEGATE_ADDRESS || process.env.WALRUS_DELEGATE_ADDRESS || "",

  // Backward-compatibility aliases
  walrusAccountId: process.env.MEMWAL_ACCOUNT_ID || process.env.WALRUS_ACCOUNT_ID || "",
  walrusWalletAddress: process.env.MEMWAL_WALLET_ADDRESS || process.env.WALRUS_WALLET_ADDRESS || "",
  walrusDelegateAddress: process.env.MEMWAL_DELEGATE_ADDRESS || process.env.WALRUS_DELEGATE_ADDRESS || "",
  walrusRelayerUrl: process.env.MEMWAL_SERVER_URL || process.env.WALRUS_RELAYER_URL || "https://relayer.memory.walrus.xyz",

  defaultSubject: "pcl301",
  dataDir: path.resolve(process.cwd(), "data"),
};

if (!config.telegramBotToken) {
  console.warn("⚠️ Warning: TELEGRAM_BOT_TOKEN is not set in .env!");
}
if (!config.openRouterApiKey) {
  console.warn("⚠️ Warning: OPENROUTER_API_KEY is not set in .env!");
}
