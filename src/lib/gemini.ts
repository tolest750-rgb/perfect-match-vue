import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";
import { loadApiConfig, getOrderedGeminiKeys, markKeyFailed } from "@/components/Sidebar";

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

  // ── Gemini keys em cascata ────────────────────────────────
  let cfg = loadApiConfig();
  const keys = getOrderedGeminiKeys(cfg);

  if (keys.length === 0) {
    throw new Error("Nenhuma Gemini Key configurada. " + "Adicione uma key em API_KEYS no painel lateral.");
  }

  for (const keyEntry of keys) {
    console.log(`[callGemini] Tentando Gemini key: ${keyEntry.name}`);

    const result = await supabase.functions.invoke("generate-image", {
      body: { prompt: promptText, faceB64: sendFace, geminiApiKey: keyEntry.key },
    });

    if (result.error) throw new Error(result.error.message || "Edge Function error");

    const data = result.data;

    // Sucesso
    if (data?.imageUrl) return data.imageUrl;

    // Erro de cota — marca key e tenta próxima
    if (data?.isQuotaError) {
      console.warn(`[callGemini] Key "${keyEntry.name}" sem cota, tentando próxima...`);
      cfg = markKeyFailed(cfg, keyEntry.id);
      continue;
    }

    // Erro definitivo (key inválida, etc)
    throw new Error(data?.error || `Gemini key "${keyEntry.name}": erro desconhecido`);
  }

  throw new Error(
    `Todas as ${keys.length} Gemini keys esgotadas. ` + "Aguarde renovação da cota ou adicione novas keys em API_KEYS.",
  );
}
