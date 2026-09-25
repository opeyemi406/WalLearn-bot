import { Context } from "grammy";
import { parsePdfBuffer } from "../ai/slide-parser.js";
import { walrus } from "../walrus/client.js";
import { getUserSubject, sessions, QuizSession, Question } from "../state.js";
import { askAi } from "../ai/client.js";
import { buildQuizGeneratorPrompt } from "../ai/prompts.js";
import { sendQuestion } from "./quiz-helper.js";

export async function handleDocument(ctx: Context) {
  const chatId = ctx.chat?.id;
  const doc = ctx.message?.document;
  if (!chatId || !doc) return;

  const fileName = doc.file_name || "slides.pdf";
  const isPdf = fileName.toLowerCase().endsWith(".pdf") || doc.mime_type === "application/pdf";

  if (!isPdf) {
    await ctx.reply("📄 Please upload a PDF document (e.g. lecture slides, class notes, or past questions).");
    return;
  }

  const statusMsg = await ctx.reply(`📥 _Ingesting lecture slide: "${fileName}"..._`, { parse_mode: "Markdown" });

  try {
    // 1. Download file from Telegram
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const res = await fetch(fileUrl);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await ctx.api.editMessageText(chatId, statusMsg.message_id, `📖 _Parsing slide contents & recalling past weaknesses from Walrus..._`, {
      parse_mode: "Markdown",
    });

    // 2. Parse PDF text
    const slideText = await parsePdfBuffer(buffer);
    if (!slideText || slideText.length < 50) {
      await ctx.api.editMessageText(
        chatId,
        statusMsg.message_id,
        "⚠️ Could not extract sufficient text from this PDF. Please ensure it contains readable text rather than only scanned images."
      );
      return;
    }

    const subject = getUserSubject(chatId);

    // 3. Recall Walrus weaknesses to blend into the quiz
    const briefing = await walrus.getWeaknessBriefing(subject);

    await ctx.api.editMessageText(chatId, statusMsg.message_id, `🧠 _Generating 5 high-yield CBT questions grounded in your slides..._`, {
      parse_mode: "Markdown",
    });

    // 4. Generate questions with Gemini
    const prompt = buildQuizGeneratorPrompt(slideText, briefing, 5);
    const rawResponse = await askAi([
      { role: "system", content: "You are an expert exam question generator that outputs strict, valid JSON only." },
      { role: "user", content: prompt },
    ]);

    const cleanedJson = rawResponse.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanedJson);

    const questions: Question[] = parsed.questions;
    if (!questions || questions.length === 0) {
      throw new Error("No questions extracted from slide.");
    }

    // 5. Store session and start quiz
    const session: QuizSession = {
      subject,
      questions,
      currentIndex: 0,
      score: 0,
      startedAt: new Date(),
    };
    sessions.set(chatId, session);

    await ctx.api.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    await ctx.reply(`🎯 *Quiz Generated from "${fileName}"*\n_Grounded in slide content + your Walrus error history. Let's begin!_`, { parse_mode: "Markdown" });
    await sendQuestion(ctx, session);
  } catch (error) {
    console.error("Error in handleDocument:", error);
    await ctx.api.editMessageText(
      chatId,
      statusMsg.message_id,
      "⚠️ Failed to process slides. Please verify the PDF and try again."
    );
  }
}
