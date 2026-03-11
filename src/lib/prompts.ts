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

// ─── NAMED PERSON / CHARACTER DETECTION ───────────────────────
// Detects proper names, celebrities, characters in the VISUAL field.
// When detected, FACE_REFERENCE should be omitted so the AI generates
// the actual person/character instead of using the user's face.
const KNOWN_NAMES = [
  // Tech
  "elon musk",
  "steve jobs",
  "bill gates",
  "mark zuckerberg",
  "jeff bezos",
  "tim cook",
  "satya nadella",
  "larry page",
  "sergey brin",
  "jack dorsey",
  // Entertainment
  "beyoncé",
  "beyonce",
  "rihanna",
  "drake",
  "taylor swift",
  "kanye west",
  "lady gaga",
  "madonna",
  "michael jackson",
  "elvis presley",
  "freddie mercury",
  "bob marley",
  "eminem",
  "jay-z",
  "nicki minaj",
  "ariana grande",
  // Actors
  "brad pitt",
  "angelina jolie",
  "leonardo dicaprio",
  "robert downey jr",
  "tom cruise",
  "will smith",
  "johnny depp",
  "scarlett johansson",
  "morgan freeman",
  "denzel washington",
  "keanu reeves",
  "ryan reynolds",
  "dwayne johnson",
  "the rock",
  // Sports
  "cristiano ronaldo",
  "messi",
  "lionel messi",
  "neymar",
  "lebron james",
  "michael jordan",
  "serena williams",
  "usain bolt",
  "pelé",
  "pele",
  "ronaldinho",
  "kobe bryant",
  "muhammad ali",
  // Historical
  "einstein",
  "albert einstein",
  "nikola tesla",
  "napoleon",
  "cleopatra",
  "gandhi",
  "martin luther king",
  "nelson mandela",
  "abraham lincoln",
  // Fictional characters
  "batman",
  "superman",
  "spider-man",
  "spiderman",
  "homem-aranha",
  "iron man",
  "homem de ferro",
  "thor",
  "hulk",
  "wolverine",
  "darth vader",
  "luke skywalker",
  "harry potter",
  "gandalf",
  "joker",
  "coringa",
  "thanos",
  "deadpool",
  "capitão américa",
  "captain america",
  "wonder woman",
  "mulher maravilha",
  // Brazilian
  "anitta",
  "neymar jr",
  "xuxa",
  "silvio santos",
  "luciano huck",
  "gisele bündchen",
  "gisele bundchen",
  "ayrton senna",
  "lula",
  "bolsonaro",
  "pablo marçal",
  "pablo marcal",
  "flávio augusto",
  "flavio augusto",
  "thiago nigro",
  "primo rico",
  "joel jota",
  "caio carneiro",
  "ícaro de carvalho",
  "icaro de carvalho",
  "whindersson nunes",
  "casimiro",
  "felipe neto",
];

const PROPER_NAME_REGEX =
  /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇÑ][a-záéíóúâêôãõçñ]{2,}(?:\s+(?:de|do|da|dos|das|e|van|von|del|la|el|al|bin|ibn)?\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇÑ][a-záéíóúâêôãõçñ]{2,})+\b/g;

const COMMON_NON_NAMES = [
  "call to action",
  "no slide",
  "na cena",
  "do slide",
  "em pé",
  "de frente",
  "ao fundo",
  "na mesa",
  "com fundo",
  "olhando para",
  "close up",
  "meio corpo",
  "corpo inteiro",
  "plano médio",
  "à esquerda",
  "à direita",
  "ao centro",
  "no centro",
  "first person",
  "full body",
  "half body",
  "face reference",
];

/**
 * Retorna o nome/palavra detectada que causou a omissão do FACE_REF,
 * ou `false` se nenhum nome próprio externo foi encontrado.
 * Nomes entre aspas são ignorados (são apelidos/marcas do próprio usuário).
 */
export function visualMentionsNamedPerson(visual: string): string | false {
  // Remove trechos entre aspas — nomes entre aspas não bloqueiam FACE_REF
  const QUOTE_RE = /"[^"]*"|'[^']*'|\u201c[^\u201d]*\u201d|\u2018[^\u2019]*\u2019/g;
  const v = (visual ?? "").toLowerCase().replace(QUOTE_RE, "");
  const visualClean = (visual ?? "").replace(QUOTE_RE, "");

  // 1. Verifica lista de nomes conhecidos
  const knownMatch = KNOWN_NAMES.find((name) => v.includes(name));
  if (knownMatch) return knownMatch;

  // 2. Verifica padrão regex de nomes próprios
  const matches = visualClean.match(PROPER_NAME_REGEX) || [];
  const nameMatch = matches.find((m) => !COMMON_NON_NAMES.some((cp) => m.toLowerCase().includes(cp)));
  if (nameMatch) return nameMatch;

  return false;
}

