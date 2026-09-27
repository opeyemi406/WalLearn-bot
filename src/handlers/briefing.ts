import { Context } from "grammy";
import { walrus } from "../walrus/client.js";
import { getUserSubject, getUserSubjectDisplay } from "../state.js";

export async function handleBriefing(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  const text = ctx.message?.text?.trim() || "";
  const parts = text.split(/\s+/);
  const explicitCourse = parts.length > 1 ? parts[1].trim() : null;

  const subjectCode = explicitCourse
    ? explicitCourse.toUpperCase().replace(/[^A-Z0-9]/g, "")
    : getUserSubject(chatId);
  const subjectDisplay = explicitCourse
    ? explicitCourse.toUpperCase()
    : getUserSubjectDisplay(chatId);

  const statusMsg = await ctx.reply(
    formatTelegramMarkdown(`🔍 _Querying Walrus Memory for ${subjectDisplay}..._`),
    { parse_mode: "Markdown" }
  );

  try {
    const briefing = await walrus.getWeaknessBriefing(subjectCode, chatId);
    const ledger = await walrus.getLedger(chatId);
    const factCount = ledger.filter(
      (r) =>
        r.chatId === chatId &&
        r.namespace?.toLowerCase() === subjectCode.toLowerCase() &&
        (r.recordType === "fact" || (r.misses || 0) === 0)
    ).length;

    if (briefing.weaknesses.length === 0) {
      let noMistakesMsg = `📊 *WalLearn Weakness Briefing*\nCourse: *${subjectDisplay}*\n\n✅ *Zero unresolved mistakes found on Walrus!* You haven't missed any questions in this course yet.\n`;
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
    report += `Course: *${subjectDisplay}* | Tracked Mistakes: *${briefing.total_mistakes}*\n`;
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

    report += `\n_Type /study to drill your weakest topics now!_`;

    await ctx.api.editMessageText(chatId, statusMsg.message_id, formatTelegramMarkdown(report), { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in handleBriefing:", error);
    await ctx.api.editMessageText(chatId, statusMsg.message_id, "⚠️ Failed to fetch briefing from Walrus. Please try again in a moment.");
  }
}
