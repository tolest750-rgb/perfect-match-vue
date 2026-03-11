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

  // ── 1. Lovable Gateway (prioritário) ────────────────────────
  const lovableResult = await supabase.functions.invoke("generate-image", {
    body: { prompt: promptText, faceB64: sendFace, provider: "lovable" },
  });

  // Erro de rede/deploy — para aqui, não é problema de cota
  if (lovableResult.error) {
    throw new Error(lovableResult.error.message || "Edge Function error");
  }

  const lovableData = lovableResult.data;

  // Sucesso no Lovable
  if (lovableData?.imageUrl) return lovableData.imageUrl;

  // Se não é erro de cota, para aqui com o erro real
  if (!lovableData?.isQuotaError) {
    throw new Error(lovableData?.error || "Lovable Gateway: erro desconhecido");
  }

  // É erro de cota — tenta Gemini keys em cascata
  console.warn("[callGemini] Lovable sem créditos, tentando Gemini keys...");

  let cfg = loadApiConfig();
  const keys = getOrderedGeminiKeys(cfg);

  if (keys.length === 0) {
    throw new Error(
      "Lovable Gateway sem créditos e nenhuma Gemini Key configurada. " +
        "Adicione uma key em API_KEYS no painel lateral.",
    );
  }

  for (const keyEntry of keys) {
    console.log(`[callGemini] Tentando Gemini key: ${keyEntry.name}`);

    const result = await supabase.functions.invoke("generate-image", {
      body: { prompt: promptText, faceB64: sendFace, provider: "gemini", geminiApiKey: keyEntry.key },
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
    `Todas as keys esgotadas (Lovable + ${keys.length} Gemini). ` +
      "Aguarde renovação da cota ou adicione novas keys em API_KEYS.",
  );
}
