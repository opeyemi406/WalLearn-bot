import { Context, InlineKeyboard } from "grammy";
import { QuizSession } from "../state.js";

export async function sendQuestion(ctx: Context, session: QuizSession) {
  const q = session.questions[session.currentIndex];
  if (!q) return;

  const total = session.questions.length;
  const current = session.currentIndex + 1;

  const cleanTopic = (q.topic || "").replace(/[*_`]/g, "").trim();
  const cleanStem = (q.stem || "").replace(/[*#]/g, "").trim();

  let text = `📖 *${session.subject.toUpperCase()} · Question ${current} of ${total}* [CBT Mode]\n`;
  text += `🎯 *Topic:* _${cleanTopic}_\n`;
  text += `━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `*${cleanStem}*\n\n`;

  const optKeys = Object.keys(q.options).sort();
  for (const key of optKeys) {
    const cleanOpt = (q.options[key] || "").replace(/[*#]/g, "").trim();
    text += `*${key}.* ${cleanOpt}\n`;
  }

  text += `\n_Tap your answer below:_`;

  const keyboard = new InlineKeyboard()
    .text("A", `ans_${session.currentIndex}_A`)
    .text("B", `ans_${session.currentIndex}_B`)
    .row()
    .text("C", `ans_${session.currentIndex}_C`)
    .text("D", `ans_${session.currentIndex}_D`);

  const { formatTelegramMarkdown } = await import("../utils/telegram-format.js");

  const sent = await ctx.reply(formatTelegramMarkdown(text), {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });

  session.messageId = sent.message_id;
}
