import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Gemini API Direto ─────────────────────────────────────────
async function generateViaGemini(prompt: string, faceB64: string | undefined, apiKey: string): Promise<string> {
  const parts: any[] = [{ text: prompt }];
  if (faceB64) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: faceB64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[generate-image] Gemini error ${response.status}:`, errText);
    if (response.status === 429) {
      throw { isQuotaError: true, message: `Gemini 429: rate limit.` };
    }
    if (response.status === 401 || response.status === 403) {
      throw { isQuotaError: true, message: "Gemini: API Key inválida ou sem permissão." };
    }
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const outParts = data.candidates?.[0]?.content?.parts ?? [];

  for (const part of outParts) {
    if (part?.inline_data?.data) {
      const mime = part.inline_data.mime_type ?? "image/png";
      return `data:${mime};base64,${part.inline_data.data}`;
    }
  }

  throw new Error("Gemini: nenhuma imagem na resposta. Resposta: " + JSON.stringify(data).slice(0, 300));
}

// ── Main ──────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, faceB64, geminiApiKey } = await req.json();

    console.log(`[generate-image] face=${!!faceB64}`);

    if (!geminiApiKey) throw new Error("Gemini API Key não enviada. Configure em API_KEYS no painel.");

    const imageUrl = await generateViaGemini(prompt, faceB64, geminiApiKey);

    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    const isQuotaError = e?.isQuotaError === true;
    console.error("[generate-image] Error:", msg);

    return new Response(JSON.stringify({ error: msg, isQuotaError }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
