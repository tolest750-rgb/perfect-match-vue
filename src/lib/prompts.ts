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
  "4:5": "vertical 4:5 portrait composition, subject positioned in the upper 40% of frame, the entire lower 40% must be a clean dark gradient with NO objects, NO details, NO scenery — this area is reserved exclusively for text overlay",
  "9:16": "vertical 9:16 tall portrait composition, subject positioned in upper third of frame, the lower 50% must be a clean dark empty area with smooth gradient falloff — this zone is strictly reserved for typography overlay, keep it completely clear of any subjects or scene elements",
  "1:1": "square 1:1 composition, subject positioned in upper-right quadrant, the lower-left area must be clean dark negative space reserved for text overlay",
};

const NEG =
  "text, typography, letters, words, watermark, logo, overlay text, speech bubbles, cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed, objects in lower portion of image, busy background in text area, clutter in bottom half";

export const VAR_HINTS = [
  "",
  ", slightly different camera angle, subtle lighting variation",
  ", alternative composition, different atmospheric depth",
  ", unique creative framing, slightly different light mood",
];

const PERSON_KEYWORDS = [
  "pessoa", "homem", "mulher", "menino", "menina", "criança",
  "executivo", "empresário", "empresária", "líder", "atleta",
  "médico", "profissional", "founder", "ceo", "palestrante",
  "especialista", "autor", "coach", "person", "man", "woman",
  "boy", "girl", "human", "speaker", "expert",
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
        "CRITICAL INSTRUCTION — FACE REFERENCE USAGE:",
        "A small reference photo is attached. This photo is ONLY for extracting the person's facial identity.",
        "DO NOT reproduce, paste, overlay, or composite this reference photo into the scene.",
        "DO NOT use the reference photo's background, clothing, lighting, pose, or composition.",
        "Instead: study ONLY the person's unique facial features — face shape, eye color/shape, skin tone, nose, lips, jawline, brow, and hair style/color.",
        "Then GENERATE a completely new photograph of this same person FROM SCRATCH, naturally placed in the scene described below.",
        "The person must wear the described outfit, in the described setting and pose — but their face MUST be unmistakably the same individual.",
        "The reference photo should have ZERO influence on the final image except for facial identity.",
      ].join("\n")
    : "";

  // Layout-aware composition instruction
  const layoutInstruction = buildLayoutCompositionHint(sl, fmt);

  const pos = [
    faceInstruction,
    "SCENE DESCRIPTION:",
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    "",
    "COMPOSITION & LAYOUT RULES:",
    COMPS[fmt],
    layoutInstruction,
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

function buildLayoutCompositionHint(sl: SlideData, fmt: FormatKey): string {
  const hasTitle = !!sl.titulo;
  const hasSubtitle = !!sl.subtitulo;
  const hasCta = !!sl.cta;

  const textElements: string[] = [];
  if (hasTitle) textElements.push(`a large title ("${sl.titulo.substring(0, 30)}...")`);
  if (hasSubtitle) textElements.push("a subtitle line");
  if (hasCta) textElements.push("a call-to-action button");

  const textDesc = textElements.length > 0
    ? `The following text elements will be composited over the image: ${textElements.join(", ")}.`
    : "";

  const zoneMap: Record<FormatKey, string> = {
    "4:5": "the bottom 40% of the frame",
    "9:16": "the bottom 50% of the frame",
    "1:1": "the bottom-left 40% of the frame",
  };

  return [
    "TYPOGRAPHY SAFE ZONE — MANDATORY:",
    textDesc,
    `These text elements will be placed in ${zoneMap[fmt]}.`,
    `Therefore, ${zoneMap[fmt]} MUST be kept completely clean — use only a smooth dark gradient or deep shadow falloff.`,
    "Do NOT place the subject's body, hands, important props, or any scene details in this text zone.",
    "The subject should be positioned ABOVE and AWAY from this reserved area.",
    "Think of it as a photographer deliberately composing the shot to leave space for a magazine text overlay.",
  ].join("\n");
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
