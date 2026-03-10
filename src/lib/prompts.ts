import type { SlideData, StyleKey, LightKey, FormatKey, LayoutPosition } from "./parser";

// ─── STYLE PRESETS ────────────────────────────────────────────
const STYLES: Record<StyleKey, string> = {
  cinematic:
    "ultra-realistic cinematic portrait photography, 50mm-85mm prime lens f/1.4, extreme skin detail and pore texture, natural film grain, Hollywood color grading, photorealistic — scene designed for editorial text overlay: all shadow zones carry the scene's ambient color temperature at low intensity, never pure black voids",
  corporate:
    "professional editorial portrait photography, studio strobe key light with soft box, luxury business magazine aesthetic, photorealistic — directional shadows have warm or cool color contamination matching the scene, deep textured dark zones suitable for overlaid typography",
  futuristic:
    "hyper-realistic sci-fi portrait, futuristic neon practical lights, cyberpunk art direction, photorealistic — neon light bleeds and spills into all dark background zones, colored atmospheric glow contaminates shadows, every dark area has visible ambient hue from the scene's neon sources",
  editorial:
    "high-end editorial portrait photography, Vogue-quality dramatic lighting, sophisticated composition, photorealistic — dark zones have multi-layer tonal depth with ambient light interaction from scene sources, designed so overlaid text feels physically lit by the environment",
};

const LIGHTS: Record<LightKey, string> = {
  dramatic:
    "electric blue key light from camera left at 45°, blue light spill bleeds across dark background surfaces at 10-20% intensity — rich deep-blue atmospheric glow in all shadow zones, neon blue rim light creating a halo on subject edges, cool desaturated mid-tones, NEVER pure black in shadows",
  warm: "warm amber-golden key light, amber light contamination visible in all dark zones — warm golden haze in background depth, shadows carry rich ochre-sienna undertones, luxury gold color grade — NEVER pure black, always rich dark warm tones with visible color temperature",
  green:
    "neon lime-green rim light — visible green light spill radiates and bleeds onto dark background surfaces, cyberpunk green ambient glow permeates all shadow zones at low intensity, high contrast with deep dark background that still has visible green luminescence — NEVER pure black zones",
  moody:
    "single Rembrandt key light from above-right, deep chiaroscuro — shadows are rich dark-grey with faint warm candle-light contamination, dramatic contrast, visible tonal texture in all dark areas — noir palette with depth and color in the darkness, NEVER flat pure black",
};

const NEG =
  "text, typography, letters, words, watermark, logo, overlay text, speech bubbles, cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed, pure black background, flat background, studio seamless backdrop, solid color background, zero-light shadow zones, washed out skin, plastic skin, airbrushed face";

export const VAR_HINTS = [
  "",
  ", slightly different camera angle, subtle lighting variation",
  ", alternative composition, different atmospheric depth",
  ", unique creative framing, slightly different light mood",
];

// ─── PERSON DETECTION ─────────────────────────────────────────
const PERSON_KEYWORDS = [
  "pessoa",
  "homem",
  "mulher",
  "menino",
  "menina",
  "criança",
  "executivo",
  "empresário",
  "empresária",
  "líder",
  "atleta",
  "médico",
  "profissional",
  "founder",
  "ceo",
  "palestrante",
  "especialista",
  "autor",
  "coach",
  "ele",
  "ela",
  "person",
  "man",
  "woman",
  "boy",
  "girl",
  "human",
  "speaker",
  "expert",
];

const PERSON_LEFT_HINTS = [
  "segurando",
  "holding",
  "carregando",
  "carrying",
  "caixa",
  "box",
  "microfone",
  "microphone",
  "perfil",
  "profile",
  "olhando para direita",
];

const PERSON_RIGHT_HINTS = [
  "computador",
  "laptop",
  "notebook",
  "tela",
  "screen",
  "trabalhando",
  "digitando",
  "typing",
  "mesa",
  "desk",
];

const ABSTRACT_KEYWORDS = [
  "número",
  "number",
  "texto 3d",
  "3d text",
  "gráfico",
  "chart",
  "estatística",
  "dados",
  "data",
  "ícone",
  "icon",
  "símbolo",
  "abstract",
  "abstrato",
  "conceitual",
  "conceptual",
];

const SCENE_KEYWORDS = [
  "estrada",
  "road",
  "cidade",
  "city",
  "paisagem",
  "landscape",
  "escritório",
  "office",
  "palco",
  "stage",
  "evento",
  "event",
  "plateia",
  "audience",
  "grupo",
  "group",
  "equipe",
  "team",
  "multidão",
  "crowd",
  "reunião",
  "meeting",
];

function visualHasPerson(visual: string): boolean {
  const v = (visual ?? "").toLowerCase();
  return PERSON_KEYWORDS.some((kw) => v.includes(kw));
}

