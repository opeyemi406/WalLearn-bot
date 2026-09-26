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
_The decentralized study assistant with permanent memory on Walrus Protocol._

Most AI study tools suffer from amnesia. WalLearn permanently records your exam mistakes and misconceptions onto **Walrus Protocol Mainnet**, enforcing a strict **3-consecutive-pass rule** before any topic is marked as mastered.

━━━━━━━━━━━━━━━━━━━
🎯 *How would you like to start?*

*Option A: Got Department Past Questions?* 📝
Send your department past MCQ questions (text or file: PDF, Word, TXT). WalLearn will use **MemWal** to analyze your lecturer's question patterns (traps, scenario depth, high-yield topics) and store them on-chain. Once analyzed, you can upload your slides to quiz matching that exact style!

*Option B: Ready to Study Directly?* 📂
If you don't have past questions, proceed directly by entering your **Course Code & Title**. You can then upload your lecture slides or begin drilling right away!

*Option C: Returning Student?* 🔄
Did you clear your chat history or switch devices? Your past mistakes and 3-pass streaks are permanently preserved on Walrus Protocol. Restore them anytime!
━━━━━━━━━━━━━━━━━━━

_Choose an option below to begin:_`;

  const keyboard = new InlineKeyboard()
    .text("📝 Analyze Past Questions", "analyze_past_q")
    .text("📂 Upload Lecture Slides", "upload_slides_direct")
    .row()
    .text("🔄 Restore Past Mistakes", "restore_prompt")
    .text("📊 Briefing", "view_briefing");

  await ctx.reply(welcomeMessage, {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
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
