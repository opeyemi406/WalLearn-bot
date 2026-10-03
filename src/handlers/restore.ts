import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import { awaitingRestoreCourse, getPastCourseCodesForUser, getUserSubject } from "../state.js";

/**
 * Entrypoint for /restore, /mistakes and /ledger commands
 */
export async function handleRestore(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const isCommand =
    !ctx.callbackQuery &&
    (ctx.message?.text?.startsWith("/restore") ||
      ctx.message?.text?.startsWith("/mistakes") ||
      ctx.message?.text?.startsWith("/ledger"));
  const text = isCommand ? ctx.message?.text?.trim() || "" : "";
  const parts = text.split(/\s+/);
  const explicitCourse = isCommand && parts.length > 1 ? parts[1].trim() : null;

  if (explicitCourse) {
    // User directly supplied course code: /restore PCL301
    await executeRestoreCourse(ctx, explicitCourse);
    return;
  }

  // Pre-arm awaitingRestoreCourse so typing the course code directly without pressing buttons works instantly
  const { clearAwaitingStates } = await import("../state.js");
  clearAwaitingStates(chatId);
  awaitingRestoreCourse.add(chatId);

  // Quick-select buttons for any past courses the user studied
  const pastCourses = getPastCourseCodesForUser(chatId);
  const activeSubject = getUserSubject(chatId);
  const quickCourses = new Set<string>();
  if (activeSubject && activeSubject !== "general" && /^[a-z]{2,5}\d{2,4}$/i.test(activeSubject)) {
    quickCourses.add(activeSubject.toUpperCase());
  }
  for (const c of pastCourses) {
    if (/^[a-z]{2,5}\d{2,4}$/i.test(c)) quickCourses.add(c.toUpperCase());
  }

  const keyboard = new InlineKeyboard();
  const courseList = Array.from(quickCourses);
  if (courseList.length > 0) {
    for (const code of courseList.slice(0, 4)) {
      keyboard.text(`📚 ${code}`, `restore_course_quick_${code.toLowerCase()}`).row();
    }
  }
  keyboard.text("❌ Cancel", "main_menu");

  const msg =
    `🔄 *Walrus Protocol Mainnet Restore Engine*\n\n` +
    `_Decentralized memory blobs on Walrus Protocol are isolated per course namespace (\`u<chatId>_<courseCode>\`)._\n\n` +
    `Please reply with the *Course Code* you want to restore from Walrus (e.g. \`PCL301\`, \`ANA201\`, \`CHM211\`):`;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  await ctx.reply(formatTelegramMarkdown(msg), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * Restore mistakes for a specific course code from Walrus Mainnet
 */
export async function executeRestoreCourse(ctx: Context, courseCode: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const cleanCode = courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const statusMsg = await ctx.reply(`⏳ *Restoring past mistakes for ${cleanCode} from Walrus Protocol Mainnet...*`, {
    parse_mode: "Markdown",
  });

  try {
    const restoreResult = await walrus.restoreNamespace(cleanCode, chatId);
    const ledger = await walrus.getLedger(chatId);

    const courseRecords = ledger.filter(
      (r) =>
        r.chatId === chatId &&
        r.namespace?.toLowerCase() === cleanCode.toLowerCase()
    );

    const mistakeRecords = courseRecords.filter(
      (r) =>
        r.recordType !== "fact" &&
        (r.misses || 0) > 0 &&
        r.topic !== "Exam Syllabus Fact" &&
        r.topic !== "Syllabus Concept"
    );

    const factRecords = courseRecords.filter(
      (r) =>
        r.recordType === "fact" ||
        (r.misses || 0) === 0 ||
        r.topic === "Exam Syllabus Fact" ||
        r.topic === "Syllabus Concept"
    );

    let msg = `⛓️ *Walrus On-Chain Recovery Complete: ${cleanCode}*\n\n`;
    msg += `• *Walrus Mainnet Status:* ${restoreResult.success ? "🟢 Synchronized" : "⚠️ Offline"}\n`;
    msg += `• *Tracked Weaknesses (Mistakes):* *${mistakeRecords.length}*\n`;
    if (factRecords.length > 0) {
      msg += `• *Verified Exam Facts:* *${factRecords.length}*\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

    const { clearAwaitingStates } = await import("../state.js");
    clearAwaitingStates(chatId);

    const restoreKeyboard = new InlineKeyboard()
      .text(`🎯 Study ${cleanCode.toUpperCase()}`, `study_course_${cleanCode.toLowerCase()}`)
      .row()
      .text("📚 Restore Another Course", "restore_course_prompt");

    if (mistakeRecords.length === 0) {
      if (factRecords.length === 0) {
        msg += `✨ *Fresh Course Record!* No past mistakes exist for *${cleanCode}* on Walrus.\n`;
        msg += `You haven't recorded any missed questions or misconceptions for this course yet.\n\n`;
        msg += `_To review another course or start a study drill, select an option below:_`;
      } else {
        msg += `✨ *Zero Recorded Exam Mistakes!* You haven't made any mistakes in *${cleanCode}* yet.\n\n`;
        msg += `📚 *Department Exam Facts on Walrus (${factRecords.length} stored):*\n`;
        factRecords.slice(0, 5).forEach((f) => {
          const cleanF = f.correctFact ? (f.correctFact.length > 140 ? `${f.correctFact.slice(0, 140)}...` : f.correctFact) : f.topic;
          msg += `• ${cleanF.replace(/^\[(?:FACT|EXAM_FACT)\]\s*/i, "")}\n`;
        });
        if (factRecords.length > 5) {
          msg += `_...and ${factRecords.length - 5} more facts saved on-chain._\n`;
        }
        msg += `\n🎯 _To drill this course or review other records, select an option below:_`;
      }
    } else {
      msg += `📋 *Restored Mistakes & Streaks:*\n`;
      mistakeRecords.forEach((item, i) => {
        const streak = item.correctStreak || 0;
        let streakBadge = "⏳ 0/3 (Needs Drill)";
        if (streak === 1) streakBadge = "🔄 1/3 (Pass 1 Confirmed)";
        if (streak === 2) streakBadge = "⚡ 2/3 (1 More Pass to Master)";
        if (streak >= 3 || item.status === "mastered") streakBadge = "🏆 3/3 (Mastered)";

        const cleanMisconception = item.misconception
          ? item.misconception.length > 140
            ? `${item.misconception.slice(0, 140)}...`
            : item.misconception
          : null;

        const cleanFact = item.correctFact
          ? item.correctFact.length > 140
            ? `${item.correctFact.slice(0, 140)}...`
            : item.correctFact
          : null;

        msg += `\n*${i + 1}. ${item.topic}* [${streakBadge}]\n`;
        if (cleanMisconception) {
          msg += `• *Misconception:* _${cleanMisconception}_\n`;
        }
        if (cleanFact) {
          msg += `• *Key Fact:* ${cleanFact}\n`;
        }
        if (item.blobId) {
          msg += `• *Walrusscan:* [Verify Blob](https://walruscan.com/mainnet/blob/${item.blobId})\n`;
        }
      });

      if (factRecords.length > 0) {
        msg += `\n━━━━━━━━━━━━━━━━━━━\n`;
        msg += `📚 *Plus ${factRecords.length} Department Exam Facts* extracted from your past question analysis!\n`;
      }

      msg += `\n🎯 _To drill this specific course, tap below or type /study anytime:_`;
    }

    await replySafeChunks(ctx, statusMsg.message_id, msg, restoreKeyboard);
  } catch (err) {
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      `⚠️ *Restore failed:* ${(err as Error).message}\nPlease try again later.`,
      { parse_mode: "Markdown" }
    ).catch(async () => {
      await ctx.reply(`⚠️ *Restore failed:* ${(err as Error).message}`);
    });
  }
}

