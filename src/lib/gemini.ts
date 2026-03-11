import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";
import { loadApiConfig, getOrderedGeminiKeys, markKeyFailed } from "@/components/Sidebar";

const QUOTA_ERRORS = [
  "créditos insuficientes",
  "not enough credits",
  "payment required",
  "quota exceeded",
  "rate limit",
  "429",
  "402",
];
function isQuotaError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return QUOTA_ERRORS.some((e) => lower.includes(e));
}

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
  try {
    const { data, error } = await supabase.functions.invoke("generate-image", {
      body: { prompt: promptText, faceB64: sendFace, provider: "lovable" },
    });
    if (!error && !data?.error && data?.imageUrl) return data.imageUrl;
    const errMsg = error?.message ?? data?.error ?? "";
    if (!isQuotaError(errMsg)) throw new Error(errMsg || "Lovable Gateway: erro desconhecido");
    console.warn("[callGemini] Lovable sem créditos, tentando Gemini keys...");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isQuotaError(msg)) throw e;
    console.warn("[callGemini] Lovable falhou por cota:", msg);
  }

  // ── 2. Gemini keys em cascata ────────────────────────────────
  let cfg = loadApiConfig();
  const keys = getOrderedGeminiKeys(cfg);

  if (keys.length === 0) {
    throw new Error(
      "Lovable Gateway sem créditos e nenhuma Gemini Key configurada. " +
        "Adicione uma key em API_KEYS no painel lateral.",
    );
  }

  for (const keyEntry of keys) {
    try {
      console.log(`[callGemini] Tentando Gemini key: ${keyEntry.name}`);
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { prompt: promptText, faceB64: sendFace, provider: "gemini", geminiApiKey: keyEntry.key },
      });
      if (!error && !data?.error && data?.imageUrl) return data.imageUrl;
      const errMsg = error?.message ?? data?.error ?? "";
      if (isQuotaError(errMsg)) {
        console.warn(`[callGemini] Key "${keyEntry.name}" sem cota, tentando próxima...`);
        cfg = markKeyFailed(cfg, keyEntry.id);
        continue;
      }
      throw new Error(errMsg || `Gemini key "${keyEntry.name}": erro desconhecido`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isQuotaError(msg)) {
        cfg = markKeyFailed(cfg, keyEntry.id);
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    `Todas as keys esgotadas (Lovable + ${keys.length} Gemini). ` +
      "Aguarde renovação da cota ou adicione novas keys em API_KEYS.",
  );
}
