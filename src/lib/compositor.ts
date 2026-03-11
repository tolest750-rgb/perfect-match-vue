import type { ProcessedSlide, LightKey } from "./parser";
import { visualHasTitleInImage } from "./prompts";
import type { TitleStyle } from "./prompts";

// ─────────────────────────────────────────────────────────────
// AI LAYOUT — interface + analyzeLayout embutido
// ─────────────────────────────────────────────────────────────

// focusZone = onde está o sujeito principal da imagem
// textZone  = onde o texto deve ir (oposto/complementar ao foco)
export type FocusZone =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center" // sujeito centralizado → texto embaixo centralizado
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type TextZone =
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "top-left"
  | "top-center"
  | "top-right"
  | "left-center"
  | "right-center";

export interface AILayout {
  focusZone: FocusZone; // onde está o sujeito
  textZone: TextZone; // onde o texto deve ficar
  gradientType: "bottom" | "top" | "left" | "right" | "radial-bottom" | "radial-top";
  gradientStart: number; // 0–1
  gradientMaxOpacity: number; // 0.55–0.92
  titleStyle: TitleStyle; // estilo tipográfico detectado
}

// Mapeamento focusZone → textZone
// Regra: sujeito centralizado → texto embaixo-center
//        sujeito em cima → texto embaixo
//        sujeito embaixo → texto em cima
//        sujeito esquerda → texto direita
//        sujeito direita → texto esquerda
const FOCUS_TO_TEXT: Record<FocusZone, TextZone> = {
  "top-left": "bottom-right",
  "top-center": "bottom-center",
  "top-right": "bottom-left",
  "center-left": "right-center",
  center: "bottom-center",
  "center-right": "left-center",
  "bottom-left": "top-right",
  "bottom-center": "top-center",
  "bottom-right": "top-left",
};

const FOCUS_TO_GRADIENT: Record<FocusZone, AILayout["gradientType"]> = {
  "top-left": "radial-bottom",
  "top-center": "bottom",
  "top-right": "radial-bottom",
  "center-left": "right",
  center: "radial-bottom",
  "center-right": "left",
  "bottom-left": "top",
  "bottom-center": "top",
  "bottom-right": "top",
};

export const DEFAULT_LAYOUT: AILayout = {
  focusZone: "center",
  textZone: "bottom-center",
  gradientType: "bottom",
  gradientStart: 0.42,
  gradientMaxOpacity: 0.84,
  titleStyle: "default",
};

export async function analyzeLayout(
  imageBase64: string,
  titulo: string,
  subtitulo: string,
  hasCta: boolean,
  fmt: string,
  titleStyleHint: TitleStyle,
): Promise<AILayout> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");

    const { data, error } = await supabase.functions.invoke("analyze-layout", {
      body: {
        imageBase64,
        titulo,
        subtitulo,
        hasCta,
        fmt,
      },
    });

    if (error || !data) return { ...DEFAULT_LAYOUT, titleStyle: titleStyleHint };

    const p = data;
    const clamp = (v: number, min: number, max: number) =>
      isFinite(v) ? Math.min(max, Math.max(min, v)) : (min + max) / 2;

    const focusZone: FocusZone = (
      [
        "top-left",
        "top-center",
        "top-right",
        "center-left",
        "center",
        "center-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ] as FocusZone[]
    ).includes(p.focusZone)
      ? p.focusZone
      : "center";

    const textZone = FOCUS_TO_TEXT[focusZone];
    const gradientType = FOCUS_TO_GRADIENT[focusZone];

    return {
      focusZone,
      textZone,
      gradientType,
      gradientStart: clamp(p.gradientStart ?? 0.42, 0.25, 0.68),
      gradientMaxOpacity: clamp(p.gradientMaxOpacity ?? 0.82, 0.55, 0.88),
      titleStyle: titleStyleHint,
    };
  } catch {
    return { ...DEFAULT_LAYOUT, titleStyle: titleStyleHint };
  }
}

// ─────────────────────────────────────────────────────────────
// CANVAS HELPERS
// ─────────────────────────────────────────────────────────────

