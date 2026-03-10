import type { SlideData, StyleKey, LightKey, FormatKey } from "./parser";

// ─── STYLE PRESETS ────────────────────────────────────────────
const STYLES: Record<StyleKey, string> = {
  cinematic:
    "ultra-realistic cinematic portrait photography, 50mm-85mm prime lens f/1.4, extreme skin detail and pore texture, natural film grain, Hollywood color grading, photorealistic — all shadow zones carry the scene's ambient color temperature at low intensity, never pure black voids",
  corporate:
    "professional editorial portrait photography, studio strobe key light with soft box, luxury business magazine aesthetic, photorealistic — directional shadows have warm or cool color contamination matching the scene, deep textured dark zones with rich tonal depth",
  futuristic:
    "hyper-realistic sci-fi portrait, futuristic neon practical lights, cyberpunk art direction, photorealistic — neon light bleeds and spills into all dark background zones, colored atmospheric glow contaminates shadows, every dark area has visible ambient hue from the scene's neon sources",
  editorial:
    "high-end editorial portrait photography, Vogue-quality dramatic lighting, sophisticated composition, photorealistic — dark zones have multi-layer tonal depth with ambient light interaction from scene sources",
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

export function visualHasPerson(visual: string): boolean {
  const v = (visual ?? "").toLowerCase();
  return PERSON_KEYWORDS.some((kw) => v.includes(kw));
}

// ─── SKIN & REALISM BOOSTER ───────────────────────────────────
const SKIN_REALISM =
  "ultra-detailed skin texture with visible pores, natural skin imperfections, subsurface scattering on skin creating translucent warmth under strong light, sharp catchlights in eyes with natural iris detail, individual hair strands visible, natural micro-expressions";

// ─── BUILD PROMPT ─────────────────────────────────────────────
export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
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

  const parts = [
    faceInstruction,
    "SCENE DESCRIPTION:",
    fmtHint[fmt],
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    hasPerson ? SKIN_REALISM : "",
    "",
    "CINEMATIC COMPOSITION:",
    "Shoot as a great cinematic photograph with natural atmospheric depth and distinct luminosity zones.",
    "Create strong tonal contrast: bright foreground subject, rich mid-tones, deep atmospheric shadows.",
    "CRITICAL: The image must have at least one large naturally dark or soft-focus area — subject positioned off-center with strong directional lighting creating organic negative space.",
    "Dark shadow zones must carry the scene's ambient color temperature — never pure black voids.",
    "Do NOT artificially reserve text zones. Just make an exceptional cinematic image with natural depth.",
    "",
    "QUALITY & ATMOSPHERE:",
    "professional commercial photography, dramatic atmospheric depth, cinematic bokeh, subject tack-sharp, rich textured shadows with ambient color contamination at 8-15% intensity, volumetric light spill, colored shadows NEVER pure black, Hasselblad medium format quality",
  ]
    .filter((s) => s !== undefined && s !== null)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  return { pos: parts, neg: NEG };
}

// ─── BUILD LAYOUT (accent only — position decided by Haiku) ───
export function buildLayout(light: LightKey): { accent: string } {
  const ACC: Record<LightKey, string> = {
    dramatic: "#00b4ff",
    warm: "#f5c842",
    green: "#c8ff00",
    moody: "#ffffff",
  };
  return { accent: ACC[light] };
}