function hasKeywords(visual: string, keywords: string[]): boolean {
  const v = (visual ?? "").toLowerCase();
  return keywords.some((kw) => v.includes(kw));
}

// ─── LAYOUT POSITION DETECTION ────────────────────────────────
export function detectLayoutPosition(sl: SlideData, slideIndex: number, totalSlides: number): LayoutPosition {
  const visual = (sl.visual ?? "").toLowerCase();
  const hasPerson = visualHasPerson(visual);
  const isAbstract = hasKeywords(visual, ABSTRACT_KEYWORDS);
  const isScene = hasKeywords(visual, SCENE_KEYWORDS);
  const hasPersonLeft = hasKeywords(visual, PERSON_LEFT_HINTS);
  const hasPersonRight = hasKeywords(visual, PERSON_RIGHT_HINTS);
  const hasLongSubtitle = (sl.subtitulo?.length ?? 0) > 100;

  if (isAbstract && !hasPerson) return "bottom-center";
  if (isScene && !hasPerson) return hasLongSubtitle ? "split-bottom" : "bottom-center";

  if (hasPerson) {
    if (hasPersonLeft) return "right";
    if (hasPersonRight) return "left";
    const posInCarousel = slideIndex % totalSlides;
    if (posInCarousel === 0) return "right";
    if (posInCarousel % 3 === 0) return "left";
    if (posInCarousel % 2 === 0) return "top-center";
    return "bottom-left";
  }

  if (hasLongSubtitle) return "split-bottom";
  return "bottom-left";
}

// ─── COMPOSITION INSTRUCTIONS PER LAYOUT ──────────────────────
function getCompositionInstruction(pos: LayoutPosition): string {
  const instructions: Record<LayoutPosition, string> = {
    "bottom-left": [
      "COMPOSITION: Subject in TIGHT CLOSE-UP or medium-close frame — face and upper body prominent, filling the upper 55% of the image.",
      "Camera at slight downward angle for authority. Subject slightly off-center to the left.",
      "The LOWER 45% transitions from the scene into deep atmospheric darkness with the scene's ambient color temperature visible at 8-15% — NOT pure black.",
      "This dark-gradient zone carries the scene's colored light, like neon on wet concrete — alive with faint color.",
      "No objects, body parts or scene details in this lower text zone.",
    ].join("\n"),

    "bottom-center": [
      "COMPOSITION: Main visual element prominent in the UPPER 55%, centered.",
      "The LOWER 40% is a cinematic atmospheric fade — scene color temperature bleeds downward into deep dark at 8-15% intensity.",
      "Bottom zone reserved for centered text overlay — must feel like the scene is fading, not cut off.",
    ].join("\n"),

    right: [
      "COMPOSITION: Subject in TIGHT CLOSE-UP filling the LEFT 52% — face large, expressive, cinematic.",
      "The RIGHT 45% fades into atmospheric darkness carrying a faint directional glow or color spill from the scene's key light.",
      "Dark vignetting on the right with visible ambient color contamination — the darkness has depth and color, not void.",
      "Subject faces slightly right/toward camera with strong eye contact.",
    ].join("\n"),

    left: [
      "COMPOSITION: Subject in TIGHT CLOSE-UP filling the RIGHT 52% — face large, expressive, cinematic.",
      "The LEFT 45% fades into rich atmospheric shadow — the scene's ambient light wraps around into this zone at low intensity.",
      "Dark left zone with colored shadow contamination matching the scene palette.",
    ].join("\n"),

    "top-center": [
      "COMPOSITION: Subject in TIGHT CLOSE-UP filling the LOWER 55% — face and shoulders prominent.",
      "The UPPER 40% has deep cinematic atmosphere — dark with volumetric haze or light spill bleeding upward from the scene at 5-10% intensity.",
      "Top zone reserved for bold text — moody depth, not empty black.",
    ].join("\n"),

    center: [
      "COMPOSITION: Rich atmospheric environment throughout — layered tonal depth, deep and textured.",
      "Main visual can be centered but subtle — every dark zone carries color from the scene's light sources.",
      "Deep, moody, cinematic — the darkest shadows still have ambient color and texture.",
    ].join("\n"),

    "split-bottom": [
      "COMPOSITION: Scene fills the UPPER 55%.",
      "The LOWER 45% is a cinematic atmospheric gradient — scene color temperature fades downward into deep dark.",
      "The transition is smooth and cinematic — ambient light still faintly visible at the bottom of the frame.",
      "Bottom zone supports two-column text layout — depth and color, not void.",
    ].join("\n"),
  };

  return instructions[pos];
}

