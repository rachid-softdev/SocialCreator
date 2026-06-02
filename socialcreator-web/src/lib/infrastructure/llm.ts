import Anthropic from "@anthropic-ai/sdk";
import logger from "@/lib/logger";
import { withRetry } from "@/lib/retry";

const ANTHROPIC_TIMEOUT_MS = 60_000; // 60 seconds

const claude = new Anthropic({
  timeout: ANTHROPIC_TIMEOUT_MS,
});

export interface GenerationResult {
  textContent: string;
  hashtags: string[];
  hook?: string;
}

export async function generateContent(
  systemPrompt: string,
  userPrompt: string,
): Promise<GenerationResult> {
  const msg = await withRetry(
    () =>
      claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        temperature: 0.8,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    {
      maxAttempts: 3,
      baseDelayMs: 2000,
      retryOn: (error) => {
        const status = (error as any).status;
        return status === 429 || (status >= 500 && status < 600);
      },
    },
  );

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";

  // Parse JSON response
  try {
    // Remove markdown code blocks if present
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error("Failed to parse Claude response as JSON");
  }
}
