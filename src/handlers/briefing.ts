import { Context, InlineKeyboard } from "grammy";
import { walrus } from "../walrus/client.js";
import {
  getUserSubject,
  getUserSubjectDisplay,
  hasUserSubject,
  getPastCourseCodesForUser,
  awaitingBriefingCourse,
  clearAwaitingStates,
} from "../state.js";

/**
 * Entrypoint for /briefing command or button
 */
export async function handleBriefing(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const isCommand = !ctx.callbackQuery && ctx.message?.text?.startsWith("/briefing");
  const text = isCommand ? (ctx.message?.text?.trim() || "") : "";
  const parts = text.split(/\s+/);
  const explicitCourse = (isCommand && parts.length > 1) ? parts[1].trim() : null;

  if (explicitCourse) {
    if (/^(all|all\s+courses?|everything|🌐)$/i.test(explicitCourse)) {
      return executeBriefingAll(ctx);
    }
    return executeBriefingCourse(ctx, explicitCourse);
  }

  // Pre-arm awaitingBriefingCourse so typing the course code or "all" directly works instantly
  clearAwaitingStates(chatId);
  awaitingBriefingCourse.add(chatId);

  const keyboard = new InlineKeyboard();

  const currentSubject = getUserSubject(chatId);
  const hasSubject = hasUserSubject(chatId) && currentSubject !== "general";
  if (hasSubject) {
    keyboard.text(`🎯 Active: ${currentSubject.toUpperCase()}`, `briefing_course_${currentSubject}`).row();
  }

  keyboard
    .text("📚 Specific Course Code", "briefing_course_prompt")
    .text("🌐 All Courses Briefing", "briefing_all");

  const msg =
    `📊 *WalLearn Weakness Briefing Engine*\n\n` +
    `_Review your unresolved mistakes, misconceptions, and 3-pass mastery streaks stored permanently on Walrus Protocol Mainnet._\n\n` +
    `Select what you want to review, or reply directly with your *Course Code* (e.g. \`ANA201\` or \`PCL301\`), or type \`all\` for a global briefing:`;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  await ctx.reply(formatTelegramMarkdown(msg), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
}

/**
 * Generate Weakness Briefing for a specific course code
 */
export async function executeBriefingCourse(ctx: Context, courseCode: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");
  const cleanCode = courseCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

  const statusMsg = await ctx.reply(
    formatTelegramMarkdown(`🔍 _Querying Walrus Protocol Memory for ${cleanCode}..._`),
    { parse_mode: "Markdown" }
  );

  try {
    const briefing = await walrus.getWeaknessBriefing(cleanCode, chatId);
    const ledger = await walrus.getLedger(chatId);
    const factCount = ledger.filter(
      (r) =>
        r.chatId === chatId &&
        r.namespace?.toLowerCase() === cleanCode.toLowerCase() &&
        (r.recordType === "fact" || (r.misses || 0) === 0)
    ).length;

    if (briefing.weaknesses.length === 0) {
      let noMistakesMsg = `📊 *WalLearn Weakness Briefing*\nCourse: *${cleanCode}*\n\n✅ *Zero unresolved mistakes found on Walrus!* You haven't missed any questions in ${cleanCode} yet.\n`;
      if (factCount > 0) {
        noMistakesMsg += `\n📚 *${factCount} Department Exam Facts* are saved on Walrus from your past question analysis, ready for your drills!\n`;
      }
      noMistakesMsg += `\nSend your lecture slides/images or type /study to test yourself.`;

      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        formatTelegramMarkdown(noMistakesMsg),
        { parse_mode: "Markdown" }
      );
      return;
    }

    let report = `📊 *WalLearn Weakness Briefing (Cold Recall)*\n`;
    report += `Course: *${cleanCode}* | Tracked Mistakes: *${briefing.total_mistakes}*\n`;
    report += `━━━━━━━━━━━━━━━━━━━\n\n`;
    report += `⚠️ *Top Unresolved Misconceptions (Ranked):*\n`;

    briefing.weaknesses.forEach((w, idx) => {
      const severityEmoji = w.severity === "high" ? "🔴" : w.severity === "medium" ? "🟡" : "🟢";
      report += `\n*${idx + 1}. ${w.topic}* ${severityEmoji}\n`;
      report += `• *Miss Count:* ${w.misses}x | *Severity:* ${w.severity.toUpperCase()}\n`;
      if (w.streak === 2) {
        report += `• *Mastery Status:* 🟢 2/3 Passes (1 more pass needed to master!)\n`;
      } else if (w.streak === 1) {
        report += `• *Mastery Status:* 🟡 1/3 Passes (2 more passes needed)\n`;
      } else {
        report += `• *Mastery Status:* 🔴 0/3 Passes\n`;
      }
      if (w.misconception) {
        report += `• *Past Error:* _"${w.misconception}"_\n`;
      }
      if (w.correct_fact) {
        report += `• *Core Fact:* ${w.correct_fact}\n`;
      }
    });

    if (briefing.mastered.length > 0) {
      report += `\n━━━━━━━━━━━━━━━━━━━\n`;
      report += `🏆 *Mastered Topics (3/3 Passes Confirmed):*\n`;
      briefing.mastered.forEach((m) => {
        report += `• ${m} ✅\n`;
      });
    }

    if (factCount > 0) {
      report += `\n━━━━━━━━━━━━━━━━━━━\n`;
      report += `📚 *Plus ${factCount} Department Exam Facts* stored on Walrus!\n`;
    }

    report += `\n🎯 _Type /study to drill your weakest topics in ${cleanCode} now!_`;

    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      formatTelegramMarkdown(report),
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error in executeBriefingCourse:", error);
    await ctx.api.editMessageText(chatId, statusMsg.message_id, "⚠️ Failed to fetch briefing from Walrus. Please try again in a moment.");
  }
}

