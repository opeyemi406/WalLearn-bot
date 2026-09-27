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

*1️⃣ Got Department Past Questions?* 📝
Send your past MCQ questions (text, file: PDF/Word, or snap a photo 📸). WalLearn analyzes your lecturer's question patterns (traps, scenario depth, high-yield topics) to mimic their exact style.

*2️⃣ Ready to Study Directly?* 📂
Proceed directly by entering your **Course Code & Title** (e.g. \`PCL301 - Evaluation of Drug Toxicity\` or \`BIO101\`). You can upload lecture slides, snap photos of notes, or begin instant CBT drills immediately!

*3️⃣ Returning Student?* 🔄
Did you clear your chat history or switch devices? Restore your past on-chain mistakes and 3-pass streaks anytime from Walrus Protocol!
━━━━━━━━━━━━━━━━━━━

_Choose an option below (tap a button or reply 1, 2, or 3):_`;

  const keyboard = new InlineKeyboard()
    .text("1️⃣ Analyze Past Questions", "analyze_past_q")
    .text("2️⃣ Study Directly / Slides", "upload_slides_direct")
    .row()
    .text("3️⃣ Restore Past Mistakes", "restore_prompt")
    .text("📊 Weakness Briefing", "view_briefing");

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
      `📚 *Active Course:* *${current}*\n\nTo set or switch your course, please reply with your *Course Code* and *Course Title by the side*, for example:\n👉 \`BCH201 - General Biochemistry\`\n👉 \`CSC302 - Operating Systems\`\n👉 \`PCL301 - Clinical Pharmacokinetics\`\n\n• Attach a lecture slide (PDF/Word) or snap a photo of your notes/slides anytime to quiz directly from your material!`,
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
    .text("📎 Attach Slides/Photos", "upload_guide");

  await ctx.reply(
    `✅ *Active Course Updated!*\n• *Course:* *${profile.subjectDisplay}*\n• *Walrus Namespace:* \`${profile.subjectCode}\`\n\n• Attach a lecture slide (PDF/Word) or snap a photo of your notes/slides anytime to quiz directly from your material!\n\n_Choose your drill size below to start immediately:_`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}
