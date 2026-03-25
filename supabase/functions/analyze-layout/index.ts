import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK = { focusZone: "center", gradientStart: 0.42, gradientMaxOpacity: 0.82 };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { imageBase64, titulo, subtitulo, hasCta, fmt } = await req.json();

    const systemPrompt = `You are a world-class editorial art director. Analyze images to determine subject position and ideal text placement.

FOCUS ZONE: Identify where the MAIN SUBJECT (person, object, focal point) is located. Use a 3x3 grid:
- top-left | top-center | top-right
- center-left | center | center-right
- bottom-left | bottom-center | bottom-right

GRADIENT: Must cover the text zone sufficiently.
gradientMaxOpacity: minimum needed (prefer 0.65–0.82).
gradientStart: where the gradient begins (0=edge, 1=center, use 0.30–0.65).

Respond ONLY with valid JSON, no markdown.`;

    const userPrompt = `Analyze this ${fmt} image.
Title to overlay: "${titulo}"
Subtitle: "${subtitulo}"
Has CTA button: ${hasCta}

Return ONLY this JSON:
{
  "focusZone": "<top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right>",
  "gradientStart": <0.30-0.65>,
  "gradientMaxOpacity": <0.55-0.88>
}`;

    const model = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: userPrompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.error("[analyze-layout] Gemini error:", response.status);
      return new Response(JSON.stringify(FALLBACK), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = content.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = FALLBACK;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-layout] Error:", e);
    return new Response(JSON.stringify(FALLBACK), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
