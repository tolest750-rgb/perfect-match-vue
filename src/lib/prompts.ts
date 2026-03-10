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
      "The LOWER 45% must be a clean dark gradient area — NO objects, NO details.",
      "This lower zone is reserved exclusively for text overlay.",
      "Subject should be slightly off-center to the right.",
    ].join("\n"),
    "bottom-center": [
      "COMPOSITION: Main visual element positioned in the UPPER 55% of the frame, centered.",
      "The LOWER 40% must be a smooth dark gradient with NO scene elements.",
      "This bottom zone is strictly reserved for centered text overlay.",
      "The visual should have a natural dark falloff toward the bottom.",
    ].join("\n"),
    right: [
      "COMPOSITION: Subject positioned on the LEFT 50% of the frame.",
      "The RIGHT 45% should be relatively dark or have dark atmospheric depth.",
      "This right zone is reserved for text overlay — keep it clean and readable.",
      "Subject should face slightly toward the right/camera.",
      "Use dark vignetting on the right side.",
    ].join("\n"),
    left: [
      "COMPOSITION: Subject positioned on the RIGHT 50% of the frame.",
      "The LEFT 45% should be dark or have deep atmospheric shadows.",
      "This left zone is reserved for text overlay — keep it uncluttered.",
      "Dark vignetting on the left side for text readability.",
    ].join("\n"),
    "top-center": [
      "COMPOSITION: Subject positioned in the LOWER 55% of the frame.",
      "The UPPER 40% must have dark atmosphere or clean dark space.",
      "This upper zone is reserved for bold text overlay.",
      "Subject placed from center to bottom, looking upward or forward.",
      "Natural dark falloff toward the top of the frame.",
    ].join("\n"),
    center: [
      "COMPOSITION: Dark atmospheric background throughout.",
      "Main visual element can be centered but subtle.",
      "The entire frame should support text overlay with good contrast.",
      "Deep, moody, minimal background with cinematic depth.",
    ].join("\n"),
    "split-bottom": [
      "COMPOSITION: Scene/visual fills the UPPER 55% of the frame.",
      "The LOWER 45% must be a clean dark gradient — this is the text zone.",
      "The transition from scene to dark should be smooth and cinematic.",
      "Bottom area needs to support a two-column text layout.",
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
    `That zone MUST be kept clean — use only smooth dark gradients or deep shadows there.`,
    "Do NOT place the subject's body, important props, or scene details in this text zone.",
    "Think of it as a photographer composing the shot to leave space for a magazine text overlay.",
  ].join("\n");
}

// ─── BUILD LAYOUT (for the compositor) ────────────────────────
export function buildLayout(sl: SlideData, light: LightKey, fmt: FormatKey, layoutPos: LayoutPosition) {
  const ACC: Record<LightKey, string> = {
    dramatic: "#00b4ff",
    warm: "#f5c842",
    green: "#c8ff00",
    moody: "#ffffff",
  };
  const DIM: Record<FormatKey, string> = {
    "4:5": "1080×1350px",
    "9:16": "1080×1920px",
    "1:1": "1080×1080px",
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
${
  sl.cta
    ? `
④ CTA: "${sl.cta}"
  Font: Bricolage Grotesque 700 | 12px | uppercase | tracking: 1.5px
  Background: ${accent} | Cor texto: #000000
  Padding: 12px 22px | border-radius: 8px`
    : ""
}

── REGRAS ─────────────────────────
- Título SEMPRE em ${accent} — nunca branco
- Subtítulo branco com palavras-chave em bold
- Hierarquia visual clara: título > subtítulo > CTA
- Fundo da zona de texto escuro o suficiente para legibilidade
════════════════════════════════════`;
}
