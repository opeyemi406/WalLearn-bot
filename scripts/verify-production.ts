import { walrus } from "../src/walrus/client.js";
import { config } from "../src/config.js";

async function verifyProduction() {
  console.log("============================================================");
  console.log("🚀 WalLearn Production Deployment Verification Diagnostic");
  console.log("============================================================\n");

  const targetAccountId =
    process.env.PRODUCTION_MEMWAL_ACCOUNT_ID ||
    process.env.PRODUCTION_WALRUS_ACCOUNT_ID ||
    process.env.MEMWAL_ACCOUNT_ID ||
    process.env.WALRUS_ACCOUNT_ID;
  const targetChatId = process.env.PRODUCTION_CHAT_ID ? parseInt(process.env.PRODUCTION_CHAT_ID, 10) : undefined;
  const targetCourse = process.env.PRODUCTION_COURSE || "pcl301";

  if (!targetAccountId || !targetChatId) {
    console.log("ℹ️ Production verification requires explicit target environment variables:");
    console.log("   • PRODUCTION_MEMWAL_ACCOUNT_ID (e.g. 0x...)");
    console.log("   • PRODUCTION_CHAT_ID (e.g. your Telegram user/chat ID)");
    console.log("   • PRODUCTION_COURSE (e.g. pcl301, optional, defaults to pcl301)\n");
    console.log("Usage example:");
    console.log("  PRODUCTION_MEMWAL_ACCOUNT_ID=0x... PRODUCTION_CHAT_ID=12345678 npm run test:production\n");
    console.log("For default judge testing and fresh account verification, run:");
    console.log("  npm test");
    console.log("  npm run test:cross-session\n");
    process.exit(0);
  }

  const hasCreds = walrus.hasCredentials();
  if (!hasCreds) {
    console.error("❌ Error: Valid MemWal credentials are required in .env for production verification.");
    process.exit(1);
  }

  console.log(`Target Production Account: ${targetAccountId}`);
  console.log(`Target Learner Chat ID:    ${targetChatId}`);
  console.log(`Target Course Code:        ${targetCourse}\n`);

  console.log("1. Probing Relayer Health for Production Account...");
  const health = await walrus.getHealth(targetChatId);
  console.log(`   • Status:             ${health.status}`);
  console.log(`   • Reachable:          ${health.reachable ? "✅ Yes" : "❌ No"}`);
  console.log(`   • Account Confirmed:  ${health.accountId}\n`);

  console.log("2. Querying Production Learner Namespace on Walrus Mainnet...");
  const recall = await walrus.recallDetailed(
    "syllabus pharmacology concepts",
    targetCourse,
    targetChatId,
    { fallbackToLocal: false, limit: 50 }
  );

  console.log(`   • Source:             ${recall.source === "walrus" ? "🟢 Walrus Mainnet (TEE Decrypted)" : "🔴 " + recall.source}`);
  console.log(`   • Memories Retrieved: ${recall.texts.length}`);

  if (recall.blobs && recall.blobs.length > 0) {
    console.log(`   • Sample Blob:        https://walruscan.com/mainnet/blob/${recall.blobs[0]}`);
  }

  console.log("\n3. Inspecting Weakness Briefing...");
  const briefing = await walrus.getWeaknessBriefing(targetCourse, targetChatId);
  console.log(`   • Active Weaknesses:  ${briefing.weaknesses.length}`);
  console.log(`   • Mastered Topics:    ${briefing.mastered.length}`);

  console.log("\n============================================================");
  console.log("✅ Production Deployment Verification Complete!");
  console.log("============================================================\n");
}

verifyProduction().catch((err) => {
  console.error("❌ Production verification error:", err);
  process.exit(1);
});