/**
 * Generate Weakness Briefing across all courses the student has ever studied
 */
export async function executeBriefingAll(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  const statusMsg = await ctx.reply(
    formatTelegramMarkdown(`🔍 _Querying Walrus Protocol Memory across all your courses..._`),
    { parse_mode: "Markdown" }
  );

  try {
    let pastCodes = getPastCourseCodesForUser(chatId);
    const activeSubject = getUserSubject(chatId);
    if (activeSubject && activeSubject !== "general" && !pastCodes.includes(activeSubject.toLowerCase())) {
      pastCodes.push(activeSubject.toLowerCase());
    }

    if (pastCodes.length === 0) {
      const allLedger = await walrus.getLedger();
      const detected = new Set<string>();
      for (const r of allLedger) {
        if (r.namespace && /^[a-z]{2,5}\d{2,4}$/i.test(r.namespace)) {
          detected.add(r.namespace.toLowerCase());
        }
      }
      pastCodes = Array.from(detected);
    }

    const ledger = await walrus.getLedger(chatId);
    const userRecords = ledger.filter((r) => r.chatId === chatId);

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

    let report = `📊 *WalLearn Global Weakness Briefing*\n`;
    report += `━━━━━━━━━━━━━━━━━━━\n\n`;

    if (pastCodes.length === 0 && userMistakes.length === 0) {
      report += `✅ *Zero unresolved mistakes across all courses!* You have a clean slate on Walrus Protocol.\n\n`;
      report += `Type /study or enter a course code to begin studying.`;
      await ctx.api.editMessageText(chatId, statusMsg.message_id, formatTelegramMarkdown(report), { parse_mode: "Markdown" });
      return;
    }

    report += `• *Total Unresolved Mistakes:* *${userMistakes.length}*\n`;
    if (userFacts.length > 0) {
      report += `• *Total Department Exam Facts:* *${userFacts.length}*\n`;
    }
    if (pastCodes.length > 0) {
      report += `• *Courses Tracked:* ${pastCodes.map((c) => `\`${c.toUpperCase()}\``).join(", ")}\n\n`;
    }

    // Group mistakes by course
    const byCourse = new Map<string, typeof userMistakes>();
    for (const m of userMistakes) {
      const c = (m.namespace || "General").toUpperCase();
      if (!byCourse.has(c)) byCourse.set(c, []);
      byCourse.get(c)!.push(m);
    }

    if (userMistakes.length === 0) {
      report += `✅ *No unresolved mistakes found on Walrus!* All past questions are either mastered or clean.\n`;
    } else {
      report += `⚠️ *Course-by-Course Weakness Breakdown:*\n`;
      for (const [code, mistakes] of byCourse.entries()) {
        report += `\n📚 *${code}* (${mistakes.length} active mistake${mistakes.length > 1 ? "s" : ""}):\n`;
        mistakes.slice(0, 3).forEach((m, idx) => {
          const streak = m.correctStreak || 0;
          const streakText = streak === 2 ? "🟢 2/3" : streak === 1 ? "🟡 1/3" : "🔴 0/3";
          const severityEmoji = m.severity === "high" ? "🔴" : m.severity === "medium" ? "🟡" : "🟢";
          report += `  ${idx + 1}. *${m.topic}* ${severityEmoji} [${streakText}]\n`;
          if (m.misconception) {
            const shortMisc = m.misconception.length > 80 ? `${m.misconception.slice(0, 80)}...` : m.misconception;
            report += `     _"${shortMisc}"_\n`;
          }
        });
        if (mistakes.length > 3) {
          report += `     _...and ${mistakes.length - 3} more in ${code}_\n`;
        }
      }
    }

    report += `\n━━━━━━━━━━━━━━━━━━━\n`;
    const defaultStudyCode = pastCodes[0]?.toUpperCase() || "ANA201";
    report += `🎯 _To drill a specific course, type /study <courseCode> (e.g. /study ${defaultStudyCode})!_`;

    await ctx.api.editMessageText(chatId, statusMsg.message_id, formatTelegramMarkdown(report), { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in executeBriefingAll:", error);
    await ctx.api.editMessageText(chatId, statusMsg.message_id, "⚠️ Failed to fetch global briefing from Walrus. Please try again later.");
  }
}
