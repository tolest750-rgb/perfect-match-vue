import type { ProcessedSlide } from './parser';
import { VAR_HINTS } from './prompts';

export async function callGemini(
  sl: ProcessedSlide,
  varIdx: number,
  apiKey: string,
  faceB64: string,
  demo: boolean
): Promise<string | null> {
  if (demo) {
    await new Promise(r => setTimeout(r, 500 + varIdx * 150 + Math.random() * 500));
    return null;
  }

  const MODEL = 'gemini-3-pro-image-preview';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'image/jpeg', data: faceB64 } },
        { text: sl.prompt.pos + VAR_HINTS[varIdx] },
      ]
    }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: sl.fmt, resolution: sl.res, numberOfImages: 1 },
      negativePrompt: sl.prompt.neg,
    },
  };

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(150000),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'HTTP ' + resp.status);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    if (part.fileData?.fileUri) return part.fileData.fileUri;
  }

  throw new Error('No image in API response.');
}
