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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { prompt, faceB64 } = await req.json();

    console.log(`[generate-image] face=${!!faceB64}`);

    // Build parts array for Gemini native format
    const parts: any[] = [{ text: prompt }];
    if (faceB64) {
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: faceB64 },
      });
    }

    const model = "gemini-2.5-flash-image";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[generate-image] Gemini error ${response.status}:`, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly.", isQuotaError: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json();

    // Extract image from Gemini native response
    const candidates = data.candidates;
    if (candidates && candidates.length > 0) {
      const parts2 = candidates[0].content?.parts || [];
      for (const part of parts2) {
        if (part.inlineData) {
          const mime = part.inlineData.mimeType || "image/png";
          const b64 = part.inlineData.data;
          const imageUrl = `data:${mime};base64,${b64}`;
          return new Response(JSON.stringify({ imageUrl }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    throw new Error("No image in Gemini response. Response: " + JSON.stringify(data).slice(0, 300));
  } catch (e: any) {
    const msg = e?.message ?? "Unknown error";
    console.error("[generate-image] Error:", msg);

    return new Response(JSON.stringify({ error: msg, isQuotaError: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
