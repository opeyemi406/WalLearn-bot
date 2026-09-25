import { Context } from "grammy";
import { walrus } from "../walrus/client.js";
import { getUserSubject, sessions, QuizSession, Question } from "../state.js";
import { askAi } from "../ai/client.js";
import { buildQuizGeneratorPrompt } from "../ai/prompts.js";
import { sendQuestion } from "./quiz-helper.js";

export async function handleStudy(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const subject = getUserSubject(chatId);
  const statusMsg = await ctx.reply(`🧠 _Recalling your past mistakes from Walrus for ${subject.toUpperCase()}..._`, {
    parse_mode: "Markdown",
  });

  try {
    // 1. Cold recall weakness briefing from Walrus
    const briefing = await walrus.getWeaknessBriefing(subject);

    let briefingNotice = `🎯 *Starting Study Session: ${subject.toUpperCase()}*\n`;
    if (briefing.weaknesses.length > 0) {
      briefingNotice += `_Recalled ${briefing.weaknesses.length} active weak topics from Walrus. Applying 60/30/10 drill ratio..._\n`;
    } else {
      briefingNotice += `_No prior mistakes found on Walrus. Generating foundational CBT questions..._\n`;
    }

    await ctx.api.editMessageText(chatId, statusMsg.message_id, briefingNotice + "\n⏳ _Generating CBT questions via Gemini 3.5 Flash..._", {
      parse_mode: "Markdown",
    });

    // 2. Call Gemini to generate questions
    const prompt = buildQuizGeneratorPrompt(
      `Core curriculum and past question benchmarks for university level ${subject}.`,
      briefing,
      5
    );

    const rawResponse = await askAi([
      { role: "system", content: "You are an expert exam question generator that outputs strict, valid JSON only." },
      { role: "user", content: prompt },
    ]);

    // Clean JSON response (strip markdown wrappers if present)
    const cleanedJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    const questions: Question[] = parsed.questions;
    if (!questions || questions.length === 0) {
      throw new Error("No questions parsed from AI response.");
    }

    // 3. Initialize session
    const session: QuizSession = {
      subject,
      questions,
      currentIndex: 0,
      score: 0,
      startedAt: new Date(),
    };
    sessions.set(chatId, session);

    // 4. Send first question
    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    await sendQuestion(ctx, session);
  } catch (error) {
    console.error("Error in handleStudy:", error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      "⚠️ Failed to generate quiz. Please try again with /study."
    );
  }
}
