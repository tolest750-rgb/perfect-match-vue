import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Lovable AI Gateway ────────────────────────────────────────
async function generateViaLovable(prompt: string, faceB64: string | undefined): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured in Supabase secrets");

  const content: any[] = [{ type: "text", text: prompt }];
  if (faceB64) {
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${faceB64}` } });
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-preview-image-generation",
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[generate-image] Lovable error ${response.status}:`, errText);
    if (response.status === 402 || response.status === 429) {
      // Sinaliza quota error com flag especial — frontend vai tentar Gemini
      throw { isQuotaError: true, message: `Lovable Gateway ${response.status}: sem créditos/cota.` };
    }
    throw new Error(`Lovable Gateway error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const parts = data.choices?.[0]?.message?.content;

  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part?.image_url?.url) return part.image_url.url;
      if (part?.inline_data?.data) {
        const mime = part.inline_data.mime_type ?? "image/png";
        return `data:${mime};base64,${part.inline_data.data}`;
      }
    }
  }
  const images = data.choices?.[0]?.message?.images;
  if (images?.[0]?.image_url?.url) return images[0].image_url.url;

  throw new Error("Lovable Gateway: nenhuma imagem na resposta.");
}

// ── Gemini API Direto ─────────────────────────────────────────
async function generateViaGemini(prompt: string, faceB64: string | undefined, apiKey: string): Promise<string> {
  const parts: any[] = [{ text: prompt }];
  if (faceB64) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: faceB64 } });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`,
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
      throw new Error("Gemini: API Key inválida ou sem permissão.");
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

  throw new Error("Gemini: nenhuma imagem na resposta.");
}

// ── Main ──────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, faceB64, provider, geminiApiKey } = await req.json();

    console.log(`[generate-image] provider=${provider ?? "lovable"} face=${!!faceB64}`);

    let imageUrl: string;

    if (provider === "gemini") {
      if (!geminiApiKey) throw new Error("Gemini API Key não enviada. Configure em API_KEYS no painel.");
      imageUrl = await generateViaGemini(prompt, faceB64, geminiApiKey);
    } else {
      imageUrl = await generateViaLovable(prompt, faceB64);
    }

    return new Response(JSON.stringify({ imageUrl }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    const isQuotaError = e?.isQuotaError === true;
    console.error("[generate-image] Error:", msg);

    // Retorna 200 com flag isQuotaError para o frontend poder fazer fallback
    // sem ser bloqueado pelo erro de rede do Supabase client
    return new Response(JSON.stringify({ error: msg, isQuotaError }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