/**
 * Safely edit or send long message texts within Telegram 4096 character limit
 */
async function replySafeChunks(ctx: Context, initialMessageId: number, fullText: string, keyboard?: InlineKeyboard) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const MAX_CHUNK = 3600;
  if (fullText.length <= MAX_CHUNK) {
    await ctx.api.editMessageText(chatId, initialMessageId, fullText, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
      reply_markup: keyboard,
    }).catch(async () => {
      await ctx.api.editMessageText(chatId, initialMessageId, fullText, { reply_markup: keyboard });
    });
    return;
  }

  // Split into chunks by double newlines
  const paragraphs = fullText.split("\n\n");
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    if ((currentChunk + "\n\n" + para).length > MAX_CHUNK) {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = para;
    } else {
      currentChunk = currentChunk ? `${currentChunk}\n\n${para}` : para;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  // Edit initial message with first chunk
  if (chunks.length > 0) {
    const isSingle = chunks.length === 1;
    await ctx.api.editMessageText(chatId, initialMessageId, chunks[0], {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
      reply_markup: isSingle ? keyboard : undefined,
    }).catch(async () => {
      await ctx.api.editMessageText(chatId, initialMessageId, chunks[0], {
        reply_markup: isSingle ? keyboard : undefined,
      });
    });
  }

  // Send subsequent chunks as follow-up messages
  for (let i = 1; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    await ctx.reply(chunks[i], {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
      reply_markup: isLast ? keyboard : undefined,
    }).catch(async () => {
      await ctx.reply(chunks[i], { reply_markup: isLast ? keyboard : undefined });
    });
  }
}
