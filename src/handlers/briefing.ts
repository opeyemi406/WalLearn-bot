import { Context } from "grammy";
import { walrus } from "../walrus/client.js";
import { getUserSubject, getUserSubjectDisplay } from "../state.js";

export async function handleBriefing(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const subjectCode = getUserSubject(chatId);
  const subjectDisplay = getUserSubjectDisplay(chatId);
  const statusMsg = await ctx.reply(`🔍 _Querying Walrus Memory for ${subjectDisplay}..._`, { parse_mode: "Markdown" });

  try {
    const briefing = await walrus.getWeaknessBriefing(subjectCode);

    if (briefing.weaknesses.length === 0) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        `📊 *WalLearn Weakness Briefing*\nCourse: *${subjectDisplay}*\n\n✅ *Zero unresolved mistakes found on Walrus!* You either haven't missed any questions yet, or you've mastered them all.\n\nSend a lecture slide PDF or type /study to test yourself.`,
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
      if (w.misconception) {
        report += `• *Past Error:* _"${w.misconception}"_\n`;
      }
      if (w.correct_fact) {
        report += `• *Core Fact:* ${w.correct_fact}\n`;
      }
    });

    if (briefing.mastered.length > 0) {
      report += `\n━━━━━━━━━━━━━━━━━━━\n`;
      report += `🏆 *Mastered Topics (3+ Correct Streaks):*\n`;
      briefing.mastered.forEach((m) => {
        report += `• ${m} ✅\n`;
      });
    }

    report += `\n_Type /study to drill your weakest topics now!_`;

    await ctx.api.editMessageText(chatId, statusMsg.message_id, report, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error in handleBriefing:", error);
    await ctx.api.editMessageText(chatId, statusMsg.message_id, "⚠️ Failed to fetch briefing from Walrus. Please try again in a moment.");
  }
}
