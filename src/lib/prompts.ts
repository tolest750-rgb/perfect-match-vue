import type { SlideData, StyleKey, LightKey, FormatKey, LayoutPosition } from "./parser";

// ─── STYLE PRESETS ────────────────────────────────────────────
const STYLES: Record<StyleKey, string> = {
  cinematic:
    "ultra-realistic cinematic portrait photography, 85mm prime lens f/1.8, natural film grain, Hollywood color grading, photorealistic, designed for editorial text overlay — dark zones must carry the scene's ambient color temperature, never pure black",
  corporate:
    "professional editorial portrait photography, studio strobe lighting, luxury business magazine aesthetic, photorealistic, scene composed for text-over-image layout — shadows are rich and directional with subtle warm or cool color contamination",
  futuristic:
    "hyper-realistic sci-fi portrait, futuristic neon practical lights, cyberpunk art direction, photorealistic, neon light spill bleeds into dark background zones — colored atmospheric glow on all shadow areas ready for composited typography",
  editorial:
    "high-end editorial portrait photography, Vogue-quality lighting, sophisticated composition, photorealistic, dark zones have layered tonal depth with ambient light interaction — designed so overlaid text feels physically lit by the scene",
};

const LIGHTS: Record<LightKey, string> = {
  dramatic:
    "electric blue key light from camera left, cool desaturated shadows, neon blue rim light — blue light spill bleeds across dark background surfaces at 10-20% intensity, creating a rich deep-blue atmospheric glow in shadow zones, never pure black",
  warm: "warm amber golden key light, rich warm shadows, luxury gold color grade — amber light contamination in all dark zones, warm golden haze visible in background depth, shadows carry rich ochre undertones, deep dark-warm background with visible color temperature",
  green:
    "neon lime-green rim light — visible green light spill radiates onto dark background surfaces, cyberpunk green ambient glow bleeds into shadow zones at low intensity, high contrast dark background with subtle green luminescence in the darkness",
  moody:
    "single Rembrandt key light, deep chiaroscuro shadows, noir palette — shadows are rich dark grey with warm candlelight contamination, never pure black, dramatic contrast with visible tonal texture in all dark areas",
};

const NEG =
  "text, typography, letters, words, watermark, logo, overlay text, speech bubbles, cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed, pure black background, flat background, studio seamless backdrop, solid color background, zero-light shadow zones";

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
      "COMPOSITION: Subject positioned in the UPPER 50% of the frame.",
      "The LOWER 45% must transition from the scene into deep atmospheric darkness — NOT pure black.",
      "This dark zone must carry the scene's ambient color temperature at 8-15% intensity (cool blue haze, warm amber glow, etc.).",
      "The darkness should feel like a continuation of the scene's lighting, not a cut to black.",
      "This lower zone is reserved exclusively for text overlay. No objects or scene details.",
      "Subject should be slightly off-center to the right.",
    ].join("\n"),
    "bottom-center": [
      "COMPOSITION: Main visual element positioned in the UPPER 55% of the frame, centered.",
      "The LOWER 40% must be a deep atmospheric gradient — rich dark with subtle ambient color from the scene's light sources.",
      "Think wet concrete at night under neon: dark but alive with reflected color at low intensity.",
      "This bottom zone is strictly reserved for centered text overlay.",
      "The visual should have a natural cinematic falloff toward the bottom — light bleeds, then fades.",
    ].join("\n"),
    right: [
      "COMPOSITION: Subject positioned on the LEFT 50% of the frame.",
      "The RIGHT 45% must be deep atmospheric dark — NOT flat black.",
      "The scene's key light should cast a faint directional glow or color spill into this right zone.",
      "Dark vignetting on the right side, but with visible ambient color contamination at low opacity.",
      "Subject should face slightly toward the right/camera.",
      "This right zone is reserved for text overlay — atmosphere without clutter.",
    ].join("\n"),
    left: [
      "COMPOSITION: Subject positioned on the RIGHT 50% of the frame.",
      "The LEFT 45% must be rich atmospheric shadow — deep but with the scene's ambient color temperature visible.",
      "A subtle light spill from the scene's source should graze this left zone, as if the light wraps around.",
      "Dark vignetting on the left side with colored shadow contamination.",
      "This left zone is reserved for text overlay — depth without obstruction.",
    ].join("\n"),
    "top-center": [
      "COMPOSITION: Subject positioned in the LOWER 55% of the frame.",
      "The UPPER 40% must have deep cinematic atmosphere — dark but with volumetric haze or ambient glow from below.",
      "Light from the scene should bleed upward into this dark zone at 5-10% intensity, as if illuminating smoke or air.",
      "Subject placed from center to bottom, looking upward or forward.",
      "This upper zone is reserved for bold text overlay — moody depth, not empty black.",
    ].join("\n"),
    center: [
      "COMPOSITION: Rich atmospheric background throughout — deep and textured, never flat.",
      "Main visual element can be centered but subtle.",
      "The entire frame should have layered tonal depth: distant areas fade into colored darkness.",
      "Deep, moody, cinematic environment where even the darkest zones carry color from the scene's light sources.",
    ].join("\n"),
    "split-bottom": [
      "COMPOSITION: Scene/visual fills the UPPER 55% of the frame.",
      "The LOWER 45% must be a cinematic atmospheric gradient — the scene's color temperature fades downward into deep dark.",
      "The transition from scene to dark should be smooth, with the scene's ambient light still visible as a faint glow in the dark zone.",
      "Bottom area needs to support a two-column text layout — depth and color, not void.",
    ].join("\n"),
  };

  return instructions[pos];
}

