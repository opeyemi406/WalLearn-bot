import { Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import {
  hasUserSubject,
  getUserSubject,
  getUserSubjectDisplay,
  setUserSubject,
  awaitingSubject,
} from "../state.js";

export async function handleStart(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const isConfigured = hasUserSubject(chatId);
  const currentSubjectDisplay = getUserSubjectDisplay(chatId);
  const currentSubjectCode = getUserSubject(chatId);

  const accountShort = `${config.walrusAccountId.slice(0, 10)}...${config.walrusAccountId.slice(-8)}`;

  let welcomeMessage = `🎓 *Welcome to WalLearn!*
_The study chatbot that never lets you fail the same question twice._

Most AI study tools suffer from amnesia. WalLearn gives your study prep *permanent memory on Walrus Protocol*. Every mistake you make is diagnosed and written to Walrus Mainnet, so future sessions drill your weakest points first.

━━━━━━━━━━━━━━━━━━━
⛓️ *Permanent Memory Engine:*
• *Storage:* Walrus Protocol (Mainnet)
• *On-Chain Account:* \`${accountShort}\`
• *Active Subject:* *${isConfigured ? currentSubjectDisplay : "Not Set Yet ⚠️"}*
• *Model:* \`${config.aiModel}\`
━━━━━━━━━━━━━━━━━━━

🚀 *How to use:*
1️⃣ *Upload Lecture Slides:* Send any PDF or notes file directly into this chat to generate a personalized CBT quiz.
2️⃣ *Cold Drill:* Type \`/study\` to recall your past mistakes and drill your weakest topics.
3️⃣ *Check Memory:* Type \`/briefing\` to view your top unresolved misconceptions.
4️⃣ *Verify On-Chain:* Type \`/ledger\` to see all blobs persisted to Walrus.
5️⃣ *Switch Subject:* Type \`/subject <code - title>\` (e.g., \`/subject BCH201 - Biochemistry\` or \`/subject CSC302 - OS\`).
`;

  if (!isConfigured) {
    awaitingSubject.add(chatId);

    welcomeMessage += `
━━━━━━━━━━━━━━━━━━━
📚 *Step 1: Set your active course/subject*
Please reply to this message with your *Course Code* and *Course Title by the side*, for example:
👉 \`BCH201 - General Biochemistry\`
👉 \`CSC302 - Operating Systems\`
👉 \`PCL301 - Clinical Pharmacokinetics\`

📎 *Step 2: Have lecture slides or notes?*
Attach any lecture slide PDF or notes document directly to this chat to generate a personalized CBT quiz grounded in your syllabus!
━━━━━━━━━━━━━━━━━━━

_Reply with your course code & title or drop your slide PDF to begin!_`;

    await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
    return;
  }

  // Returning user with subject set
  welcomeMessage += `\n_Ready? Drop a lecture slide PDF or type /study to begin!_`;

  const keyboard = new InlineKeyboard()
    .text("🎯 Start Drill (/study)", "start_drill")
    .text("📊 Briefing", "view_briefing")
    .row()
    .text("🔄 Change Course", "change_subject")
    .text("📎 Attach Slides Guide", "upload_guide");

  await ctx.reply(welcomeMessage, {
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
      `📚 *Active Course:* *${current}*\n\nTo set or switch your course, please reply with your *Course Code* and *Course Title by the side*, for example:\n👉 \`BCH201 - General Biochemistry\`\n👉 \`CSC302 - Operating Systems\`\n👉 \`PCL301 - Clinical Pharmacokinetics\``,
      { parse_mode: "Markdown" }
    );
    return;
  }

  const profile = setUserSubject(chatId, rawArg);
  const keyboard = new InlineKeyboard()
    .text("🎯 Start Drill Now", "start_drill")
    .text("📊 View Briefing", "view_briefing");

  await ctx.reply(
    `✅ *Active Course Updated!*\n• *Course:* *${profile.subjectDisplay}*\n• *Walrus Namespace:* \`${profile.subjectCode}\`\n\nAll subsequent mistakes, CBT quizzes, and briefings will be scoped to this course on Walrus Mainnet.\n\nType /study or attach a lecture slide PDF to start!`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}
