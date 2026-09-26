import { Context, InlineKeyboard } from "grammy";
import { sessions, QuizSession } from "../state.js";
import { walrus } from "../walrus/client.js";
import { config } from "../config.js";
import { sendQuestion } from "./quiz-helper.js";

export async function handleCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const chatId = ctx.chat?.id;
  if (!data || !chatId) return;

  await ctx.answerCallbackQuery().catch(() => {});

  if (data === "analyze_past_q") {
    const { handleAnalyze } = await import("./analyze.js");
    return handleAnalyze(ctx);
  }

  if (data === "upload_slides_direct") {
    const { awaitingSubject, hasUserSubject, getUserSubjectDisplay } = await import("../state.js");
    if (!hasUserSubject(chatId)) {
      awaitingSubject.add(chatId);
      await ctx.reply(
        `Please reply with your *Course Code & Title* (e.g. \`PCL301 - Evaluation of Drug Toxicity\`)`,
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.reply(
        `📂 *Lecture Slides for ${getUserSubjectDisplay(chatId)}*\n\nDo you have lecture slides for this course?\n• *If yes:* Upload your slide file (PDF, PPTX, Word) now to quiz directly from your material!\n• *If no:* Select an option below to start drilling immediately!`,
        {
          parse_mode: "Markdown",
          reply_markup: new InlineKeyboard()
            .text("⚡ 5 Questions", "start_quiz_5")
            .text("🎯 10 Questions", "start_quiz_10")
            .row()
            .text("🔥 20 Questions", "start_quiz_20"),
        }
      );
    }
    return;
  }

  if (data === "restore_prompt") {
    const { handleRestore } = await import("./restore.js");
    return handleRestore(ctx);
  }

  if (data === "restore_course_prompt") {
    const { awaitingRestoreCourse } = await import("../state.js");
    awaitingRestoreCourse.add(chatId);
    await ctx.reply(
      `📚 *Restore Specific Course*\n\nPlease reply with the course code you want to restore from Walrus (e.g. \`PCL301\`, \`CHM211\`, \`BIO101\`):`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "restore_all") {
    const { executeRestoreAll } = await import("./restore.js");
    return executeRestoreAll(ctx);
  }

  if (data.startsWith("start_quiz_")) {
    const count = parseInt(data.replace("start_quiz_", ""), 10) || 5;
    const { startQuizWithCount } = await import("./study.js");
    return startQuizWithCount(ctx, count);
  }

  if (data === "start_drill") {
    const { handleStudy } = await import("./study.js");
    return handleStudy(ctx);
  }

  if (data === "view_briefing") {
    const { handleBriefing } = await import("./briefing.js");
    return handleBriefing(ctx);
  }

  if (data === "change_subject") {
    const { awaitingSubject } = await import("../state.js");
    awaitingSubject.add(chatId);
    await ctx.reply(
      `📚 Please reply with your new *Course Code* and *Course Title by the side*, for example:\n👉 \`BCH201 - General Biochemistry\`\n👉 \`CSC302 - Operating Systems\`\n👉 \`PCL301 - Clinical Pharmacokinetics\`\n\n• Attach a lecture slide PDF anytime to generate a quiz specifically from your lecture notes!`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "upload_guide") {
    await ctx.reply(
      `📎 *How to Quiz from Your Slides:*\n\n1️⃣ Tap the 📎 attachment icon in Telegram.\n2️⃣ Select your lecture slide PDF or class notes.\n3️⃣ Send it to this chat!\n\nWalLearn will instantly extract the high-yield concepts and blend them with your Walrus mistake history to build a personalized exam drill.`,
      { parse_mode: "Markdown" }
    );
    return;
  }

  if (data === "main_menu") {
    const { handleStart } = await import("./start.js");
    return handleStart(ctx);
  }

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

  await evaluateAndRespondAnswer(ctx, qIndex, selectedOpt, session, false);
}

export async function evaluateAndRespondAnswer(
  ctx: Context,
  qIndex: number,
  selectedOpt: string,
  session: QuizSession,
  isTextReply = false
) {
  const q = session.questions[qIndex];
  if (!q) return;

  const isCorrect = selectedOpt.toUpperCase() === q.correct.toUpperCase();
  const explorerLink = `https://suiscan.xyz/mainnet/object/${config.walrusAccountId}`;

  if (isCorrect) {
    session.score++;
    const activeChatId = ctx.chat?.id;
    const recovery = await walrus.recordCorrectAnswer(q.topic, session.subject, activeChatId);

    let text = `✅ *CORRECT!*\n\n`;
    text += `*Your choice:* ${selectedOpt}. ${q.options[selectedOpt] || ""}\n\n`;
    text += `💡 *Key Concept:* ${q.fact}\n`;

    if (recovery.newlyMastered) {
      text += `\n━━━━━━━━━━━━━━━━━━━\n🏆 *TOPIC FULLY MASTERED (3/3 Passes)!* ⛓️\n`;
      text += `You have passed questions on \`${q.topic}\` 3 times in a row! This weakness is now officially resolved and graduated to your Mastered list on Walrus.\n`;
    } else if (recovery.streak > 0) {
      const remaining = 3 - recovery.streak;
      text += `\n━━━━━━━━━━━━━━━━━━━\n📈 *RECOVERY IN PROGRESS (${recovery.streak}/3 Passes)* 🎯\n`;
      text += `Great progress! You previously struggled with \`${q.topic}\`. Pass this topic ${remaining} more time${remaining > 1 ? "s" : ""} in future drills to achieve full mastery!\n`;
    }

    const keyboard = new InlineKeyboard().text("Next Question ➡️", "next_q");

    if (isTextReply) {
      await ctx.reply(text, { parse_mode: "Markdown", reply_markup: keyboard }).catch(() => {});
    } else {
      await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard }).catch(() => {});
    }
  } else {
    // Incorrect answer — trigger Walrus Memory write
    const misconception = q.traps?.[selectedOpt] || `Chose ${selectedOpt} instead of ${q.correct}`;

    let text = `❌ *INCORRECT*\n━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `• *Your Choice:* ${selectedOpt}. ${q.options[selectedOpt] || ""}\n`;
    text += `• *Correct Answer:* ${q.correct}. ${q.options[q.correct] || ""}\n\n`;
    text += `⚠️ *Misconception Diagnosis:*\n_${misconception}_\n\n`;
    text += `💡 *Flashcard Fact:*\n${q.fact}\n\n`;
    text += `━━━━━━━━━━━━━━━━━━━\n`;
    text += `🧠 *Walrus Mainnet Persistence:*\n`;
    text += `• *Topic:* \`${q.topic}\`\n`;
    text += `• *Status:* ⏳ Storing on Walrus Protocol...\n`;
    text += `• *On-Chain Account:* [View on Suiscan](${explorerLink})\n`;

    const keyboard = new InlineKeyboard().text("Next Question ➡️", "next_q");

    let sentMsg: any = null;
    if (isTextReply) {
      sentMsg = await ctx.reply(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }).catch(() => {});
    } else {
      await ctx.editMessageText(text, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      }).catch(() => {});
    }

    // Commit to Walrus Protocol concurrently in the background (user-isolated)
    const activeChatId = ctx.chat?.id;
    walrus.remember(
      {
        topic: q.topic,
        question: q.stem,
        my_error: `Chose option ${selectedOpt}: ${q.options[selectedOpt] || ""} (${misconception})`,
        correct: `${q.correct}. ${q.options[q.correct] || ""} — ${q.fact}`,
        severity: "high",
        misses: 1,
        chatId: activeChatId,
      },
      session.subject,
      activeChatId
    ).then((res) => {
      if (res.jobId) {
        const updatedText = text.replace(
          "• *Status:* ⏳ Storing on Walrus Protocol...",
          `• *Status:* ✅ Encrypted & Stored to Memory\n• *Job ID:* \`${res.jobId}\``
        );
        if (isTextReply && sentMsg && ctx.chat) {
          ctx.api.editMessageText(ctx.chat.id, sentMsg.message_id, updatedText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
            link_preview_options: { is_disabled: true },
          }).catch(() => {});
        } else {
          ctx.editMessageText(updatedText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
            link_preview_options: { is_disabled: true },
          }).catch(() => {});
        }
      }
    }).catch((err) => {
      console.error("Background remember write error:", err);
    });
  }
}
