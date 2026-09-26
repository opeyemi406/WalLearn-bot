import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import { awaitingRestoreCourse, getPastCourseCodesForUser, getUserSubject } from "../state.js";

/**
 * Entrypoint for /restore and /mistakes commands
 */
export async function handleRestore(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = ctx.message?.text?.trim() || "";
  const parts = text.split(/\s+/);
  const explicitCourse = parts.length > 1 ? parts[1].trim() : null;

  if (explicitCourse) {
    // User directly supplied course code: /restore PCL301
    await executeRestoreCourse(ctx, explicitCourse);
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("📚 Specific Course Code", "restore_course_prompt")
    .text("🌐 All Course Codes", "restore_all");

  const msg =
    `🔄 *Walrus Protocol Mainnet Restore Engine*\n\n` +
    `_Decentralized memory blobs stored on Walrus are permanent and immutable. ` +
    `Even if your Telegram chat history was cleared, your past missed questions, misconceptions, ` +
    `and 3-pass mastery streaks remain safely stored on-chain._\n\n` +
    `Select what you want to restore:`;

  await ctx.reply(msg, {
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

    let msg = `⛓️ *Walrus On-Chain Recovery Complete: ${cleanCode}*\n\n`;
    msg += `• *Walrus Mainnet Status:* ${restoreResult.success ? "🟢 Synchronized" : "⚠️ Offline"}\n`;
    msg += `• *Permanent Blobs On-Chain:* *${restoreResult.total}*\n`;
    msg += `• *Tracked Weaknesses:* *${courseRecords.length}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

    if (courseRecords.length === 0) {
      if (restoreResult.total === 0) {
        msg += `✨ *Fresh Course Record!* No past mistakes exist for *${cleanCode}* on Walrus.\n`;
        msg += `You are studying this course for the first time. Start a study session with /study to begin!`;
      } else {
        msg += `Found ${restoreResult.total} storage blobs on Walrus for ${cleanCode}.\n`;
        msg += `Take a quiz with /study or view your /briefing!`;
      }
    } else {
      msg += `📋 *Restored Mistakes & Streaks:*\n`;
      courseRecords.forEach((item, i) => {
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

      msg += `\n🎯 _To drill these specific past mistakes, type /drill or upload your lecture slides!_`;
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

/**
 * Safely edit or send long message texts within Telegram 4096 character limit
 */
async function replySafeChunks(ctx: Context, initialMessageId: number, fullText: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const MAX_CHUNK = 3600;
  if (fullText.length <= MAX_CHUNK) {
    await ctx.api.editMessageText(chatId, initialMessageId, fullText, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
    }).catch(async () => {
      await ctx.api.editMessageText(chatId, initialMessageId, fullText);
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
    await ctx.api.editMessageText(chatId, initialMessageId, chunks[0], {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
    }).catch(async () => {
      await ctx.api.editMessageText(chatId, initialMessageId, chunks[0]);
    });
  }

  // Send subsequent chunks as follow-up messages
  for (let i = 1; i < chunks.length; i++) {
    await ctx.reply(chunks[i], {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: false },
    }).catch(async () => {
      await ctx.reply(chunks[i]);
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
    let pastCodes = getPastCourseCodesForUser(chatId);
    const activeSubject = getUserSubject(chatId);
    if (activeSubject && activeSubject !== "general" && !pastCodes.includes(activeSubject.toLowerCase())) {
      pastCodes.push(activeSubject.toLowerCase());
    }
    if (pastCodes.length === 0) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `⛓️ *Walrus On-Chain Global Recovery Report*\n\n` +
        `• *Permanent Blobs On-Chain:* *0*\n` +
        `• *Total Tracked Weaknesses Across All Courses:* *0*\n\n` +
        `_No courses or mistake history found on Walrus for your account._\n` +
        `Start studying with /study or upload slides to begin tracking!`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    let totalBlobsFound = 0;
    for (const code of pastCodes) {
      const res = await walrus.restoreNamespace(code, chatId);
      totalBlobsFound += res.total;
    }

    const ledger = await walrus.getLedger(chatId);
    const userRecords = ledger.filter((r) => r.chatId === chatId);

    let msg = `⛓️ *Walrus On-Chain Global Recovery Report*\n\n`;
    msg += `• *Permanent Blobs On-Chain:* *${totalBlobsFound}*\n`;
    msg += `• *Total Tracked Weaknesses Across All Courses:* *${userRecords.length}*\n`;
    msg += `• *Courses Detected:* ${pastCodes.map((c) => `\`${c.toUpperCase()}\``).join(", ")}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━\n\n`;

    if (userRecords.length === 0) {
      msg += `_No mistakes recorded across any course code yet._\nStart studying with /study or upload slides to begin tracking!`;
    } else {
      // Group by course code
      const byCourse = new Map<string, typeof userRecords>();
      for (const r of userRecords) {
        const c = (r.namespace || "general").toUpperCase();
        if (!byCourse.has(c)) byCourse.set(c, []);
        byCourse.get(c)!.push(r);
      }

      for (const [course, items] of byCourse.entries()) {
        msg += `📚 *${course} (${items.length} records):*\n`;
        items.slice(0, 4).forEach((item, i) => {
          const streak = item.correctStreak || 0;
          const badge = streak >= 3 ? "🏆 3/3" : `${streak}/3`;
          msg += `  ${i + 1}. *${item.topic}* [${badge}]\n`;
          if (item.blobId) {
            msg += `     [Walrusscan Blob](https://walruscan.com/mainnet/blob/${item.blobId})\n`;
          }
        });
        if (items.length > 4) {
          msg += `  _...and ${items.length - 4} more topics_\n`;
        }
        msg += `\n`;
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
