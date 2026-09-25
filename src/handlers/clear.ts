import { Context } from "grammy";
import { clearUserProfile } from "../state.js";

export async function handleClear(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Fully clear course profile, active quiz session, and pending slides
  clearUserProfile(chatId);

  const msg = `🧹 *Conversation & Active Course Cleared!*

Your active course, in-progress quizzes, and uploaded materials have been reset to a fresh clean slate.

━━━━━━━━━━━━━━━━━━━
📚 *Set Your New Course:*
Please reply with your *Course Code* and *Course Title by the side*, for example:
👉 \`BCH201 - General Biochemistry\`
👉 \`CSC302 - Operating Systems\`
👉 \`PCL301 - Clinical Pharmacokinetics\`

• Attach a lecture slide PDF anytime to generate a quiz specifically from your lecture notes!
━━━━━━━━━━━━━━━━━━━

_Reply with your course code & title or drop your slide PDF to begin fresh!_`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
  });
}