// Smart word wrap with intelligent line breaking
// Prioritizes breaking at natural phrase boundaries
function wrapTxt(ctx: CanvasRenderingContext2D, txt: string, font: string, maxW: number, maxL: number): string[] {
  ctx.font = font;
  const words = txt.split(" ");
  if (words.length <= 1) return [txt];

  // For 2-line layouts, try to break at midpoint for visual balance
  if (maxL === 2 && words.length >= 3) {
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(" ");
    const line2 = words.slice(mid).join(" ");
    if (ctx.measureText(line1).width <= maxW && ctx.measureText(line2).width <= maxW) {
      return [line1, line2];
    }
  }

  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      // Nunca trunca com "…" — continua quebrando em mais linhas
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  // Se mesmo assim ultrapassou maxL, retorna tudo (melhor vazar que cortar)
  return lines;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgb(hex: string): string | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : null;
}

function upscale2x(src: HTMLCanvasElement): HTMLCanvasElement {
  const up = document.createElement("canvas");
  up.width = src.width * 2;
  up.height = src.height * 2;
  const uc = up.getContext("2d")!;
  uc.imageSmoothingEnabled = true;
  uc.imageSmoothingQuality = "high";
  uc.drawImage(src, 0, 0, up.width, up.height);
  return up;
}

// ─────────────────────────────────────────────────────────────
// FONT LOADER
// ─────────────────────────────────────────────────────────────

let fontLoaded = false;
async function ensureFont() {
  if (fontLoaded) return;
  try {
    const font = new FontFace(
      "Bricolage Grotesque",
      "url(https://fonts.gstatic.com/s/bricolagegrotesque/v8/3y9U6as8bTXq_nANBjzKo3IeZx8z6up3BfSQCpTXABw.woff2)",
      { weight: "100 900", style: "normal" },
    );
    document.fonts.add(await font.load());
    fontLoaded = true;
  } catch {
    /* fallback silencioso */
  }
}

// ─────────────────────────────────────────────────────────────
// BRITTO* LOGO (base64 embutida)
// ─────────────────────────────────────────────────────────────

const BRITTO_LOGO_B64 =
  "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";

function drawLogo(ctx: CanvasRenderingContext2D, CW: number, CH: number, F: number): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const logoW = CW * 0.28;
      const logoH = logoW * (img.height / img.width);
      const PAD = CW * 0.055;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 28 * F;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, CW - logoW - PAD, CH - logoH - PAD * 0.9, logoW, logoH);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "data:image/jpeg;base64," + BRITTO_LOGO_B64;
  });
}

// ─────────────────────────────────────────────────────────────
// TITLE STYLE RENDERER
// ─────────────────────────────────────────────────────────────
// Cada estilo define como renderizar o título no canvas

interface TitleRenderParams {
  ctx: CanvasRenderingContext2D;
  lines: string[];
  startY: number;
  textX: number;
  align: CanvasTextAlign;
  TTL_SIZE: number;
  F: number;
  accent: string;
  accentRgb: string;
  CW: number;
  CH: number;
  lineHeight: number;
}

