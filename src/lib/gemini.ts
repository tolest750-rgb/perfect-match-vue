import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";

export async function callGemini(sl: ProcessedSlide, varIdx: number, faceB64: string, layoutRefB64: string): Promise<string | null> {
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

  // Only send faceB64 when the slide actually needs face reference
  const sendFace = sl.useFaceRef && faceB64 ? faceB64 : undefined;
  const sendLayoutRef = layoutRefB64 || undefined;

  const { data, error } = await supabase.functions.invoke("generate-image", {
    body: {
      prompt: promptText,
      faceB64: sendFace,
      layoutRefB64: sendLayoutRef,
    },
  });

  if (error) {
    throw new Error(error.message || "Edge function error");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (data?.imageUrl) {
    return data.imageUrl;
  }

  throw new Error("No image in API response.");
}
