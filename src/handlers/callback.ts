import { Context, InlineKeyboard } from "grammy";
import { sessions } from "../state.js";
import { walrus } from "../walrus/client.js";
import { config } from "../config.js";
import { sendQuestion } from "./quiz-helper.js";

export async function handleCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const chatId = ctx.chat?.id;
  if (!data || !chatId) return;

  await ctx.answerCallbackQuery().catch(() => {});

  if (data.startsWith("next_q")) {
    const session = sessions.get(chatId);
    if (!session) {
      await ctx.reply("Session expired. Type /study to start a new quiz.");
      return;
    }
    session.currentIndex++;
    if (session.currentIndex < session.questions.length) {
      await sendQuestion(ctx, session);
    } else {
      // Quiz complete
      const total = session.questions.length;
      const score = session.score;
      const pct = Math.round((score / total) * 100);

      let summary = `🎉 *Quiz Complete!*\n`;
      summary += `Subject: *${session.subject.toUpperCase()}*\n`;
      summary += `• *Final Score:* ${score} / ${total} (${pct}%)\n`;
      summary += `• *Walrus Memory:* Any mistakes have been persisted to Walrus Protocol on-chain.\n\n`;
      summary += `Type /briefing to review your updated weaknesses, or /study to drill again!`;

      sessions.delete(chatId);
      await ctx.reply(summary, { parse_mode: "Markdown" });
    }
    return;
  }

  if (!data.startsWith("ans_")) return;

  const parts = data.split("_");
  const qIndex = parseInt(parts[1], 10);
  const selectedOpt = parts[2];

  const session = sessions.get(chatId);
  if (!session) {
    await ctx.reply("Session expired. Type /study to start a new quiz.");
    return;
  }

  const q = session.questions[qIndex];
  if (!q) return;

  const isCorrect = selectedOpt === q.correct;
  const explorerLink = `https://suiscan.xyz/mainnet/object/${config.walrusAccountId}`;

  if (isCorrect) {
    session.score++;
    let text = `✅ *CORRECT!*\n\n`;
    text += `*Your choice:* ${selectedOpt}. ${q.options[selectedOpt]}\n\n`;
    text += `💡 *Key Concept:* ${q.fact}\n`;

    const keyboard = new InlineKeyboard().text("Next Question ➡️", "next_q");

    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });
  } else {
    // Incorrect answer — trigger Walrus Memory write
    const misconception = q.traps?.[selectedOpt] || `Chose ${selectedOpt} instead of ${q.correct}`;

    // Write to Walrus immediately
    const rememberResult = await walrus.remember(
      {
        topic: q.topic,
        question: q.stem,
        my_error: `Chose option ${selectedOpt}: ${q.options[selectedOpt]} (${misconception})`,
        correct: `${q.correct}. ${q.options[q.correct]} — ${q.fact}`,
        severity: "high",
        misses: 1,
      },
      session.subject
    );

    let text = `❌ *INCORRECT*\n━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `• *Your Choice:* ${selectedOpt}. ${q.options[selectedOpt]}\n`;
    text += `• *Correct Answer:* ${q.correct}. ${q.options[q.correct]}\n\n`;
    text += `⚠️ *Misconception Diagnosis:*\n_${misconception}_\n\n`;
    text += `💡 *Flashcard Fact:*\n${q.fact}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `🧠 *Persisted to Walrus Mainnet:*\n`;
    text += `• *Topic:* \`${q.topic}\`\n`;
    text += `• *Status:* ✅ Encrypted & Stored to Memory\n`;
    if (rememberResult.jobId) {
      text += `• *Job ID:* \`${rememberResult.jobId}\`\n`;
    }
    text += `• *On-Chain Account:* [View on Suiscan](${explorerLink})\n`;

    const keyboard = new InlineKeyboard().text("Next Question ➡️", "next_q");

    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  }
}
