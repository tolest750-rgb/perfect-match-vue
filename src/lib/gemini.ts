import type { ProcessedSlide } from './parser';
import { VAR_HINTS } from './prompts';

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await fetch(url, options);
    if (resp.status === 429 && attempt < maxRetries) {
      const retryAfter = Math.min(30, Math.pow(2, attempt + 1) * 5 + Math.random() * 5);
      console.warn(`[Gemini] Rate limited, retrying in ${retryAfter.toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }
    return resp;
  }
  throw new Error('Max retries exceeded');
}

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

  // Stagger requests to avoid hitting rate limits
  if (varIdx > 0) {
    await new Promise(r => setTimeout(r, varIdx * 8000));
  }

  const MODEL = 'gemini-3-pro-image-preview';
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const parts: any[] = [];

  const promptText = [
    sl.prompt.pos + VAR_HINTS[varIdx],
    '',
    'NEGATIVE — Strictly avoid the following in the generated image:',
    sl.prompt.neg,
  ].join('\n');

  parts.push({ text: promptText });

  if (faceB64) {
    parts.push({ text: '[FACE REFERENCE IMAGE BELOW — use ONLY for facial identity extraction, NOT for scene composition]' });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: faceB64 } });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  };

  const resp = await fetchWithRetry(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || 'HTTP ' + resp.status);
  }

  const data = await resp.json();
  const respParts = data.candidates?.[0]?.content?.parts || [];
  for (const part of respParts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    if (part.fileData?.fileUri) return part.fileData.fileUri;
  }

  throw new Error('No image in API response.');
}
