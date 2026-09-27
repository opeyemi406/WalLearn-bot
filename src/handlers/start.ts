import { Context, InlineKeyboard } from "grammy";
import { config } from "../config.js";
import {
  hasUserSubject,
  getUserSubject,
  getUserSubjectDisplay,
  setUserSubject,
  awaitingSubject,
  clearUserProfile,
  userActiveTopic,
} from "../state.js";

/**
 * Handle /start command
 */
export async function handleStart(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { awaitingStartChoice, clearAwaitingStates } = await import("../state.js");
  clearAwaitingStates(chatId);
  awaitingStartChoice.add(chatId);

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  // If user already has an active course profile, welcome them back without wiping their session
  if (hasUserSubject(chatId)) {
    const currentSubjectDisplay = getUserSubjectDisplay(chatId);
    const currentSubjectCode = getUserSubject(chatId);
    const activeTopic = userActiveTopic.get(chatId);

    const keyboard = new InlineKeyboard()
      .text(`🎯 Study ${currentSubjectCode.toUpperCase()} (/study)`, "start_drill")
      .text("📊 Briefing (/briefing)", "view_briefing")
      .row()
      .text("📝 Analyze Past Questions", "analyze_past_q")
      .text("🔄 Switch Course", "change_subject");

    let msg = `🎓 *Welcome Back to WalLearn!*\n\n`;
    msg += `📚 *Active Course:* *${currentSubjectDisplay}*\n`;
    msg += `⛓️ *Walrus Protocol Namespace:* \`${currentSubjectCode}\`\n`;
    if (activeTopic) {
      msg += `🎯 *Focus Topic:* *${activeTopic}*\n`;
    }
    msg += `\n_Choose an option below, or reply directly with a new course code or topic:_`;

    await ctx.reply(formatTelegramMarkdown(msg), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // Fresh user onboarding
  const welcomeMessage = `🎓 *Welcome to WalLearn!*
_The decentralized study assistant with permanent memory on Walrus Protocol._

Most AI study tools suffer from amnesia. WalLearn permanently records your exam mistakes and misconceptions onto *Walrus Protocol Mainnet*, enforcing a strict *3-consecutive-pass rule* before any topic is marked as mastered.

━━━━━━━━━━━━━━━━━━━
🎯 *How would you like to start?*

*1️⃣ Ready to Study Directly?* 📂
Proceed directly by entering your *Course Code & Title* (e.g. \`ANA201 - Human Anatomy\` or \`BIO101\`). You can upload lecture slides/images or begin instant CBT drills immediately!

*2️⃣ Got Department Past Questions?* 📝
Send your past MCQ questions (text, documents: PDF/Word, or images: PNG/JPG). WalLearn analyzes your lecturer's question patterns (traps, scenario depth, high-yield topics) to mimic their exact style.

*3️⃣ Returning Student?* 🔄
Did you clear your chat history or switch devices? Restore your past on-chain mistakes and 3-pass streaks anytime from Walrus Protocol!
━━━━━━━━━━━━━━━━━━━

_Choose an option below (tap a button or reply 1, 2, or 3):_`;

  const keyboard = new InlineKeyboard()
    .text("1️⃣ Set Course / Study", "upload_slides_direct")
    .text("2️⃣ Analyze Past Questions", "analyze_past_q")
    .row()
    .text("3️⃣ Restore Past Mistakes", "restore_prompt")
    .text("📊 Weakness Briefing", "view_briefing");

  await ctx.reply(formatTelegramMarkdown(welcomeMessage), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * Handle /menu command (Active Session Dashboard)
 */
export async function handleMenu(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
  const { awaitingMenuChoice, awaitingStartChoice, clearAwaitingStates } = await import("../state.js");
  clearAwaitingStates(chatId);

  // If user has an active session, display active course dashboard
  if (hasUserSubject(chatId)) {
    awaitingMenuChoice.add(chatId);

    const currentSubjectDisplay = getUserSubjectDisplay(chatId);
    const currentSubjectCode = getUserSubject(chatId);
    const activeTopic = userActiveTopic.get(chatId);

    const keyboard = new InlineKeyboard()
      .text("🎯 Start Drill (/study)", "start_drill")
      .text("📊 Briefing (/briefing)", "view_briefing")
      .row()
      .text("🔄 Change Course", "change_subject")
      .text("📎 Attach Slides Guide", "upload_guide");

    let msg = `🎓 *WalLearn Active Session Dashboard*\n\n`;
    msg += `📚 *Active Course:* *${currentSubjectDisplay}*\n`;
    msg += `⛓️ *Walrus Protocol Namespace:* \`${currentSubjectCode}\`\n`;
    if (activeTopic) {
      msg += `🎯 *Focus Topic:* *${activeTopic}*\n`;
    } else {
      msg += `🎯 *Focus Topic:* _All Course Topics (Full Scope)_\n`;
    }
    msg += `\n_What would you like to do? Choose an option below or reply directly:_`;

    await ctx.reply(formatTelegramMarkdown(msg), {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
    return;
  }

  // If user has NO active session yet, display session status clearly instead of duplicating /start
  awaitingStartChoice.add(chatId);

  const keyboard = new InlineKeyboard()
    .text("1️⃣ Set Course / Study", "upload_slides_direct")
    .text("2️⃣ Analyze Past Questions", "analyze_past_q")
    .row()
    .text("3️⃣ Restore Mistakes", "restore_prompt")
    .text("📊 Weakness Briefing", "view_briefing");

  let msg = `🎓 *WalLearn Session Dashboard*\n\n`;
  msg += `📚 *Active Course:* _None (No active course selected yet)_\n`;
  msg += `⛓️ *Walrus Namespace:* \`u${chatId}_unassigned\`\n\n`;
  msg += `_You do not have an active course session right now._\n\n`;
  msg += `To get started, choose an option below or reply directly with your *Course Code* (e.g. \`ANA201\` or \`PCL301\`):`;

  await ctx.reply(formatTelegramMarkdown(msg), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * Handle /subject command
 */
export async function handleSubject(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  const text = ctx.message?.text || "";
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

/**
 * Handle /reset or /clear command to explicitly start completely fresh
 */
export async function handleReset(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  clearUserProfile(chatId);
  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  await ctx.reply(
    formatTelegramMarkdown(
      `🔄 *Session Reset Successful*\n\n` +
      `Your active course profile and local session have been cleared. Past memory blobs permanently stored on Walrus Protocol Mainnet remain intact.\n\n` +
      `Type /start or reply directly with a *Course Code* (e.g. \`ANA201\`) to begin fresh!`
    ),
    { parse_mode: "Markdown" }
  );
}
