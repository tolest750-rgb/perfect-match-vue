import type { ProcessedSlide } from './parser';
import { VAR_HINTS } from './prompts';
import { supabase } from '@/integrations/supabase/client';

// Cache the layout reference base64 so we only load it once
let layoutRefB64Cache: string | null = null;

async function getLayoutRefB64(): Promise<string> {
  if (layoutRefB64Cache) return layoutRefB64Cache;

  const res = await fetch(new URL('../assets/layout-reference.png', import.meta.url).href);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  layoutRefB64Cache = btoa(binary);
  return layoutRefB64Cache;
}

export async function callGemini(
  sl: ProcessedSlide,
  varIdx: number,
  faceB64: string,
): Promise<string | null> {
  // Stagger requests to avoid hitting rate limits
  if (varIdx > 0) {
    await new Promise(r => setTimeout(r, varIdx * 3000));
  }

  const layoutRefB64 = await getLayoutRefB64();

  const promptText = [
    sl.prompt.pos + VAR_HINTS[varIdx],
    '',
    'NEGATIVE — Strictly avoid the following in the generated image:',
    sl.prompt.neg,
  ]
    .filter(Boolean)
    .join('\n');

  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: {
      prompt: promptText,
      faceB64: faceB64 || undefined,
      layoutRefB64,
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
