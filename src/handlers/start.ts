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

  if (!isConfigured) {
    // First-time user onboarding
    awaitingSubject.add(chatId);

    const onboardingMsg = `🎓 *Welcome to WalLearn!*
_The AI study chatbot with permanent memory on Walrus Protocol._

Most AI study tools suffer from amnesia. WalLearn permanently records every mistake and misconception you make on **Walrus Mainnet**, so your future study sessions drill your weakest points first.

━━━━━━━━━━━━━━━━━━━
📚 *Step 1: What course or subject are you studying?*

Please reply to this message with your *Course Code* and *Course Title*, for example:
👉 \`BCH201 - General Biochemistry\`
👉 \`CSC302 - Operating Systems\`
👉 \`PCL301 - Clinical Pharmacokinetics\`

📎 *Step 2: Have lecture slides or notes?*
You can attach any lecture slide PDF or notes document directly to this chat to generate a personalized CBT quiz grounded in your syllabus!
━━━━━━━━━━━━━━━━━━━

_Reply with your course code and title below to begin!_`;

    await ctx.reply(onboardingMsg, { parse_mode: "Markdown" });
    return;
  }

  // Returning user screen
  const keyboard = new InlineKeyboard()
    .text("🎯 Start Drill (/study)", "start_drill")
    .text("📊 Briefing", "view_briefing")
    .row()
    .text("🔄 Change Course", "change_subject")
    .text("📎 Attach Slides Guide", "upload_guide");

  const welcomeMessage = `🎓 *Welcome back to WalLearn!*

━━━━━━━━━━━━━━━━━━━
📚 *Active Course:* *${currentSubjectDisplay}*
⛓️ *Walrus Namespace:* \`${currentSubjectCode}\`
🤖 *AI Engine:* \`${config.aiModel}\`
━━━━━━━━━━━━━━━━━━━

🚀 *Quick Actions:*
• *Take a Drill:* Tap below or type \`/study\` to recall your Walrus mistakes and quiz yourself.
• *Attach Slides:* Drop any PDF slide or past question document to quiz from your exact course material.
• *Review Weaknesses:* Type \`/briefing\` to see your top unresolved misconceptions.
• *Verify On-Chain:* Type \`/ledger\` to inspect your confirmed Walrus Mainnet blobs.
• *Switch Course:* Type \`/subject <code - title>\` or tap below.`;

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
