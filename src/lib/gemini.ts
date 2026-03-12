import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";

export async function callGemini(sl: ProcessedSlide, varIdx: number, faceB64: string): Promise<string | null> {
  if (varIdx > 0) {
    await new Promise((r) => setTimeout(r, varIdx * 3000));
  }

  const promptText = [
    sl.prompt.pos + VAR_HINTS[varIdx],
    "",
    "NEGATIVE — Strictly avoid the following in the generated image:",
    sl.prompt.neg,
  ]
    .filter(Boolean)
    .join("\n");

  const sendFace = sl.useFaceRef && faceB64 ? faceB64 : undefined;

  const result = await supabase.functions.invoke("generate-image", {
    body: { prompt: promptText, faceB64: sendFace },
  });

  if (result.error) throw new Error(result.error.message || "Edge Function error");

  const data = result.data;

  if (data?.imageUrl) return data.imageUrl;

  if (data?.isQuotaError) {
    throw new Error(data.error || "Rate limit exceeded");
  }

  throw new Error(data?.error || "Unknown error generating image");
}
