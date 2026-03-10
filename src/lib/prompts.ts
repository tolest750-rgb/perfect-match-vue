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

const PERSON_KEYWORDS = [
  'pessoa', 'homem', 'mulher', 'menino', 'menina', 'criança',
  'executivo', 'empresário', 'empresária', 'líder', 'atleta',
  'médico', 'profissional', 'founder', 'ceo', 'palestrante',
  'especialista', 'autor', 'coach', 'ele', 'ela',
  'person', 'man', 'woman', 'boy', 'girl', 'human', 'speaker', 'expert',
];

function visualHasPerson(visual: string): boolean {
  const v = (visual ?? '').toLowerCase();
  return PERSON_KEYWORDS.some(kw => v.includes(kw));
}

export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
  options?: { useFaceRef?: boolean }
) {
  const hasPerson = options?.useFaceRef ?? visualHasPerson(sl.visual ?? '');

  // Só menciona a imagem de referência se o VISUAL citar uma pessoa
  const faceInstruction = hasPerson
    ? [
        'CRITICAL INSTRUCTION — FACE REFERENCE USAGE:',
        'A reference photo is attached. Use it ONLY to extract the facial identity of the person.',
        'DO NOT reproduce, paste, composite or reuse the reference photo background, clothing, pose or lighting.',
        'Study ONLY the unique facial features: face shape, eye color/shape, skin tone, nose, lips, jawline, brow, hair.',
        'GENERATE a completely new photograph of this same person FROM SCRATCH, naturally in the scene described below.',
        'The face must be unmistakably the same individual. Zero influence from the reference except facial identity.',
      ].join(' ')
    : ''; // ← sem pessoa no VISUAL = referência completamente omitida do prompt

  const pos = [
    faceInstruction,
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || '',
    COMPS[fmt],
    'professional commercial photography quality, dramatic atmospheric depth, cinematic bokeh, sharp focus, high production value',
  ].filter(Boolean).map(s => s.trim()).join('. ');

  return { pos, neg: NEG };
}

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
  // Cor de acento: lime-green é o padrão dominante do sistema visual (como nas refs)
  // Outros modos mantêm sua cor, mas o green usa sempre #c8ff00
  const ACC: Record<LightKey, string> = {
    dramatic: '#00b4ff',
    warm:     '#f5c842',
    green:    '#c8ff00',  // lime-green — cor dominante do sistema Britto*
    moody:    '#ffffff',
  };
  const DIM: Record<FormatKey, string> = {
    '4:5':  '1080×1350px',
    '9:16': '1080×1920px',
    '1:1':  '1080×1080px',
  };
  const accent = ACC[light];
  const hasPerson = visualHasPerson(sl.visual ?? '');

  // Zona de texto: slides com pessoa ficam na base; sem pessoa podem ocupar mais área
  const textZone = hasPerson
    ? 'Zona inferior: últimos 45% da altura — gradiente cobre essa área inteiramente'
    : 'Zona inferior: últimos 55% da altura — fundo escuro sólido/gradiente nessa área';

  return `LAYOUT — SLIDE ${sl.num} | ${DIM[fmt]}
════════════════════════════════════
REFERÊNCIA ESTÉTICA: editorial bold, neon accent, dark background
Inspiração: carrossel de marca pessoal estilo agência premium brasileira

MARGENS (todas as bordas):
  Horizontal: 76px (7% de 1080px)
  Vertical topo/base: 81px (6% da altura)
  Mínimo entre elementos: 14px

OVERLAY / GRADIENTE:
  linear-gradient(to top,
    rgba(0,0,0,0.95) 0%,
    rgba(0,0,0,0.80) 30%,
    rgba(0,0,0,0.35) 55%,
    rgba(0,0,0,0.00) 78%
  )
  ${textZone}

── HIERARQUIA TIPOGRÁFICA ──────────

① NÚMERO DO SLIDE [${sl.num}]
  Font: Bricolage Grotesque 700 | 13px | tracking: 2px
  Cor: rgba(255,255,255,0.38)
  Posição: topo esquerdo com margem completa (76px, 81px)

② TÍTULO: "${sl.titulo}"
  Font: Bricolage Grotesque 800 | 42–48px | max 2 linhas | line-height: 1.12
  Cor: ${accent}   ← cor de acento do tema (NÃO branco — destaque máximo)
  Uppercase se ≤ 4 palavras; title-case se > 4 palavras
  Margem esquerda: 76px | Margem direita: 76px

③ SUBTÍTULO: "${sl.subtitulo}"
  Font: Bricolage Grotesque 300 | 17px | line-height: 1.55
  Cor: rgba(255,255,255,0.88)
  Espaço do título: 16px
  Margem esquerda: 76px | Largura máxima: 928px (CW − 2×76px)
${sl.cta ? `
④ CTA: "${sl.cta}"
  Font: Bricolage Grotesque 700 | 12px | uppercase | tracking: 1.5px
  Background: ${accent} | Cor texto: #000000
  Padding: 12px 22px | border-radius: 8px
  Posição: alinhado à ESQUERDA (76px) | espaço do subtítulo: 20px
  NÃO colocar no canto direito — alinhado com o texto` : ''}

── REGRAS DE COMPOSIÇÃO ────────────
- Título sempre em ${accent} — nunca branco puro para o título principal
- Subtítulo sempre em branco/quase-branco — hierarquia clara com o título
- CTA alinhado à esquerda junto ao bloco de texto (não canto direito)
- Bloco de texto deve "respirar" — espaçamento generoso entre elementos
- Fundo da zona de texto: escuro o suficiente para o texto ser legível sem esforço
- Se não há pessoa na cena: zona de texto pode ser fundo quase-sólido (como slides 2, 4, 6, 7 das refs)
- Se há pessoa na cena: gradiente sobe pela figura preservando rosto (como slides 1, 3, 5, 8 das refs)

════════════════════════════════════`;
}
