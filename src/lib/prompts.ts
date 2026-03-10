import type { SlideData, StyleKey, LightKey, FormatKey } from "./parser";

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

const COMPS: Record<FormatKey, string> = {
  "4:5": "vertical 4:5 portrait, subject in upper 60% of frame, lower area with natural dark falloff for compositing",
  "9:16": "vertical 9:16 tall portrait, subject in upper 2/3, lower quarter fading to deep shadow",
  "1:1": "square 1:1 composition, centered subject, natural dark gradient at bottom edge",
};

const NEG =
  "text, typography, letters, words, watermark, logo, overlay text, speech bubbles, cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed";

export const VAR_HINTS = [
  "",
  ", slightly different camera angle, subtle lighting variation",
  ", alternative composition, different atmospheric depth",
  ", unique creative framing, slightly different light mood",
];

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
  "person",
  "man",
  "woman",
  "boy",
  "girl",
  "human",
  "speaker",
  "expert",
];

function visualHasPerson(visual: string): boolean {
  const v = visual.toLowerCase();
  return PERSON_KEYWORDS.some((kw) => v.includes(kw));
}

export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
  options?: { useFaceRef?: boolean },
) {
  const shouldUseFaceRef = options?.useFaceRef ?? visualHasPerson(sl.visual ?? "");

  const faceInstruction = shouldUseFaceRef
    ? [
        "FACE REFERENCE — HIGHEST PRIORITY INSTRUCTION:",
        "A reference photo of a real person is provided as the first image.",
        "Your task is NOT to paste this photo into the scene.",
        "Instead: carefully study the persons unique facial anatomy — face shape, eye color and shape, skin tone, nose structure, lip definition, jawline, brow line, and hair.",
        "Then GENERATE this exact person from scratch, fully embedded in the scene described below.",
        "The person must be wearing the described outfit, in the described setting, with the described mood — but their face must be unmistakably the same individual from the reference.",
        "The result should look like a brand-new high-quality photograph of that real person naturally placed in this new context.",
        "Facial identity is mandatory. Do not alter, idealize, or blend their features with another person.",
      ].join(" ")
    : "";

  const pos = [
    faceInstruction,
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    COMPS[fmt],
    "professional commercial photography quality, dramatic atmospheric depth, cinematic bokeh, subject in sharp focus, dark rich background, high production value",
  ]
    .filter(Boolean)
    .map((s) => s.trim())
    .join(". ");

  return { pos, neg: NEG };
}

export function buildLayout(sl: SlideData, light: LightKey, fmt: FormatKey) {
  const ACC: Record<LightKey, string> = { dramatic: "#00b4ff", warm: "#f5c842", green: "#c8ff00", moody: "#ffffff" };
  const DIM: Record<FormatKey, string> = { "4:5": "1080×1350px", "9:16": "1080×1920px", "1:1": "1080×1080px" };
  return `LAYOUT — SLIDE ${sl.num} | ${DIM[fmt]}
────────────────────────────────────
OVERLAY: linear-gradient(to top,
  rgba(0,0,0,0.93) 0%,  rgba(0,0,0,0.28) 45%,  rgba(0,0,0,0.00) 78%)

NÚMERO [${sl.num}]
  Font: Bricolage Grotesque Bold 700 | 13px
  Color: rgba(255,255,255,0.42) | top:20px left:22px

TÍTULO: "${sl.titulo}"
  Font: Bricolage Grotesque 800 | 38–44px | max 2 linhas
  Color: #FFFFFF | Line-height: 1.15

SUBTÍTULO: "${sl.subtitulo}"
  Font: Bricolage Grotesque 300 | 15–16px
  Color: rgba(255,255,255,0.70) | 10px abaixo título
${
  sl.cta
    ? `
CTA [bottom-right]: "${sl.cta}"
  Background: ${ACC[light]} | Text: #000
  Bold 700 | 11px | Padding: 10px 18px | border-radius: 8px`
    : ""
}
────────────────────────────────────`;
}