// ─── SKIN & REALISM BOOSTER ───────────────────────────────────
const SKIN_REALISM =
  "ultra-detailed skin texture with visible pores, natural skin imperfections, subsurface scattering on skin creating translucent warmth under strong light, sharp catchlights in eyes with natural iris detail, individual hair strands visible, natural micro-expressions";

// ─── TITLE STYLE DETECTION ────────────────────────────────────
export type TitleStyle =
  | "default"
  | "everybody-hates-chris"
  | "stranger-things"
  | "breaking-bad"
  | "peaky-blinders"
  | "money-heist"
  | "squid-game"
  | "wednesday"
  | "succession"
  | "the-office"
  | "ozark"
  | "narcos"
  | "euphoria"
  | "game-of-thrones"
  | "vikings"
  | "taxi-driver"
  | "pulp-fiction"
  | "blade-runner"
  | "star-wars"
  | "matrix"
  | "fight-club";

const TITLE_STYLE_MAP: Array<{ keywords: string[]; style: TitleStyle }> = [
  {
    keywords: [
      "todo mundo odeia",
      "everybody hates",
      "everybody hates chris",
      "todo mundo odeia o chris",
      "seriado chris",
    ],
    style: "everybody-hates-chris",
  },
  { keywords: ["stranger things", "upside down", "demogorgon"], style: "stranger-things" },
  { keywords: ["breaking bad", "heisenberg", "walter white"], style: "breaking-bad" },
  { keywords: ["peaky blinders", "peaky", "shelby"], style: "peaky-blinders" },
  { keywords: ["money heist", "casa de papel", "la casa de papel"], style: "money-heist" },
  { keywords: ["squid game", "round 6", "squid"], style: "squid-game" },
  { keywords: ["wednesday", "addams", "wednesday addams"], style: "wednesday" },
  { keywords: ["succession", "roy family"], style: "succession" },
  { keywords: ["the office", "dunder mifflin", "mockumentary"], style: "the-office" },
  { keywords: ["ozark", "byrde"], style: "ozark" },
  { keywords: ["narcos", "escobar", "cartel"], style: "narcos" },
  { keywords: ["euphoria", "rue"], style: "euphoria" },
  { keywords: ["game of thrones", "got", "westeros"], style: "game-of-thrones" },
  { keywords: ["vikings", "ragnar", "norse", "nórdico"], style: "vikings" },
  { keywords: ["taxi driver", "de niro"], style: "taxi-driver" },
  { keywords: ["pulp fiction", "tarantino"], style: "pulp-fiction" },
  { keywords: ["blade runner", "cyberpunk 2077", "dystopia"], style: "blade-runner" },
  { keywords: ["star wars", "jedi", "sith"], style: "star-wars" },
  { keywords: ["matrix", "neo", "morpheus"], style: "matrix" },
  { keywords: ["fight club", "tyler durden"], style: "fight-club" },
];

export function detectTitleStyle(visual: string, design?: string): TitleStyle {
  const src = ((visual ?? "") + " " + (design ?? "")).toLowerCase();
  for (const entry of TITLE_STYLE_MAP) {
    if (entry.keywords.some((kw) => src.includes(kw))) return entry.style;
  }
  return "default";
}

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
    "COMPOSITION & LAYOUT:",
    "The image MUST have strong compositional hierarchy with dramatic negative space.",
    "Position the main subject off-center following the rule of thirds.",
    "Leave at least 30-40% of the image as clean dark/atmospheric area for text overlay (do NOT add text — just leave clean space).",
    "Create natural depth separation: sharp foreground subject, soft bokeh mid-ground, atmospheric background.",
    "CRITICAL: Ensure at least one large area of the image has low visual complexity (soft gradients, bokeh, shadow) for typography placement.",
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

// ─── BUILD LAYOUT (accent only) ──────────────────────────────
export function buildLayout(light: LightKey): { accent: string } {
  const ACC: Record<LightKey, string> = {
    dramatic: "#00b4ff",
    warm: "#f5c842",
    green: "#c8ff00",
    moody: "#ffffff",
  };
  return { accent: ACC[light] };
}
