import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import { awaitingRestoreCourse, getPastCourseCodesForUser, getUserSubject } from "../state.js";

/**
 * Entrypoint for /restore and /mistakes commands
 */
export async function handleRestore(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const isCommand = !ctx.callbackQuery && (ctx.message?.text?.startsWith("/restore") || ctx.message?.text?.startsWith("/mistakes"));
  const text = isCommand ? (ctx.message?.text?.trim() || "") : "";
  const parts = text.split(/\s+/);
  const explicitCourse = (isCommand && parts.length > 1) ? parts[1].trim() : null;

  if (explicitCourse) {
    // User directly supplied course code: /restore PCL301
    await executeRestoreCourse(ctx, explicitCourse);
    return;
  }

  // Pre-arm awaitingRestoreCourse so typing the course code directly without pressing the button works instantly
  const { clearAwaitingStates } = await import("../state.js");
  clearAwaitingStates(chatId);
  awaitingRestoreCourse.add(chatId);

  const keyboard = new InlineKeyboard()
    .text("📚 Specific Course Code", "restore_course_prompt")
    .text("🌐 All Course Codes", "restore_all");

  const msg =
    `🔄 *Walrus Protocol Mainnet Restore Engine*\n\n` +
    `_Decentralized memory blobs stored on Walrus are permanent and immutable. ` +
    `Even if your Telegram chat history was cleared, your past missed questions, misconceptions, ` +
    `and 3-pass mastery streaks remain safely stored on-chain._\n\n` +
    `Select what you want to restore, or reply directly with your *Course Code* (e.g. \`ANA201\` or \`PCL301\`):`;

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
      .text("📚 Restore Another Course", "restore_course_prompt")
      .text("🌐 All Courses Report", "restore_all");

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

/**
 * Restore mistakes across all course codes the user has ever studied
 */
export async function executeRestoreAll(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const statusMsg = await ctx.reply(`⏳ *Scanning and restoring all course codes from Walrus Protocol Mainnet...*`, {
    parse_mode: "Markdown",
  });

  try {
    // 1. Gather all potential course codes to probe on Walrus Protocol
    const candidateCodes = new Set<string>();

    // User's active course
    const activeSubject = getUserSubject(chatId);
    if (activeSubject && activeSubject !== "general" && /^[a-z]{2,5}\d{2,4}$/i.test(activeSubject)) {
      candidateCodes.add(activeSubject.toLowerCase());
    }

    // User's recorded past courses (from user profile history & local ledger)
    const userCodes = getPastCourseCodesForUser(chatId);
    for (const c of userCodes) candidateCodes.add(c.toLowerCase());

    const candidates = Array.from(candidateCodes);
    console.log(`🔍 [Walrus Restore All] Probing ${candidates.length} user courses for chat ${chatId}:`, candidates);

    let totalBlobsFound = 0;
    const restoredCourses = new Set<string>();
    const courseBlobs = new Map<string, number>();

    // 2. Probe Walrus Protocol for each candidate course
    for (const code of candidates) {
      try {
        const res = await walrus.restoreNamespace(code, chatId);
        totalBlobsFound += res.total;
        if (res.total > 0 || res.restored > 0) {
          restoredCourses.add(code.toLowerCase());
          courseBlobs.set(code.toLowerCase(), res.total);
        }
      } catch {
        // Continue probing other courses
      }
    }

    // Include courses user has active or recorded in ledger
    for (const c of userCodes) restoredCourses.add(c.toLowerCase());
    if (activeSubject && activeSubject !== "general") restoredCourses.add(activeSubject.toLowerCase());

    const ledger = await walrus.getLedger(chatId);
    const userRecords = ledger.filter((r) => r.chatId === chatId);
    for (const r of userRecords) {
      const rawNs = (r.namespace || "").toLowerCase();
      const clean = rawNs.replace(/^u\d+_/, "");
      if (clean && /^[a-z]{2,5}\d{2,4}$/i.test(clean)) {
        restoredCourses.add(clean);
      }
    }

    const detectedCourses = Array.from(restoredCourses);

    if (detectedCourses.length === 0) {
      let emptyMsg = `⛓️ *Walrus On-Chain Recovery Complete*\n\n`;
      emptyMsg += `✨ *Zero Recorded Courses or Mistakes!* You haven't started or missed any questions yet.\n\n`;
      emptyMsg += `Type /study or enter a course code (e.g. \`PCL301\`) to start your first practice drill!`;
      await ctx.api.editMessageText(chatId, statusMsg.message_id, emptyMsg, { parse_mode: "Markdown" });
      return;
    }

    const userMistakes = userRecords.filter(
      (r) =>
        r.recordType !== "fact" &&
        (r.misses || 0) > 0 &&
        r.topic !== "Exam Syllabus Fact" &&
        r.topic !== "Syllabus Concept"
    );

    const userFacts = userRecords.filter(
      (r) =>
        r.recordType === "fact" ||
        (r.misses || 0) === 0 ||
        r.topic === "Exam Syllabus Fact" ||
        r.topic === "Syllabus Concept"
    );

    let msg = `⛓️ *Walrus On-Chain Global Recovery Report*\n\n`;
    msg += `• *Walrus Mainnet Status:* 🟢 Synchronized\n`;
    msg += `• *Total Tracked Weaknesses (Mistakes):* *${userMistakes.length}*\n`;
    if (userFacts.length > 0) {
      msg += `• *Total Verified Exam Facts:* *${userFacts.length}*\n`;
    }
    msg += `• *Courses Detected:* ${detectedCourses.map((c) => `\`${c.toUpperCase()}\``).join(", ")}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

    if (userMistakes.length === 0 && userFacts.length === 0) {
      msg += `_No mistakes or facts recorded across ${detectedCourses.map((c) => c.toUpperCase()).join(", ")} yet._\nStart studying with /study or upload slides to begin tracking!`;
    } else {
      // Group by course code, stripping any u<chatId>_ namespace prefix
      const byCourse = new Map<string, typeof userRecords>();
      for (const r of userRecords) {
        const rawNs = (r.namespace || "general").toLowerCase();
        const clean = rawNs.replace(/^u\d+_/, "").toUpperCase();
        if (!byCourse.has(clean)) byCourse.set(clean, []);
        byCourse.get(clean)!.push(r);
      }

      for (const courseLower of detectedCourses) {
        const course = courseLower.toUpperCase();
        const items = byCourse.get(course) || [];
        const mistakes = items.filter((r) => r.recordType !== "fact" && (r.misses || 0) > 0);
        const facts = items.filter((r) => r.recordType === "fact" || (r.misses || 0) === 0);
        const blobsCount = courseBlobs.get(courseLower) || 0;

        if (mistakes.length === 0) {
          if (blobsCount > 0) {
            msg += `📚 *${course}:* 🟢 Synchronized on Walrus Mainnet\n`;
            msg += `  _Run /restore ${course} to review detailed question items._\n\n`;
          } else {
            msg += `📚 *${course}:* ✨ Zero mistakes recorded (${facts.length} exam facts stored)\n\n`;
          }
        } else {
          msg += `📚 *${course} (${mistakes.length} mistakes${facts.length > 0 ? `, ${facts.length} exam facts` : ""}):*\n`;
          mistakes.slice(0, 4).forEach((item, i) => {
            const streak = item.correctStreak || 0;
            const badge = streak >= 3 ? "🏆 3/3" : `${streak}/3`;
            msg += `  ${i + 1}. *${item.topic}* [${badge}]\n`;
            if (item.blobId) {
              msg += `     [Walrusscan Blob](https://walruscan.com/mainnet/blob/${item.blobId})\n`;
            }
          });
          if (mistakes.length > 4) {
            msg += `  _...and ${mistakes.length - 4} more topics_\n`;
          }
          msg += `\n`;
        }
      }

      msg += `🎯 _Run /restore <courseCode> to see full details for any specific course._`;
    }

    await replySafeChunks(ctx, statusMsg.message_id, msg);
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
