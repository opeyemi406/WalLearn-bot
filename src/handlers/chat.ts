import { Context } from "grammy";
import { walrus } from "../walrus/client.js";
import { getUserSubject } from "../state.js";
import { askAi } from "../ai/client.js";
import { buildTutorPrompt } from "../ai/prompts.js";

export async function handleChatMessage(ctx: Context) {
  const chatId = ctx.chat?.id;
  const text = ctx.message?.text;
  if (!chatId || !text) return;

  // Skip commands
  if (text.startsWith("/")) return;

  const subject = getUserSubject(chatId);
  await ctx.replyWithChatAction("typing");

  try {
    // 1. Cold recall memories related to the user's message & subject
    const memories = await walrus.recall(`${text} in ${subject}`, subject);

    // 2. Build tutor prompt with past mistakes context
    const prompt = buildTutorPrompt(text, memories);

    // 3. Ask Gemini
    const response = await askAi([
      { role: "system", content: "You are WalLearn, an honest, direct, academic study tutor holding the student accountable to their past mistake history." },
      { role: "user", content: prompt },
    ]);

    await ctx.reply(response, { parse_mode: "Markdown" }).catch(async () => {
      // Fallback if markdown parsing fails
      await ctx.reply(response);
    });
  } catch (error) {
    console.error("Error in handleChatMessage:", error);
    await ctx.reply("⚠️ Sorry, I encountered an error processing your question. Please try again.");
  }
}
