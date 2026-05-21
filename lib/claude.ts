import Anthropic from "@anthropic-ai/sdk";

/**
 * Step 4 of the pipeline: the Claude analysis layer.
 *
 * `callClaude` returns plain text, or null when ANTHROPIC_API_KEY is missing
 * or the request fails. Callers always provide a deterministic fallback so the
 * product never hard-depends on the model being reachable.
 */

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export async function callClaude(
  system: string,
  user: string,
  maxTokens = 1600,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Extracts the first JSON object from a model response, tolerating prose / fences. */
export function extractJson<T>(text: string | null): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
