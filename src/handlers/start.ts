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
  const { awaitingStartChoice, clearAwaitingStates } = await import("../state.js");
  clearAwaitingStates(chatId);
  awaitingStartChoice.add(chatId);

  const accountShort = `${config.walrusAccountId.slice(0, 10)}...${config.walrusAccountId.slice(-8)}`;

  const welcomeMessage = `🎓 *Welcome to WalLearn!*
_The decentralized study assistant with permanent memory on Walrus Protocol._

Most AI study tools suffer from amnesia. WalLearn permanently records your exam mistakes and misconceptions onto *Walrus Protocol Mainnet*, enforcing a strict *3-consecutive-pass rule* before any topic is marked as mastered.

━━━━━━━━━━━━━━━━━━━
🎯 *How would you like to start?*

*1️⃣ Got Department Past Questions?* 📝
Send your past MCQ questions (text, documents: PDF/Word, or images: PNG/JPG). WalLearn analyzes your lecturer's question patterns (traps, scenario depth, high-yield topics) to mimic their exact style.

*2️⃣ Ready to Study Directly?* 📂
Proceed directly by entering your *Course Code & Title* (e.g. \`PCL301 - Evaluation of Drug Toxicity\` or \`BIO101\`). You can upload lecture slides/images or begin instant CBT drills immediately!

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

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  await ctx.reply(formatTelegramMarkdown(welcomeMessage), {
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

  const { awaitingMenuChoice, clearAwaitingStates } = await import("../state.js");
  clearAwaitingStates(chatId);
  awaitingMenuChoice.add(chatId);

  const currentSubjectDisplay = getUserSubjectDisplay(chatId);
  const currentSubjectCode = getUserSubject(chatId);

  const keyboard = new InlineKeyboard()
    .text("🎯 Start Drill (/study)", "start_drill")
    .text("📊 Briefing", "view_briefing")
    .row()
    .text("🔄 Change Course", "change_subject")
    .text("📎 Attach Slides Guide", "upload_guide");

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  const msg = `🎓 *WalLearn Active Session*\n\n📚 *Active Course:* *${currentSubjectDisplay}*\n⛓️ *Walrus Namespace:* \`${currentSubjectCode}\`\n\n_What would you like to do?_`;

  await ctx.reply(formatTelegramMarkdown(msg), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

export async function handleSubject(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  const text = ctx.message?.text || "";
  // Strip command name
  const match = text.match(/^\/subject\s*(.*)$/i);
  const rawArg = match ? match[1].trim() : "";

  if (!rawArg) {
    awaitingSubject.add(chatId);
    const current = getUserSubjectDisplay(chatId);
    await ctx.reply(
      formatTelegramMarkdown(
        `📚 *Active Course:* *${current}*\n\nTo set or switch your course, please reply with your *Course Code* and *Course Title by the side*, for example:\n👉 \`BCH201 - General Biochemistry\`\n👉 \`CSC302 - Operating Systems\`\n👉 \`PCL301 - Clinical Pharmacokinetics\`\n\n• Attach lecture slides or images anytime to quiz directly from your material!`
      ),
      { parse_mode: "Markdown" }
    );
    return;
  }

  const profile = setUserSubject(chatId, rawArg);
  const { awaitingStudyTopic } = await import("../state.js");
  awaitingStudyTopic.set(chatId, profile.subjectCode);

  const keyboard = new InlineKeyboard()
    .text("📎 Attach Slides/Images Guide", "upload_guide");

  await ctx.reply(
    formatTelegramMarkdown(
      `✅ *Active Course Set:* *${profile.subjectDisplay}*\n` +
      `⛓️ *Walrus Protocol Namespace:* \`${profile.subjectCode}\`\n\n` +
      `📂 *How would you like to prepare for ${profile.subjectCode.toUpperCase()}?*\n\n` +
      `1️⃣ 📄 *Upload Lecture Slides or Images:*\n` +
      `Attach your slide file (PDF, PPTX, Word) or images now to quiz directly from your lecture material.\n\n` +
      `2️⃣ 💬 *Or Reply with the Topic:*\n` +
      `Reply with any topic in ${profile.subjectCode.toUpperCase()} (e.g. \`Introduction & Core Concepts\`) and I will generate questions specifically on that topic!`
    ),
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}