// ─── SKIN & REALISM BOOSTER ───────────────────────────────────
// Injected in all person shots for maximum photorealism
const SKIN_REALISM =
  "ultra-detailed skin texture with visible pores, natural skin imperfections, subsurface scattering on skin creating translucent warmth under strong light, sharp catchlights in eyes with natural iris detail, individual hair strands visible, natural micro-expressions";

// ─── BUILD PROMPT ─────────────────────────────────────────────
export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
  layoutPos: LayoutPosition,
  options?: { useFaceRef?: boolean },
) {
  const useFaceRef = options?.useFaceRef ?? false;

  const fmtHint: Record<FormatKey, string> = {
    "4:5": "vertical 4:5 portrait format (1080×1350px)",
    "9:16": "vertical 9:16 tall format (1080×1920px)",
    "1:1": "square 1:1 format (1080×1080px)",
  };

  const faceInstruction = useFaceRef
    ? [
        "FACE REFERENCE IMAGE ATTACHED:",
        "Use it ONLY to extract the facial identity — face shape, eye color/shape, skin tone, nose, lips, jawline, brow, hair.",
        "DO NOT reproduce the reference photo's background, clothing, pose or lighting.",
        "GENERATE a completely new photograph of this same person FROM SCRATCH, naturally embedded in the scene below.",
        "The face must be unmistakably the same individual with zero influence from the reference except facial identity.",
      ].join(" ")
    : "";

  const hasPerson = visualHasPerson(sl.visual ?? "");
  const skinBoost = hasPerson ? SKIN_REALISM : "";
  const compositionInstruction = getCompositionInstruction(layoutPos);
  const textElementsHint = buildTextElementsHint(sl, layoutPos);

  const pos = [
    faceInstruction,
    "SCENE DESCRIPTION:",
    fmtHint[fmt],
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    skinBoost,
    "",
    "COMPOSITION RULES:",
    compositionInstruction,
    textElementsHint,
    "",
    "QUALITY & ATMOSPHERE:",
    "professional commercial photography, dramatic atmospheric depth, cinematic bokeh with creamy out-of-focus areas, subject in tack-sharp focus, RICH TEXTURED SHADOWS with ambient color contamination — all dark zones carry the scene's color temperature at 8-15% intensity, volumetric light spill on background surfaces and skin, colored light interaction visible on all dark surfaces, deep shadows with visible color tones NEVER pure black, scene lighting creates natural editorial gradients where composited typography will feel physically embedded and lit by the environment, high production value, Hasselblad medium format quality",
  ]
    .filter((s) => s !== undefined && s !== null)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  return { pos, neg: NEG };
}

function buildTextElementsHint(sl: SlideData, pos: LayoutPosition): string {
  const textElements: string[] = [];
  if (sl.titulo) textElements.push("a large bold title");
  if (sl.subtitulo) textElements.push("a subtitle paragraph");
  if (sl.cta) textElements.push("a call-to-action button");

  if (!textElements.length) return "";

  const zoneMap: Record<LayoutPosition, string> = {
    "bottom-left": "the bottom-left 45% of the frame",
    "bottom-center": "the bottom 40% of the frame, centered",
    right: "the right 45% of the frame, vertically centered",
    left: "the left 45% of the frame, vertically centered",
    "top-center": "the top 40% of the frame, centered",
    center: "the center of the frame",
    "split-bottom": "the bottom 45% of the frame in two columns",
  };

  return [
    `The following text elements will be composited over the image: ${textElements.join(", ")}.`,
    `These will be placed in ${zoneMap[pos]}.`,
    `CRITICAL: That zone must be cinematically dark but NOT pure black — use deep atmospheric gradients with the scene's ambient color temperature subtly present at 8-15% intensity.`,
    `Think of it as a photographer leaving space for magazine text: the darkness is alive with a faint colored glow from the scene's light sources — like neon reflecting off dark wet pavement.`,
    `This allows composited typography to appear physically lit by the scene — as if the text itself catches light from the environment.`,
    `Do NOT place the subject's body, props, or scene details in this text zone.`,
  ].join("\n");
}

// ─── BUILD LAYOUT (for the compositor) ────────────────────────
export function buildLayout(
  sl: SlideData,
  light: LightKey,
  fmt: FormatKey,
  layoutPos: LayoutPosition,
): {
  accent: string;
  layoutPos: LayoutPosition;
  slideNum: string;
  titulo: string;
  subtitulo: string;
  cta: string;
} {
  const ACC: Record<LightKey, string> = {
    dramatic: "#00b4ff",
    warm: "#f5c842",
    green: "#c8ff00",
    moody: "#ffffff",
  };

  return {
    accent: ACC[light],
    layoutPos,
    slideNum: sl.num,
    titulo: sl.titulo,
    subtitulo: sl.subtitulo,
    cta: sl.cta,
  };
}
