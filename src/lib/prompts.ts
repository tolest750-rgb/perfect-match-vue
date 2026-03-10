import type { SlideData, StyleKey, LightKey, FormatKey, LayoutPosition } from "./parser";

// ─── STYLE PRESETS ────────────────────────────────────────────
const STYLES: Record<StyleKey, string> = {
  cinematic:
    "ultra-realistic cinematic portrait photography, 85mm prime lens f/1.8, natural film grain, Hollywood color grading, photorealistic",
  corporate:
    "professional editorial portrait photography, studio strobe lighting, luxury business magazine aesthetic, photorealistic",
  futuristic:
    "hyper-realistic sci-fi portrait, futuristic neon practical lights, cyberpunk art direction, photorealistic",
  editorial:
    "high-end editorial portrait photography, Vogue-quality lighting, sophisticated composition, photorealistic",
};

const LIGHTS: Record<LightKey, string> = {
  dramatic:
    "electric blue key light from camera left, cool desaturated shadows, neon blue rim light, dark cinematic background",
  warm: "warm amber golden key light, rich warm shadows, luxury gold color grade, very dark warm background",
  green: "neon lime-green rim light, cyberpunk green ambient glow, high contrast dark background",
  moody: "single Rembrandt key light, deep chiaroscuro shadows, noir palette, dramatic contrast",
};

const NEG =
  "text, typography, letters, words, watermark, logo, overlay text, speech bubbles, cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed";

export const VAR_HINTS = [
  "",
  ", slightly different camera angle, subtle lighting variation",
  ", alternative composition, different atmospheric depth",
  ", unique creative framing, slightly different light mood",
];

// ─── PERSON DETECTION ─────────────────────────────────────────
const PERSON_KEYWORDS = [
  'pessoa', 'homem', 'mulher', 'menino', 'menina', 'criança',
  'executivo', 'empresário', 'empresária', 'líder', 'atleta',
  'médico', 'profissional', 'founder', 'ceo', 'palestrante',
  'especialista', 'autor', 'coach', 'ele', 'ela',
  'person', 'man', 'woman', 'boy', 'girl', 'human', 'speaker', 'expert',
];

// Keywords that suggest person is on the left side of the scene
const PERSON_LEFT_HINTS = [
  'segurando', 'holding', 'carregando', 'carrying', 'caixa', 'box',
  'microfone', 'microphone', 'perfil', 'profile', 'olhando para direita',
];

// Keywords that suggest person is on the right side
const PERSON_RIGHT_HINTS = [
  'computador', 'laptop', 'notebook', 'tela', 'screen', 'trabalhando',
  'digitando', 'typing', 'mesa', 'desk',
];

// Keywords for abstract/object scenes (no person)
const ABSTRACT_KEYWORDS = [
  'número', 'number', 'texto 3d', '3d text', 'gráfico', 'chart',
  'estatística', 'dados', 'data', 'ícone', 'icon', 'símbolo',
  'abstract', 'abstrato', 'conceitual', 'conceptual',
];

// Keywords for scene/environment shots
const SCENE_KEYWORDS = [
  'estrada', 'road', 'cidade', 'city', 'paisagem', 'landscape',
  'escritório', 'office', 'palco', 'stage', 'evento', 'event',
  'plateia', 'audience', 'grupo', 'group', 'equipe', 'team',
  'multidão', 'crowd', 'reunião', 'meeting',
];

function visualHasPerson(visual: string): boolean {
  const v = (visual ?? '').toLowerCase();
  return PERSON_KEYWORDS.some(kw => v.includes(kw));
}

function hasKeywords(visual: string, keywords: string[]): boolean {
  const v = (visual ?? '').toLowerCase();
  return keywords.some(kw => v.includes(kw));
}

// ─── LAYOUT POSITION DETECTION ────────────────────────────────
/**
 * Analyzes the VISUAL description to determine the optimal
 * text placement position on the slide.
 * 
 * Patterns (inspired by real carousel references):
 * - Person on left → text right
 * - Person on right / at computer → text left
 * - Person centered / group photo → text bottom-center
 * - Abstract / 3D element → text bottom-center or center
 * - Scene / environment → text bottom-left
 * - No clear subject → text top-center
 */
