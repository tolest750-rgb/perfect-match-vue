import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
              {
                type: "text",
                text: `Analyze this ${fmt} image.
Title to overlay: "${titulo}"
Subtitle: "${subtitulo}"
Has CTA button: ${hasCta}

Return ONLY this JSON:
{
  "focusZone": "<top-left|top-center|top-right|center-left|center|center-right|bottom-left|bottom-center|bottom-right>",
  "gradientStart": <0.30-0.65>,
  "gradientMaxOpacity": <0.55-0.88>
}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[analyze-layout] Gateway error:", response.status);
      return new Response(JSON.stringify({ focusZone: "center", gradientStart: 0.42, gradientMaxOpacity: 0.82 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawText = await response.text();
    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return new Response(JSON.stringify({ focusZone: "center", gradientStart: 0.42, gradientMaxOpacity: 0.82 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content || "";
    const clean = content.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { focusZone: "center", gradientStart: 0.42, gradientMaxOpacity: 0.82 };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-layout] Error:", e);
    return new Response(JSON.stringify({ focusZone: "center", gradientStart: 0.42, gradientMaxOpacity: 0.82 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
