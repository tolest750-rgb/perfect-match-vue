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

// ─── COMPOSITION INSTRUCTIONS PER LAYOUT ──────────────────────
function getCompositionInstruction(pos: LayoutPosition, fmt: FormatKey): string {
  const instructions: Record<LayoutPosition, string> = {
    'bottom-left': [
      "COMPOSITION: Subject positioned in the UPPER 50% of the frame.",
      "The LOWER 45% must be a clean dark gradient area — NO objects, NO details.",
      "This lower zone is reserved exclusively for text overlay.",
      "Subject should be slightly off-center to the right.",
    ].join('\n'),
    
    'bottom-center': [
      "COMPOSITION: Main visual element positioned in the UPPER 55% of the frame, centered.",
      "The LOWER 40% must be a smooth dark gradient with NO scene elements.",
      "This bottom zone is strictly reserved for centered text overlay.",
      "The visual should have a natural dark falloff toward the bottom.",
    ].join('\n'),
    
    'right': [
      "COMPOSITION: Subject positioned on the LEFT 50% of the frame.",
      "The RIGHT 45% should be relatively dark or have dark atmospheric depth.",
      "This right zone is reserved for text overlay — keep it clean and readable.",
      "Subject should face slightly toward the right/camera.",
      "Use dark vignetting on the right side.",
    ].join('\n'),
    
    'left': [
      "COMPOSITION: Subject positioned on the RIGHT 50% of the frame.",
      "The LEFT 45% should be dark or have deep atmospheric shadows.",
      "This left zone is reserved for text overlay — keep it uncluttered.",
      "Dark vignetting on the left side for text readability.",
    ].join('\n'),
    
    'top-center': [
      "COMPOSITION: Subject positioned in the LOWER 55% of the frame.",
      "The UPPER 40% must have dark atmosphere or clean dark space.",
      "This upper zone is reserved for bold text overlay.",
      "Subject placed from center to bottom, looking upward or forward.",
      "Natural dark falloff toward the top of the frame.",
    ].join('\n'),
    
    'center': [
      "COMPOSITION: Dark atmospheric background throughout.",
      "Main visual element can be centered but subtle.",
      "The entire frame should support text overlay with good contrast.",
      "Deep, moody, minimal background with cinematic depth.",
    ].join('\n'),
    
    'split-bottom': [
      "COMPOSITION: Scene/visual fills the UPPER 55% of the frame.",
      "The LOWER 45% must be a clean dark gradient — this is the text zone.",
      "The transition from scene to dark should be smooth and cinematic.",
      "Bottom area needs to support a two-column text layout.",
    ].join('\n'),
  };
  
  const fmtHint: Record<FormatKey, string> = {
    "4:5": "vertical 4:5 portrait format (1080×1350px)",
    "9:16": "vertical 9:16 tall format (1080×1920px)",
    "1:1": "square 1:1 format (1080×1080px)",
  };

  return `${fmtHint[fmt]}\n${instructions[pos]}`;
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
  const hasPerson = options?.useFaceRef ?? visualHasPerson(sl.visual ?? '');

  const faceInstruction = hasPerson
    ? [
        'FACE REFERENCE IMAGE ATTACHED:',
        'Use the face reference photo ONLY to extract facial identity (face shape, eyes, skin tone, nose, lips, jawline, brow, hair).',
        'DO NOT copy the reference background, clothing, pose, or lighting.',
        'Generate a completely new photograph of this same person FROM SCRATCH in the scene below.',
      ].join(' ')
    : '';

  const compositionInstruction = getCompositionInstruction(layoutPos, fmt);

  const pos = [
    "LAYOUT REFERENCE IMAGE ATTACHED:",
    "A LAYOUT REFERENCE image is provided showing the exact visual style to follow.",
    "Study the reference for: text positioning zones, dark gradient areas, subject placement, and overall composition balance.",
    "The generated image must leave identical clean/dark zones for text overlay as shown in the reference.",
    "DO NOT generate any text, typography, letters, or words in the image — only the photographic scene.",
    "",
    faceInstruction,
    "",
    "SCENE DESCRIPTION:",
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    "",
    "COMPOSITION RULES:",
    compositionInstruction,
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

function buildTextElementsHint(sl: SlideData, pos: LayoutPosition): string {
  const textElements: string[] = [];
  if (sl.titulo) textElements.push(`a large bold title`);
  if (sl.subtitulo) textElements.push("a subtitle paragraph");
  if (sl.cta) textElements.push("a call-to-action button");
  
  if (!textElements.length) return "";

  const zoneMap: Record<LayoutPosition, string> = {
    'bottom-left': "the bottom-left 45% of the frame",
    'bottom-center': "the bottom 40% of the frame, centered",
    'right': "the right 45% of the frame, vertically centered",
    'left': "the left 45% of the frame, vertically centered",
    'top-center': "the top 40% of the frame, centered",
    'center': "the center of the frame",
    'split-bottom': "the bottom 45% of the frame in two columns",
  };

  return [
    `The following text elements will be composited over the image: ${textElements.join(", ")}.`,
    `These elements will be placed in ${zoneMap[pos]}.`,
    `That zone MUST be kept clean — use only smooth dark gradients or deep shadows there.`,
    "Do NOT place the subject's body, important props, or scene details in this text zone.",
    "Think of it as a photographer composing the shot to leave space for a magazine text overlay.",
  ].join("\n");
}

// ─── BUILD LAYOUT (for the compositor) ────────────────────────
export function buildLayout(sl: SlideData, light: LightKey, fmt: FormatKey, layoutPos: LayoutPosition) {
  const ACC: Record<LightKey, string> = {
    dramatic: '#00b4ff',
    warm:     '#f5c842',
    green:    '#c8ff00',
    moody:    '#ffffff',
  };
  const DIM: Record<FormatKey, string> = {
    '4:5':  '1080×1350px',
    '9:16': '1080×1920px',
    '1:1':  '1080×1080px',
  };
  const accent = ACC[light];

  return `LAYOUT — SLIDE ${sl.num} | ${DIM[fmt]} | Position: ${layoutPos}
════════════════════════════════════
REFERÊNCIA ESTÉTICA: editorial bold, neon accent, dark background
Inspiração: carrossel de marca pessoal estilo agência premium brasileira

ACCENT COLOR: ${accent}
LAYOUT POSITION: ${layoutPos}

── HIERARQUIA TIPOGRÁFICA ──────────

① NÚMERO DO SLIDE [${sl.num}]
  Font: Bricolage Grotesque 700 | 13px | tracking: 2px
  Cor: rgba(255,255,255,0.38)

② TÍTULO: "${sl.titulo}"
  Font: Bricolage Grotesque 900 Italic | 44–52px | max 3 linhas | line-height: 1.08
  Cor: ${accent} (cor de acento — NUNCA branco)
  Uppercase

③ SUBTÍTULO: "${sl.subtitulo}"
  Font: Bricolage Grotesque 400 | 18px | line-height: 1.55
  Cor: rgba(255,255,255,0.90)
  Palavras-chave em bold branco puro
${sl.cta ? `
④ CTA: "${sl.cta}"
  Font: Bricolage Grotesque 700 | 12px | uppercase | tracking: 1.5px
  Background: ${accent} | Cor texto: #000000
  Padding: 12px 22px | border-radius: 8px` : ''}

── REGRAS ─────────────────────────
- Título SEMPRE em ${accent} — nunca branco
- Subtítulo branco com palavras-chave em bold
- Hierarquia visual clara: título > subtítulo > CTA
- Fundo da zona de texto escuro o suficiente para legibilidade
════════════════════════════════════`;
}
