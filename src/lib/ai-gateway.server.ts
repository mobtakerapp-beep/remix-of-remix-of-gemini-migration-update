import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getRuntimeSecret } from "./runtime-env.server";

export function createLovableAiGatewayProvider(
  provider: "gemini" | "groq" | "openrouter" = "gemini",
  apiKey?: string
) {
  let secretKey = apiKey;
  let baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
  let name = "google-gemini";

  if (provider === "groq") {
    secretKey = secretKey || getRuntimeSecret('GROQ_API_KEY') || "";
    baseURL = "https://api.groq.com/openai/v1";
    name = "groq";
  } else if (provider === "openrouter") {
    secretKey = secretKey || getRuntimeSecret('OPENROUTER_API_KEY') || "";
    baseURL = "https://openrouter.ai/api/v1";
    name = "openrouter";
  } else {
    secretKey = secretKey || getRuntimeSecret('GEMINI_API_KEY') || "";
  }

  return createOpenAICompatible({
    name,
    baseURL,
    apiKey: secretKey,
  });
}
