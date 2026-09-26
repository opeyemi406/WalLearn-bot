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

export async function askAi(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  temperature = 0.4,
  jsonMode = false
): Promise<string> {
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: config.aiModel,
    messages,
    temperature,
  };

  if (jsonMode) {
    params.response_format = { type: "json_object" };
  }

  const response = await ai.chat.completions.create(params);
  return response.choices[0]?.message?.content || "";
}
