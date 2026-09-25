import { Context } from "grammy";
import { config } from "../config.js";
import { walrus } from "../walrus/client.js";

export async function handleLedger(ctx: Context) {
  const health = await walrus.getHealth();
  const ledger = walrus.getLedger();

  const explorerLink = `https://suiscan.xyz/mainnet/object/${config.walrusAccountId}`;

  let msg = `⛓️ *WalLearn On-Chain Mistake Ledger*\n`;
  msg += `_Permanent, verifiable memory persisted to Walrus Protocol._\n\n`;
  msg += `• *Status:* 🟢 ${health.status}\n`;
  msg += `• *Network:* Walrus Mainnet / Sui Mainnet\n`;
  msg += `• *Account ID:* \`${health.accountId}\`\n`;
  msg += `• *Dedicated Wallet:* \`${health.walletAddress}\`\n`;
  msg += `• *Explorer Link:* [View on Suiscan](${explorerLink})\n`;
  msg += `• *Total Tracked Mistake Blobs:* *${ledger.length}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

  if (ledger.length === 0) {
    msg += `_No mistakes recorded yet during this session._\nTake a quiz or answer questions to populate your on-chain memory!`;
  } else {
    msg += `📋 *Recent Memory Blobs:*\n`;
    const recent = ledger.slice(-5).reverse();
    recent.forEach((item, i) => {
      const date = new Date(item.timestamp).toLocaleTimeString();
      msg += `\n*${i + 1}. ${item.topic}*\n`;
      msg += `• *Recorded:* ${date}\n`;
      msg += `• *Status:* ${item.blobId ? "✅ Confirmed on Mainnet" : (item.jobId ? "⏳ Storing to Mainnet" : "Pending")}\n`;
      if (item.blobId) {
        msg += `• *Walrus Blob ID:* \`${item.blobId}\`\n`;
        msg += `• *Walrusscan:* [Verify Blob on Walruscan](https://walruscan.com/mainnet/blob/${item.blobId})\n`;
      } else if (item.jobId) {
        msg += `• *Relayer Job ID:* \`${item.jobId}\`\n`;
      }
    });
  }

  await ctx.reply(msg, { parse_mode: "Markdown", link_preview_options: { is_disabled: false } });
}