export function detectLayoutPosition(
  sl: SlideData,
  slideIndex: number,
  totalSlides: number
): LayoutPosition {
  const visual = (sl.visual ?? '').toLowerCase();
  const hasPerson = visualHasPerson(visual);
  const isAbstract = hasKeywords(visual, ABSTRACT_KEYWORDS);
  const isScene = hasKeywords(visual, SCENE_KEYWORDS);
  const hasPersonLeft = hasKeywords(visual, PERSON_LEFT_HINTS);
  const hasPersonRight = hasKeywords(visual, PERSON_RIGHT_HINTS);
  const hasLongSubtitle = (sl.subtitulo?.length ?? 0) > 100;

  // Abstract / 3D visual elements → center or bottom-center
  if (isAbstract && !hasPerson) {
    return 'bottom-center';
  }

  // Group scenes / events → bottom-center (photo takes top half)
  if (isScene && !hasPerson) {
    return hasLongSubtitle ? 'split-bottom' : 'bottom-center';
  }

  // Person with directional hints
  if (hasPerson) {
    if (hasPersonLeft) return 'right';
    if (hasPersonRight) return 'left';
    
    // Alternate between layouts for variety in multi-slide carousels
    const posInCarousel = slideIndex % totalSlides;
    if (posInCarousel === 0) return 'right';       // First slide: person left, text right (like ref slide 1)
    if (posInCarousel % 3 === 0) return 'left';     // Every 3rd: text left
    if (posInCarousel % 2 === 0) return 'top-center'; // Even: text top (like ref slides 3, 5)
    return 'bottom-left';
  }

  // Long subtitle with no person → split layout
  if (hasLongSubtitle) return 'split-bottom';

  // Default: bottom-left
  return 'bottom-left';
}

// ─── BUILD PROMPT ─────────────────────────────────────────────
export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
  layoutPos: LayoutPosition,
  options?: { useFaceRef?: boolean }
) {
  const useFace = options?.useFaceRef ?? false;

  const faceInstruction = useFace
    ? [
        'FACE REFERENCE IMAGE ATTACHED:',
        'Use the face reference photo ONLY to extract facial identity (face shape, eyes, skin tone, nose, lips, jawline, brow, hair).',
        'DO NOT copy the reference background, clothing, pose, or lighting.',
        'Generate a completely new photograph of this same person FROM SCRATCH in the scene below.',
      ].join(' ')
    : '';

  const fmtHint: Record<FormatKey, string> = {
    "4:5": "vertical 4:5 portrait format (1080×1350px)",
    "9:16": "vertical 9:16 tall format (1080×1920px)",
    "1:1": "square 1:1 format (1080×1080px)",
  };

  const pos = [
    "LAYOUT REFERENCE IMAGE ATTACHED:",
    "A LAYOUT REFERENCE image is provided showing the exact visual style, composition, text zones, and dark gradient areas to replicate.",
    "Study the reference carefully and reproduce the same composition balance, subject placement, and clean/dark zones for text overlay.",
    "DO NOT generate any text, typography, letters, or words in the image — only the photographic scene.",
    "",
    useFace ? faceInstruction : '',
    "",
    "SCENE DESCRIPTION:",
    fmtHint[fmt],
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    "",
    "QUALITY:",
    "professional commercial photography, dramatic atmospheric depth, cinematic bokeh, subject in sharp focus, dark rich background, high production value",
  ]
    .filter((s) => s !== undefined && s !== null)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  return { pos, neg: NEG };
}

// ─── BUILD LAYOUT (for the compositor) ────────────────────────
export function buildLayout(sl: SlideData, light: LightKey, fmt: FormatKey, layoutPos: LayoutPosition) {
  const ACC: Record<LightKey, string> = {
    dramatic: '#00b4ff',
    warm:     '#f5c842',
    green:    '#c8ff00',
    moody:    '#ffffff',
  };
  const accent = ACC[light];

  return { accent, layoutPos, slideNum: sl.num, titulo: sl.titulo, subtitulo: sl.subtitulo, cta: sl.cta };
}
