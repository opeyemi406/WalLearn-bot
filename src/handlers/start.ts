import { Context } from "grammy";
import { config } from "../config.js";
import { getUserSubject, setUserSubject } from "../state.js";

export async function handleStart(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const currentSubject = getUserSubject(chatId);

  const welcomeMessage = `
🎓 *Welcome to WalLearn!*
_The study chatbot that never lets you fail the same question twice._

Most AI study tools suffer from amnesia. WalLearn gives your study prep *permanent memory on Walrus Protocol*. Every mistake you make is diagnosed and written to Walrus Mainnet, so future sessions drill your weakest points first.

━━━━━━━━━━━━━━━━━━━
⛓️ *Permanent Memory Engine:*
• *Storage:* Walrus Protocol (Mainnet)
• *On-Chain Account:* \`${config.walrusAccountId.slice(0, 10)}...${config.walrusAccountId.slice(-8)}\`
• *Active Subject:* \`${currentSubject.toUpperCase()}\`
• *Model:* \`${config.aiModel}\`
━━━━━━━━━━━━━━━━━━━

🚀 *How to use:*
1️⃣ *Upload Lecture Slides:* Send any PDF or notes file directly into this chat to generate a personalized CBT quiz.
2️⃣ *Cold Drill:* Type \`/study\` to recall your past mistakes and drill your weakest topics.
3️⃣ *Check Memory:* Type \`/briefing\` to view your top unresolved misconceptions.
4️⃣ *Verify On-Chain:* Type \`/ledger\` to see all blobs persisted to Walrus.
5️⃣ *Switch Subject:* Type \`/subject <tag>\` (e.g., \`/subject pcl301\` or \`/subject csc201\`).

_Ready? Drop a lecture slide PDF or type /study to begin!_
`;

  await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
}

export async function handleSubject(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text || "";
  const parts = text.split(" ");
  if (parts.length < 2) {
    const current = getUserSubject(chatId);
    await ctx.reply(`Current subject: *${current.toUpperCase()}*.\nTo change, use \`/subject <tag>\` (e.g. \`/subject pcl301\`).`, { parse_mode: "Markdown" });
    return;
  }

  const newSubject = parts[1].toLowerCase().trim();
  setUserSubject(chatId, newSubject);
  await ctx.reply(`✅ Active subject updated to *${newSubject.toUpperCase()}*.\nAll Walrus memories and quizzes are now scoped to this subject.`, { parse_mode: "Markdown" });
}
