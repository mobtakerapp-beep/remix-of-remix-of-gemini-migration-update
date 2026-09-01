import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function createLovableAiGatewayProvider(apiKey: string) {
  // الاتصال المباشر بجوجل جيميناي المجاني بدون بوابة Lovable المدفوعة
  return createGoogleGenerativeAI({
    apiKey: apiKey || process.env.GEMINI_API_KEY,
  });
}
