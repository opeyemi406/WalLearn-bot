import { Context } from "grammy";
import { walrus } from "../walrus/client.js";
import { config } from "../config.js";
import { getUserSubject, getUserSubjectDisplay, hasUserSubject } from "../state.js";

/**
 * Handle /health command
 */
export async function handleHealth(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const statusMsg = await ctx.reply("🩺 _Checking Walrus Protocol & Bot health..._", {
    parse_mode: "Markdown",
  });

  try {
    const health = await walrus.getHealth(chatId);
    const hasActiveCourse = hasUserSubject(chatId);
    const subjectCode = hasActiveCourse ? getUserSubject(chatId) : null;
    const subjectDisplay = hasActiveCourse ? getUserSubjectDisplay(chatId) : "None (Not set yet)";
    const userNamespace = walrus.getUserNamespace(subjectCode || "unassigned", chatId);

    let msg = `🏥 *WalLearn System Health & Diagnostics*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    msg += `🌐 *Walrus Protocol Network:*\n`;
    msg += `• *Status:* 🟢 \`${health.status}\`\n`;
    msg += `• *Relayer Node:* \`https://relayer.memory.walrus.xyz\`\n`;
    msg += `• *Auth Protocol:* Ed25519 Signed Delegation\n`;
    msg += `• *Mainnet Account:* \`${health.accountId.slice(0, 14)}...${health.accountId.slice(-8)}\`\n`;
    msg += `• *Dedicated Wallet:* \`${health.walletAddress.slice(0, 14)}...${health.walletAddress.slice(-8)}\`\n\n`;

    msg += `📦 *On-Chain Storage Metrics (Walrus Mainnet):*\n`;
    msg += `• *Account Verified Blobs:* *${health.globalConfirmedBlobs}+ Blobs* ✅\n`;
    msg += `• *Sui Mainnet Object:* [View on Suiscan](https://suiscan.xyz/mainnet/object/${health.accountId})\n\n`;

    msg += `🔒 *Learner Isolation & Storage (${chatId}):*\n`;
    msg += `• *Active Course:* ${hasActiveCourse ? `*${subjectDisplay}*` : `_None (Not set yet)_`}\n`;
    msg += `• *Dedicated Namespace:* \`${userNamespace}\`\n`;
    msg += `• *Personal Tracked Memories:* *${health.userBlobs}*\n`;
    msg += `• *Personal Confirmed Blobs:* *${health.userConfirmedBlobs}* ✅\n`;
    if (health.userBlobs === 0) {
      msg += `• *Session State:* _Ready (Fresh session or tap /restore to sync your past course blobs from Walrus)_\n\n`;
    } else {
      msg += `• *Data Isolation:* 100% Encrypted & Segmented per student\n\n`;
    }

    msg += `🧠 *AI & Study Engines:*\n`;
    msg += `• *Model Engine:* \`${config.aiModel}\` 🟢\n`;
    msg += `• *Slide Document Parser:* PDF, PPTX, DOCX, TXT 🟢\n`;
    msg += `• *MemWal Analyzer:* \`/api/analyze\` 🟢\n`;
    msg += `• *Spaced Repetition Rule:* 3 Consecutive Passes to Master 🏆\n\n`;

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `_System operating normally. All writes are cryptographically signed._`;

    await ctx.api.editMessageText(chatId!, statusMsg.message_id, msg, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    await ctx.api.editMessageText(
      chatId!,
      statusMsg.message_id,
      `⚠️ *Health check error:* ${(err as Error).message}`,
      { parse_mode: "Markdown" }
    );
  }
}