function renderTitleDefault(p: TitleRenderParams): number {
  const { ctx, lines, startY, textX, align, TTL_SIZE, F, accent, accentRgb, lineHeight } = p;
  const font = `800 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  ctx.font = font;
  let y = startY;
  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1;
    if (isLast) {
      ctx.save();
      ctx.textAlign = align;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 55 * F;
      ctx.shadowOffsetY = 6 * F;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = accent;
      ctx.fillText(ln, textX, y);
      ctx.restore();
      ctx.save();
      ctx.textAlign = align;
      ctx.shadowColor = `rgba(${accentRgb},0.4)`;
      ctx.shadowBlur = 20 * F;
      ctx.shadowOffsetY = 3 * F;
      ctx.fillStyle = accent;
      ctx.fillText(ln, textX, y);
      ctx.restore();
    } else {
      ctx.save();
      ctx.textAlign = align;
      ctx.shadowColor = "rgba(0,0,0,0.80)";
      ctx.shadowBlur = 22 * F;
      ctx.shadowOffsetY = 4 * F;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ln, textX, y);
      ctx.restore();
    }
    y += lineHeight;
  });
  return y;
}

// Estilo "TODO MUNDO ODEIA O CHRIS" — bloco bold amarelo/branco, outline preto forte, estilo sitcom 2000s
function renderTitleEverybodyHatesChris(p: TitleRenderParams): number {
  const { ctx, lines, startY, textX, align, TTL_SIZE, F, lineHeight, CW } = p;
  // Usa Impact-like look: peso 900, maiúsculo, outline preto grosso, fill branco/amarelo alternados
  const font = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  ctx.font = font;
  let y = startY;

  lines.forEach((ln, idx) => {
    const isLast = idx === lines.length - 1;
    const fillColor = isLast ? "#F9E000" : "#FFFFFF"; // última linha em amarelo sitcom

    ctx.save();
    ctx.textAlign = align;
    // Outline preto grosso (simula o look de título de série)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 12 * F;
    ctx.lineJoin = "round";
    ctx.strokeText(ln, textX, y);
    // Sombra dramática preta deslocada
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = 4 * F;
    ctx.shadowOffsetX = 5 * F;
    ctx.shadowOffsetY = 5 * F;
    ctx.fillStyle = fillColor;
    ctx.fillText(ln, textX, y);
    ctx.restore();

    // Linha de destaque — para a última linha, adiciona um sublinhado estilo grafite
    if (isLast) {
      ctx.save();
      ctx.textAlign = align;
      // Mede onde o texto vai para calcular o underline
      const measured = ctx.measureText(ln);
      const textWidth = measured.width;
      // Calcula x inicial dependendo do align
      let underX = textX;
      if (align === "center") underX = textX - textWidth / 2;
      else if (align === "right") underX = textX - textWidth;

      const underY = y + TTL_SIZE * F * 0.18;
      const underH = 6 * F;
      const underGrad = ctx.createLinearGradient(underX, underY, underX + textWidth, underY);
      underGrad.addColorStop(0, "#F9E000");
      underGrad.addColorStop(0.5, "#FFFF00");
      underGrad.addColorStop(1, "#F9E000");
      ctx.fillStyle = underGrad;
      ctx.fillRect(underX, underY, textWidth, underH);
      ctx.restore();
    }

    y += lineHeight;
  });
  return y;
}

// Estilo "Stranger Things" — neon vermelho, glow ITC Benguiat-like
function renderTitleStrangerThings(p: TitleRenderParams): number {
  const { ctx, lines, startY, textX, align, TTL_SIZE, F, lineHeight } = p;
  const font = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  ctx.font = font;
  let y = startY;
  lines.forEach((ln) => {
    ctx.save();
    ctx.textAlign = align;
    ctx.shadowColor = "#FF0000";
    ctx.shadowBlur = 40 * F;
    ctx.fillStyle = "#C00000";
    ctx.fillText(ln, textX, y);
    ctx.shadowColor = "#FF4444";
    ctx.shadowBlur = 15 * F;
    ctx.fillStyle = "#FF2222";
    ctx.fillText(ln, textX, y);
    ctx.restore();
    y += lineHeight;
  });
  return y;
}

// Breaking Bad — amarelo com borda de elemento periódico
function renderTitleBreakingBad(p: TitleRenderParams): number {
  const { ctx, lines, startY, textX, align, TTL_SIZE, F, lineHeight } = p;
  const font = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  ctx.font = font;
  let y = startY;
  lines.forEach((ln) => {
    ctx.save();
    ctx.textAlign = align;
    ctx.shadowColor = "#00FF00";
    ctx.shadowBlur = 20 * F;
    ctx.shadowOffsetY = 3 * F;
    ctx.fillStyle = "#FFD700";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 6 * F;
    ctx.strokeText(ln, textX, y);
    ctx.fillText(ln, textX, y);
    ctx.restore();
    y += lineHeight;
  });
  return y;
}

// Dispatcher: chama o renderer certo baseado no titleStyle
function renderTitle(style: TitleStyle, p: TitleRenderParams): number {
  switch (style) {
    case "everybody-hates-chris":
      return renderTitleEverybodyHatesChris(p);
    case "stranger-things":
      return renderTitleStrangerThings(p);
    case "breaking-bad":
      return renderTitleBreakingBad(p);
    // Para os demais estilos não implementados ainda, usa default
    default:
      return renderTitleDefault(p);
  }
}

// ─────────────────────────────────────────────────────────────
// LAYOUT GEOMETRY — converte textZone em coordenadas
// ─────────────────────────────────────────────────────────────

interface TextGeometry {
  align: CanvasTextAlign;
  anchorX: number; // x de referência para textAlign
  maxWidthRatio: number;
  blockTopY: number; // y inicial do bloco (calculado depois, usando blockH)
  isTop: boolean;
}

// ─────────────────────────────────────────────────────────────
// ANÁLISE DE IMAGEM: detecta melhor região para o texto
// Divide a imagem em 6 zonas e mede brightness + complexity (std-dev)
// Retorna a zona com mais "espaço limpo" (baixa complexidade, boa legibilidade)
// ─────────────────────────────────────────────────────────────
interface RegionScore {
  zone: "top" | "bottom";
  brightness: number; // 0–255 média de luminância
  complexity: number; // desvio padrão dos pixels (baixo = zona limpa)
  contrast: number; // contraste estimado (quanto o gradiente precisa forçar)
}

function analyzeImageRegions(
  ctx: CanvasRenderingContext2D,
  CW: number,
  CH: number,
): { bestZone: "top" | "bottom"; topScore: RegionScore; bottomScore: RegionScore } {
  // Amostra em resolução reduzida para performance (a cada 4 pixels)
  const STEP = 4;
  const ZONE_H = Math.round(CH * 0.32); // 32% superior e inferior

  const sampleRegion = (yStart: number, yEnd: number): RegionScore => {
    const data = ctx.getImageData(0, yStart, CW, yEnd - yStart).data;
    const lums: number[] = [];
    for (let i = 0; i < data.length; i += 4 * STEP) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      // Luminância perceptual (Rec.709)
      lums.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
    }
    const n = lums.length;
    const mean = lums.reduce((a, b) => a + b, 0) / n;
    const variance = lums.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    // Contraste estimado: quanto mais distante do meio (128), mais precisa de gradiente
    const contrastNeed = Math.abs(mean - 180) / 180; // texto branco → precisa de fundo escuro
    return {
      zone: yStart < CH / 2 ? "top" : "bottom",
      brightness: mean,
      complexity: stdDev,
      contrast: contrastNeed,
    };
  };

  const topScore = sampleRegion(0, ZONE_H);
  const bottomScore = sampleRegion(CH - ZONE_H, CH);

  // Score de "adequação para texto" (menor é melhor):
  // - alta complexidade = muitos detalhes = ruim para texto
  // - alta brightness = fundo claro = ruim para texto branco
  const scoreOf = (r: RegionScore) => r.complexity * 0.6 + r.brightness * 0.4;
  const bestZone = scoreOf(topScore) <= scoreOf(bottomScore) ? "top" : "bottom";

  return { bestZone, topScore, bottomScore };
}

function getTextGeometry(
  textZone: TextZone,
  CW: number,
  CH: number,
  PAD_X: number,
  PAD_Y: number,
  blockH: number,
): TextGeometry {
  const SIDE_MARGIN = PAD_X;
  const BOTTOM_PAD = PAD_Y * 1.4;
  const TOP_PAD = PAD_Y * 2.4; // abaixo do número de slide

  switch (textZone) {
    case "bottom-left":
      return {
        align: "left",
        anchorX: SIDE_MARGIN,
        maxWidthRatio: 0.88,
        blockTopY: CH - BOTTOM_PAD - blockH,
        isTop: false,
      };
    case "bottom-center":
      return {
        align: "center",
        anchorX: CW / 2,
        maxWidthRatio: 0.88,
        blockTopY: CH - BOTTOM_PAD - blockH,
        isTop: false,
      };
    case "bottom-right":
      return {
        align: "right",
        anchorX: CW - SIDE_MARGIN,
        maxWidthRatio: 0.88,
        blockTopY: CH - BOTTOM_PAD - blockH,
        isTop: false,
      };
    case "top-left":
      return {
        align: "left",
        anchorX: SIDE_MARGIN,
        maxWidthRatio: 0.88,
        blockTopY: TOP_PAD,
        isTop: true,
      };
    case "top-center":
      return {
        align: "center",
        anchorX: CW / 2,
        maxWidthRatio: 0.88,
        blockTopY: TOP_PAD,
        isTop: true,
      };
    case "top-right":
      return {
        align: "right",
        anchorX: CW - SIDE_MARGIN,
        maxWidthRatio: 0.88,
        blockTopY: TOP_PAD,
        isTop: true,
      };
    case "left-center":
      return {
        align: "left",
        anchorX: SIDE_MARGIN,
        maxWidthRatio: 0.44,
        blockTopY: (CH - blockH) / 2,
        isTop: false,
      };
    case "right-center":
      return {
        align: "right",
        anchorX: CW - SIDE_MARGIN,
        maxWidthRatio: 0.44,
        blockTopY: (CH - blockH) / 2,
        isTop: false,
      };
    default:
      return {
        align: "left",
        anchorX: SIDE_MARGIN,
        maxWidthRatio: 0.88,
        blockTopY: CH - BOTTOM_PAD - blockH,
        isTop: false,
      };
  }
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const DIM: Record<string, [number, number]> = {
  "4:5": [1080, 1350],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

const ACC: Record<LightKey, string> = {
  dramatic: "#00b4ff",
  warm: "#f5c842",
  green: "#c8ff00",
  moody: "#e0e0ff",
};

// ─────────────────────────────────────────────────────────────
// COMPOSE SLIDE — entry point
// ─────────────────────────────────────────────────────────────

export async function composeSlide(
  imgSrc: string | null,
  sl: ProcessedSlide,
  faceB64: string,
  aiLayout?: AILayout,
  isFirstOrLast?: boolean,
): Promise<Blob> {
  await ensureFont();

  const L = aiLayout ?? DEFAULT_LAYOUT;
  const titleInImage = visualHasTitleInImage(sl.visual ?? "");
  const [W, H] = DIM[sl.fmt] || [1080, 1350];
  const SC = sl.res === "4K" ? 1 : 2;
  const CW = W * SC,
    CH = H * SC,
    F = SC;

  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const PAD_X = Math.round(CW * 0.07);
  const PAD_Y = Math.round(CH * 0.055);

  const accent: string = (sl.layout as any)?.accent ?? ACC[sl.light as LightKey] ?? "#c8ff00";
  const accentRgb = hexToRgb(accent) ?? "200,255,0";

  // ── Tipografia Inteligente ─────────────────────────────────
  const NUM_SIZE = Math.round(14 * F);
  const CTA_SIZE = Math.round(20 * F);

  // Tamanho dinâmico do título baseado no número de caracteres + número de palavras
  const titleLen = (sl.titulo ?? "").length;
  const titleWords = (sl.titulo ?? "").split(/\s+/).length;
  // Títulos curtos e impactantes = maiores. Longos = menores mas legíveis.
  const TTL_SIZE = Math.round(
    (titleLen <= 12
      ? 110
      : titleLen <= 20
        ? 96
        : titleLen <= 30
          ? 80
          : titleLen <= 45
            ? 66
            : titleLen <= 60
              ? 54
              : 46) * F,
  );

  // Subtítulo: proporcional mas com teto
  const SUB_SIZE = Math.round(Math.min(38, Math.max(26, TTL_SIZE * 0.38)) * F);

  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const tFont = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const sFont = `300 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const ctaFont = `700 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;

  // Line height dinâmico: títulos curtos = mais apertado (impacto), longos = mais respiro
  const tLH = TTL_SIZE * (titleWords <= 3 ? 1.05 : titleWords <= 5 ? 1.0 : 0.92);
  const sLH = SUB_SIZE * 1.45;
  // Tracking: títulos curtos ganham mais tracking para presença
  const titleTracking = titleLen <= 15 ? 6 * F : titleLen <= 30 ? 2 * F : 0;

  const GAP_TS = Math.round((titleWords <= 3 ? 34 : 24) * F);
  const GAP_SC = 24 * F;
  const CTA_H = 58 * F;

  return new Promise<Blob>((resolve) => {
    const exportBlob = async () => {
      if (isFirstOrLast) await drawLogo(ctx, CW, CH, F);
      const out = upscale2x(canvas);
      out.toBlob((b) => resolve(b!), "image/png", 1.0);
    };

    const doText = () => {
      // ── 1. GRADIENTE DE LEGIBILIDADE ────────────────────
      // Analisa a imagem ANTES de qualquer overlay para decisões informadas
      const imgAnalysis = analyzeImageRegions(ctx, CW, CH);
      const regionForGrad = imgAnalysis.bestZone === "top" ? imgAnalysis.topScore : imgAnalysis.bottomScore;

      // Opacidade dinâmica: quanto mais claro/complexo o fundo, mais escuro o gradiente
      // brightness alta (>160) ou complexity alta (>55) → mais gradiente
      const dynamicOpacity = Math.min(
        0.96,
        Math.max(0.55, (regionForGrad.brightness / 255) * 0.55 + (regionForGrad.complexity / 80) * 0.45),
      );
      const mo = dynamicOpacity;
      const gs = L.gradientStart;
      let ov: CanvasGradient;

      // Direção do gradiente segue a zona de texto detectada
      const isTopZone = imgAnalysis.bestZone === "top";

      if (isTopZone) {
        // Gradiente de cima para baixo (cobre o topo)
        ov = ctx.createLinearGradient(0, 0, 0, CH * 0.52);
        ov.addColorStop(0, `rgba(0,0,0,${mo})`);
        ov.addColorStop(0.5, `rgba(0,0,0,${mo * 0.55})`);
        ov.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        // Gradiente de baixo para cima (cobre a base)
        ov = ctx.createLinearGradient(0, CH * gs, 0, CH);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.28, `rgba(0,0,0,${mo * 0.38})`);
        ov.addColorStop(0.6, `rgba(0,0,0,${mo * 0.78})`);
        ov.addColorStop(1, `rgba(0,0,0,${mo})`);
      }
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      // ── 2. COR AMBIENTE ─────────────────────────────────
      let ambOv: CanvasGradient;
      if (isTopZone) {
        ambOv = ctx.createLinearGradient(0, 0, 0, CH * 0.45);
      } else {
        ambOv = ctx.createLinearGradient(0, CH * (gs + 0.08), 0, CH);
      }
      ambOv.addColorStop(0, `rgba(${accentRgb},0)`);
      ambOv.addColorStop(0.6, `rgba(${accentRgb},0.05)`);
      ambOv.addColorStop(1, `rgba(${accentRgb},0.12)`);
      ctx.fillStyle = ambOv;
      ctx.fillRect(0, 0, CW, CH);

      // ── 3. NÚMERO DO SLIDE ──────────────────────────────
      ctx.save();
      ctx.font = numFont;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8 * F;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.textBaseline = "top";
      ctx.fillText(sl.num, PAD_X, PAD_Y);
      ctx.textBaseline = "alphabetic";
      ctx.restore();

      // ── 4. CALCULAR BLOCO DE TEXTO ──────────────────────
      // Alinhamento editorial: capa/encerramento → center | pares → left | ímpares → right
      const isLast = sl.n === sl.tot;
      const isFirst = sl.n === 1;
      const slideAlign: "left" | "center" | "right" = isFirst || isLast ? "center" : sl.n % 2 === 0 ? "left" : "right";

      // ── Análise da imagem: detecta se topo ou base tem mais espaço limpo
      const imgAnalysis = analyzeImageRegions(ctx, CW, CH);
      const bestV = imgAnalysis.bestZone; // "top" | "bottom"

      // Compõe textZone combinando análise vertical + regra editorial de alinhamento horizontal
      const textZone: TextZone =
        bestV === "top"
          ? slideAlign === "center"
            ? "top-center"
            : slideAlign === "left"
              ? "top-left"
              : "top-right"
          : slideAlign === "center"
            ? "bottom-center"
            : slideAlign === "left"
              ? "bottom-left"
              : "bottom-right";

      const mwRatio = 0.88;
      const maxTextW = CW * mwRatio;

      const tLines = (() => {
        ctx.font = tFont;
        return wrapTxt(ctx, sl.titulo, tFont, maxTextW, 3);
      })();
      const sLines = sl.subtitulo
        ? (() => {
            ctx.font = sFont;
            return wrapTxt(ctx, sl.subtitulo, sFont, maxTextW, 8);
          })()
        : [];

      // Mede CTA
      ctx.font = ctaFont;
      const ctaMetrics = sl.cta ? ctx.measureText(sl.cta) : null;
      const ICON_W = 32 * F;
      const ICON_GAP = 12 * F;
      const CTA_PAD_L = 28 * F;
      const CTA_PAD_R = 20 * F;
      const ctaPillW = ctaMetrics ? CTA_PAD_L + ctaMetrics.width + ICON_GAP + ICON_W + CTA_PAD_R : 0;

      const titleBlockH = tLines.length * tLH;
      const subBlockH = sLines.length > 0 ? GAP_TS + sLines.length * sLH : 0;
      const ctaBlockH = sl.cta ? GAP_SC + CTA_H : 0;
      const blockH = titleBlockH + subBlockH + ctaBlockH;

      // Geometria com align forçado pelo número do slide
      const geo = getTextGeometry(textZone, CW, CH, PAD_X, PAD_Y, blockH);
      // geo já contém align e anchorX corretos via textZone construída acima

      // ── 5. RENDERIZA TÍTULO (omite se título está na imagem) ─
      let curY = geo.blockTopY + tLH;

      if (!titleInImage) {
        ctx.font = tFont;
        renderTitle(L.titleStyle ?? "default", {
          ctx,
          lines: tLines,
          startY: curY,
          textX: geo.anchorX,
          align: geo.align,
          TTL_SIZE,
          F,
          accent,
          accentRgb,
          CW,
          CH,
          lineHeight: tLH,
        });
      }
      // Avança curY pelo número de linhas do título
      curY = geo.blockTopY + titleBlockH + sLH * 0.1;

      // ── 6. RENDERIZA SUBTÍTULO ──────────────────────────
      if (sLines.length > 0) {
        curY = geo.blockTopY + titleBlockH + GAP_TS + sLH;

        // Detecta palavras-chave para destaque: as mais longas e substantivas
        // Heurística: pega as 2-3 palavras com mais de 5 chars,
        // excluindo stopwords funcionais
        const SUB_STOPWORDS = new Set([
          "para",
          "porque",
          "quando",
          "onde",
          "como",
          "mais",
          "menos",
          "muito",
          "pouco",
          "uma",
          "uns",
          "umas",
          "que",
          "isso",
          "esse",
          "essa",
          "este",
          "esta",
          "aquele",
          "aquela",
          "pelo",
          "pela",
          "pelos",
          "pelas",
          "com",
          "sem",
          "por",
          "mas",
          "nem",
          "seu",
          "sua",
          "seus",
          "suas",
          "não",
          "sim",
          "sobre",
          "também",
          "ainda",
          "apenas",
          "tudo",
          "nada",
          "sempre",
          "nunca",
          "cada",
          "todo",
          "toda",
          "todos",
          "todas",
          "está",
          "são",
          "foi",
          "ser",
          "ter",
          "haver",
          "fazer",
          "poder",
          "the",
          "and",
          "for",
          "that",
          "this",
          "with",
          "from",
          "they",
          "them",
        ]);
        const subFullText = sl.subtitulo ?? "";
        const subWords = subFullText.split(/\s+/);
        // Candidatos: palavras longas que não são stopwords
        const candidates = subWords
          .filter((w) => w.replace(/[^a-záàãâéêíóôõúüçñA-Z]/g, "").length > 5)
          .filter((w) => !SUB_STOPWORDS.has(w.toLowerCase().replace(/[^a-záàãâéêíóôõúüçñ]/gi, "")))
          .sort((a, b) => b.length - a.length);
        // Pega até 3 palavras-chave únicas (sem repetir a mesma raiz)
        const keywords: Set<string> = new Set();
        for (const w of candidates) {
          const clean = w.toLowerCase().replace(/[^a-záàãâéêíóôõúüçñ]/gi, "");
          if (![...keywords].some((k) => clean.startsWith(k.slice(0, 5)) || k.startsWith(clean.slice(0, 5)))) {
            keywords.add(clean);
          }
          if (keywords.size >= 3) break;
        }

        const SUB_BOLD_SIZE = Math.round(SUB_SIZE * 1.08);
        const sBoldFont = `700 ${SUB_BOLD_SIZE}px 'Bricolage Grotesque', sans-serif`;

        // Renderiza cada linha word-by-word para permitir peso variável
        sLines.forEach((ln) => {
          const lineWords = ln.split(" ");
          // Calcula largura total da linha para ancoragem
          let totalW = 0;
          lineWords.forEach((w, wi) => {
            const clean = w.toLowerCase().replace(/[^a-záàãâéêíóôõúüçñ]/gi, "");
            const isKw = [...keywords].some((k) => clean.startsWith(k.slice(0, 5)) || k.startsWith(clean.slice(0, 5)));
            ctx.font = isKw ? sBoldFont : sFont;
            totalW += ctx.measureText(w).width;
            if (wi < lineWords.length - 1) {
              ctx.font = sFont;
              totalW += ctx.measureText(" ").width;
            }
          });

          // Ponto inicial conforme align
          let wx = geo.anchorX;
          if (geo.align === "center") wx = geo.anchorX - totalW / 2;
          else if (geo.align === "right") wx = geo.anchorX - totalW;

          lineWords.forEach((w, wi) => {
            const clean = w.toLowerCase().replace(/[^a-záàãâéêíóôõúüçñ]/gi, "");
            const isKw = [...keywords].some((k) => clean.startsWith(k.slice(0, 5)) || k.startsWith(clean.slice(0, 5)));
            ctx.save();
            ctx.textAlign = "left";
            ctx.shadowColor = "rgba(0,0,0,0.70)";
            ctx.shadowBlur = 16 * F;
            ctx.shadowOffsetY = 3 * F;
            if (isKw) {
              ctx.font = sBoldFont;
              ctx.fillStyle = accent; // destaque na cor accent do slide
              // sombra colorida leve atrás da palavra-chave
              ctx.shadowColor = `rgba(${accentRgb},0.4)`;
              ctx.shadowBlur = 14 * F;
            } else {
              ctx.font = sFont;
              ctx.fillStyle = "rgba(255,255,255,0.88)";
            }
            ctx.fillText(w, wx, curY);
            const wW = ctx.measureText(w).width;
            ctx.restore();

            wx += wW;
            if (wi < lineWords.length - 1) {
              ctx.font = sFont;
              wx += ctx.measureText(" ").width;
            }
          });

          curY += sLH;
        });
      }

      // ── 7. RENDERIZA CTA ────────────────────────────────
      if (sl.cta && ctaMetrics) {
        // CTA começa logo depois do subtítulo (ou título se não há sub)
        const ctaTopY = geo.blockTopY + titleBlockH + subBlockH + GAP_SC;
        const ctaCY = ctaTopY + CTA_H / 2; // centro vertical da pílula

        // X do CTA depende do align
        let ctaX = geo.anchorX;
        if (geo.align === "center") ctaX = geo.anchorX - ctaPillW / 2;
        else if (geo.align === "right") ctaX = geo.anchorX - ctaPillW;

        ctx.font = ctaFont;

        // Sombra colorida
        ctx.save();
        ctx.shadowColor = `rgba(${accentRgb},0.55)`;
        ctx.shadowBlur = 36 * F;
        ctx.shadowOffsetY = 8 * F;
        ctx.fillStyle = accent;
        rrect(ctx, ctaX, ctaTopY, ctaPillW, CTA_H, 30 * F);
        ctx.fill();
        ctx.restore();

        // Fill
        ctx.fillStyle = accent;
        rrect(ctx, ctaX, ctaTopY, ctaPillW, CTA_H, 30 * F);
        ctx.fill();

        // Highlight
        const hl = ctx.createLinearGradient(ctaX, ctaTopY, ctaX, ctaTopY + CTA_H * 0.55);
        hl.addColorStop(0, "rgba(255,255,255,0.28)");
        hl.addColorStop(0.5, "rgba(255,255,255,0.06)");
        hl.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = hl;
        rrect(ctx, ctaX, ctaTopY, ctaPillW, CTA_H * 0.55, 30 * F);
        ctx.fill();

        // Borda
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5 * F;
        rrect(ctx, ctaX, ctaTopY, ctaPillW, CTA_H, 30 * F);
        ctx.stroke();
        ctx.restore();

        // Texto do CTA
        ctx.save();
        ctx.font = ctaFont;
        ctx.shadowColor = "rgba(0,0,0,0.30)";
        ctx.shadowBlur = 5 * F;
        ctx.shadowOffsetY = 1 * F;
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";
        ctx.fillText(sl.cta, ctaX + CTA_PAD_L, ctaCY);
        ctx.textBaseline = "alphabetic";
        ctx.restore();

        // Ícone seta
        const iconCX = ctaX + CTA_PAD_L + ctaMetrics.width + ICON_GAP + ICON_W * 0.5;
        const iconCY_ = ctaCY;
        const iconR = ICON_W * 0.42;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.arc(iconCX, iconCY_, iconR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.2 * F;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const aW = iconR * 0.55,
          aH = iconR * 0.45;
        ctx.beginPath();
        ctx.moveTo(iconCX - aW, iconCY_);
        ctx.lineTo(iconCX + aW, iconCY_);
        ctx.moveTo(iconCX + aW - aH * 0.8, iconCY_ - aH);
        ctx.lineTo(iconCX + aW, iconCY_);
        ctx.lineTo(iconCX + aW - aH * 0.8, iconCY_ + aH);
        ctx.stroke();
        ctx.restore();
      }

      exportBlob();
    }; // fim doText

    // ── Fallback sem imagem ────────────────────────────────
    const drawFallback = () => {
      const GC: Record<string, [string, string]> = {
        dramatic: ["#030318", "#06103a"],
        warm: ["#100500", "#221000"],
        green: ["#010901", "#020f03"],
        moody: ["#080810", "#10101e"],
      };
      const colors = GC[sl.light] || ["#030318", "#06103a"];
      const grd = ctx.createLinearGradient(0, 0, 0, CH);
      grd.addColorStop(0, colors[0]);
      grd.addColorStop(1, colors[1]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, CW, CH);
      if (faceB64) {
        const fi = new Image();
        fi.onload = () => {
          const fh = CH * 0.55,
            fw = fh * (fi.width / fi.height);
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.drawImage(fi, (CW - fw) / 2, CH * 0.05, fw, fh);
          ctx.restore();
          doText();
        };
        fi.onerror = () => doText();
        fi.src = "data:image/jpeg;base64," + faceB64;
      } else {
        doText();
      }
    };

    // ── Fluxo principal ───────────────────────────────────
    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CW, CH);
        doText();
      };
      img.onerror = () => drawFallback();
      img.src = imgSrc;
    } else {
      drawFallback();
    }
  });
}