// ─── BUILD PROMPT ─────────────────────────────────────────────
export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
  layoutPos: LayoutPosition,
  options?: { useFaceRef?: boolean },
) {
  // ← useFaceRef e fmtHint declarados DENTRO da função
  const useFaceRef = options?.useFaceRef ?? false;

  const fmtHint: Record<FormatKey, string> = {
    "4:5": "vertical 4:5 portrait format (1080×1350px)",
    "9:16": "vertical 9:16 tall format (1080×1920px)",
    "1:1": "square 1:1 format (1080×1080px)",
  };

  // Face reference: só incluída quando o VISUAL menciona uma pessoa
  // e o slide foi marcado para usar face ref
  const faceInstruction = useFaceRef
    ? [
        "FACE REFERENCE IMAGE ATTACHED:",
        "Use it ONLY to extract the facial identity of the person.",
        "DO NOT reproduce, paste, composite or reuse the reference photo background, clothing, pose or lighting.",
        "Study ONLY the unique facial features: face shape, eye color/shape, skin tone, nose, lips, jawline, brow, hair.",
        "GENERATE a completely new photograph of this same person FROM SCRATCH, naturally in the scene described below.",
        "The face must be unmistakably the same individual. Zero influence from the reference except facial identity.",
      ].join(" ")
    : "";

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
    "",
    "COMPOSITION RULES:",
    compositionInstruction,
    textElementsHint,
    "",
    "QUALITY:",
    "professional commercial photography, dramatic atmospheric depth, cinematic bokeh, subject in sharp focus, RICH TEXTURED SHADOWS with ambient color contamination — all dark zones carry the scene's color temperature at low intensity, volumetric light spill on background surfaces, deep shadows with visible color tones never pure black, scene lighting creates natural editorial gradients where composited typography will feel physically embedded and lit by the environment, high production value",
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
    `These elements will be placed in ${zoneMap[pos]}.`,
    `That zone must be cinematically dark but NOT pure black — use deep atmospheric gradients with the scene's ambient color temperature subtly present (5-15% intensity). The zone should feel like the scene's light is fading, not cut off. This colored darkness allows composited text to appear physically lit by the scene — as if the typography itself is catching light from the environment.`,
    "Do NOT place the subject's body, important props, or scene details in this text zone.",
    "Think of it as a photographer composing the shot to leave space for a magazine text overlay.",
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
