import { Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import {
  hasUserSubject,
  getUserSubject,
  getUserSubjectDisplay,
  setUserSubject,
  awaitingSubject,
  clearUserProfile,
} from "../state.js";

export async function handleStart(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Always reset to a fresh slate on /start (e.g. when user clears history and starts)
  clearUserProfile(chatId);

  const accountShort = `${config.walrusAccountId.slice(0, 10)}...${config.walrusAccountId.slice(-8)}`;

  const welcomeMessage = `🎓 *Welcome to WalLearn!*
_The study chatbot that never lets you fail the same question twice._

Most AI study tools suffer from amnesia. WalLearn gives your study prep *permanent memory on Walrus Protocol*. Every mistake you make is diagnosed and written to Walrus Mainnet, so future sessions drill your weakest points first.

━━━━━━━━━━━━━━━━━━━
⛓️ *Permanent Memory Engine:*
• *Storage:* Walrus Protocol (Mainnet)
• *On-Chain Account:* \`${accountShort}\`
• *Active Subject:* *Not Set Yet ⚠️*
• *Model:* \`${config.aiModel}\`
━━━━━━━━━━━━━━━━━━━

🚀 *How to use:*
1️⃣ *Upload Lecture Slides:* Send any PDF or notes file directly into this chat to generate a personalized CBT quiz.
2️⃣ *Cold Drill:* Type \`/study\` to recall your past mistakes and drill your weakest topics.
3️⃣ *Check Memory:* Type \`/briefing\` to view your top unresolved misconceptions.
4️⃣ *Verify On-Chain:* Type \`/ledger\` to see all blobs persisted to Walrus.
5️⃣ *Switch Subject:* Type \`/subject <code - title>\` (e.g., \`/subject BCH201 - Biochemistry\` or \`/subject CSC302 - OS\`).

━━━━━━━━━━━━━━━━━━━
📚 *Step 1: Set your active course/subject*
Please reply to this message with your *Course Code* and *Course Title by the side*, for example:
👉 \`BCH201 - General Biochemistry\`
👉 \`CSC302 - Operating Systems\`
👉 \`PCL301 - Clinical Pharmacokinetics\`

• Attach a lecture slide PDF anytime to generate a quiz specifically from your lecture notes!
━━━━━━━━━━━━━━━━━━━

_Reply with your course code & title or drop your slide PDF to begin!_`;

  await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
}

export async function handleMenu(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (!hasUserSubject(chatId)) {
    return handleStart(ctx);
  }

  const currentSubjectDisplay = getUserSubjectDisplay(chatId);
  const currentSubjectCode = getUserSubject(chatId);

  const keyboard = new InlineKeyboard()
    .text("🎯 Start Drill (/study)", "start_drill")
    .text("📊 Briefing", "view_briefing")
    .row()
    .text("🔄 Change Course", "change_subject")
    .text("📎 Attach Slides Guide", "upload_guide");

  const msg = `🎓 *WalLearn Active Session*\n\n📚 *Active Course:* *${currentSubjectDisplay}*\n⛓️ *Walrus Namespace:* \`${currentSubjectCode}\`\n\n_What would you like to do?_`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export async function handleSubject(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text || "";
  // Strip command name
  const match = text.match(/^\/subject\s*(.*)$/i);
  const rawArg = match ? match[1].trim() : "";

  if (!rawArg) {
    awaitingSubject.add(chatId);
    const current = getUserSubjectDisplay(chatId);
    await ctx.reply(
      `📚 *Active Course:* *${current}*\n\nTo set or switch your course, please reply with your *Course Code* and *Course Title by the side*, for example:\n👉 \`BCH201 - General Biochemistry\`\n👉 \`CSC302 - Operating Systems\`\n👉 \`PCL301 - Clinical Pharmacokinetics\`\n\n• Attach a lecture slide PDF anytime to generate a quiz specifically from your lecture notes!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const profile = setUserSubject(chatId, rawArg);
  const keyboard = new InlineKeyboard()
    .text("⚡ 5 Questions", "start_quiz_5")
    .text("🎯 10 Questions", "start_quiz_10")
    .row()
    .text("🔥 20 Questions", "start_quiz_20")
    .text("📎 Attach Slides Guide", "upload_guide");

  await ctx.reply(
    `✅ *Active Course Updated!*\n• *Course:* *${profile.subjectDisplay}*\n• *Walrus Namespace:* \`${profile.subjectCode}\`\n\n• Attach a lecture slide PDF anytime to generate a quiz specifically from your lecture notes!\n\n_Choose your drill size below to start immediately:_`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}
