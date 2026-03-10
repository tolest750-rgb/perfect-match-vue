import type { ProcessedSlide } from './parser';
import { VAR_HINTS } from './prompts';
import { supabase } from '@/integrations/supabase/client';

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
    await new Promise(r => setTimeout(r, varIdx * 3000));
  }

  const promptText = [
    sl.prompt.pos + VAR_HINTS[varIdx],
    '',
    'NEGATIVE — Strictly avoid the following in the generated image:',
    sl.prompt.neg,
    '',
    faceB64
      ? '[FACE REFERENCE IMAGE is attached — use ONLY for facial identity extraction, NOT for scene composition]'
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: {
      prompt: promptText,
      faceB64: faceB64 || undefined,
    },
  });

  if (error) {
    throw new Error(error.message || 'Edge function error');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  if (data?.imageUrl) {
    return data.imageUrl;
  }

  throw new Error('No image in API response.');
}
