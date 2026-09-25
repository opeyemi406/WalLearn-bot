import OpenAI from "openai";
import { config } from "../config.js";

export const ai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: config.openRouterApiKey,
  defaultHeaders: {
    "HTTP-Referer": "https://wallearn.app",
    "X-Title": "WalLearn Study Bot",
  },
});

export async function askAi(messages: OpenAI.Chat.ChatCompletionMessageParam[], temperature = 0.4): Promise<string> {
  const response = await ai.chat.completions.create({
    model: config.aiModel,
    messages,
    temperature,
  });

  return response.choices[0]?.message?.content || "";
}
