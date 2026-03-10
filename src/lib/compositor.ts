import type { ProcessedSlide, LightKey, LayoutPosition } from "./parser";

// ─── TEXT WRAPPING ────────────────────────────────────────────
function wrapTxt(ctx: CanvasRenderingContext2D, txt: string, font: string, maxW: number, maxL: number): string[] {
  ctx.font = font;
  const words = txt.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      if (lines.length >= maxL) {
        lines[lines.length - 1] += "…";
        return lines;
      }
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
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

const DIM: Record<string, [number, number]> = {
  "4:5": [1080, 1350],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

const ACC: Record<LightKey, string> = {
  dramatic: "#00b4ff",
  warm: "#f5c842",
  green: "#c8ff00",
  moody: "#ffffff",
};

// ─── GRADIENT OVERLAYS PER LAYOUT ─────────────────────────────
function drawOverlay(ctx: CanvasRenderingContext2D, CW: number, CH: number, pos: LayoutPosition) {
  switch (pos) {
    case 'bottom-left':
    case 'bottom-center':
    case 'split-bottom': {
      const ov = ctx.createLinearGradient(0, CH * 0.25, 0, CH);
      ov.addColorStop(0, "rgba(0,0,0,0)");
      ov.addColorStop(0.35, "rgba(0,0,0,0.40)");
      ov.addColorStop(0.65, "rgba(0,0,0,0.82)");
      ov.addColorStop(1, "rgba(0,0,0,0.95)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);
      break;
    }
    case 'top-center': {
      const ov = ctx.createLinearGradient(0, 0, 0, CH * 0.55);
      ov.addColorStop(0, "rgba(0,0,0,0.92)");
      ov.addColorStop(0.5, "rgba(0,0,0,0.70)");
      ov.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);
      // subtle bottom vignette too
      const ov2 = ctx.createLinearGradient(0, CH * 0.85, 0, CH);
      ov2.addColorStop(0, "rgba(0,0,0,0)");
      ov2.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = ov2;
      ctx.fillRect(0, 0, CW, CH);
      break;
    }
    case 'right': {
      // Right side gradient
      const ov = ctx.createLinearGradient(CW * 0.35, 0, CW, 0);
      ov.addColorStop(0, "rgba(0,0,0,0)");
      ov.addColorStop(0.4, "rgba(0,0,0,0.45)");
      ov.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);
      // Bottom vignette
      const ov2 = ctx.createLinearGradient(0, CH * 0.8, 0, CH);
      ov2.addColorStop(0, "rgba(0,0,0,0)");
      ov2.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = ov2;
      ctx.fillRect(0, 0, CW, CH);
      break;
    }
    case 'left': {
      const ov = ctx.createLinearGradient(CW * 0.65, 0, 0, 0);
      ov.addColorStop(0, "rgba(0,0,0,0)");
      ov.addColorStop(0.4, "rgba(0,0,0,0.45)");
      ov.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);
      const ov2 = ctx.createLinearGradient(0, CH * 0.8, 0, CH);
      ov2.addColorStop(0, "rgba(0,0,0,0)");
      ov2.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = ov2;
      ctx.fillRect(0, 0, CW, CH);
      break;
    }
    case 'center': {
      // Uniform dark overlay
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, CW, CH);
      // radial vignette
      const ov = ctx.createRadialGradient(CW / 2, CH / 2, CW * 0.2, CW / 2, CH / 2, CW * 0.8);
      ov.addColorStop(0, "rgba(0,0,0,0)");
      ov.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);
      break;
    }
  }
}

// ─── TEXT RENDERING PER LAYOUT ────────────────────────────────
function drawText(
  ctx: CanvasRenderingContext2D,
  sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  pos: LayoutPosition,
  accent: string,
) {
  const PAD_X = Math.round(CW * 0.07);
  const PAD_Y = Math.round(CH * 0.06);

  // ① Slide number — always top-left
  ctx.font = `700 ${Math.round(13 * F)}px 'Bricolage Grotesque', sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.textBaseline = "top";
  ctx.textAlign = "start";
  ctx.fillText(sl.num, PAD_X, PAD_Y);
  ctx.textBaseline = "alphabetic";

  switch (pos) {
    case 'bottom-left':
      drawBottomLeft(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent);
      break;
    case 'bottom-center':
      drawBottomCenter(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent);
      break;
    case 'right':
      drawSideText(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent, 'right');
      break;
    case 'left':
      drawSideText(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent, 'left');
      break;
    case 'top-center':
      drawTopCenter(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent);
      break;
    case 'center':
      drawCenter(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent);
      break;
    case 'split-bottom':
      drawSplitBottom(ctx, sl, CW, CH, F, PAD_X, PAD_Y, accent);
      break;
  }
}

// ─── LAYOUT: BOTTOM-LEFT ──────────────────────────────────────
function drawBottomLeft(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  PAD_X: number, PAD_Y: number, accent: string,
) {
  const MAXW = CW - PAD_X * 2;
  const titleFont = `900 italic ${Math.round(46 * F)}px 'Bricolage Grotesque', sans-serif`;
  const subFont = `400 ${Math.round(17 * F)}px 'Bricolage Grotesque', sans-serif`;

  const tLines = wrapTxt(ctx, sl.titulo.toUpperCase(), titleFont, MAXW, 3);
  const tLH = 46 * F * 1.08;
  const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, subFont, MAXW, 4) : [];
  const sLH = 17 * F * 1.55;

  const CTAH = sl.cta ? 42 * F : 0;
  const CTA_GAP = sl.cta ? 20 * F : 0;
  const SUB_GAP = sLines.length ? 16 * F : 0;
  const BLKH = tLines.length * tLH + SUB_GAP + sLines.length * sLH;

  let ty = CH - PAD_Y - CTAH - CTA_GAP - BLKH;

  // Title in accent color
  ctx.font = titleFont;
  ctx.fillStyle = accent;
  ctx.textAlign = "start";
  tLines.forEach((ln) => { ctx.fillText(ln, PAD_X, ty); ty += tLH; });

  // Subtitle in white
  if (sLines.length) {
    ty += SUB_GAP;
    ctx.font = subFont;
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    sLines.forEach((ln) => { ctx.fillText(ln, PAD_X, ty); ty += sLH; });
  }

  // CTA
  drawCTA(ctx, sl, F, PAD_X, CH - PAD_Y, accent, 'start');
}

// ─── LAYOUT: BOTTOM-CENTER ───────────────────────────────────
function drawBottomCenter(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  PAD_X: number, PAD_Y: number, accent: string,
) {
  const MAXW = CW - PAD_X * 2;
  const titleFont = `900 italic ${Math.round(48 * F)}px 'Bricolage Grotesque', sans-serif`;
  const subFont = `400 ${Math.round(17 * F)}px 'Bricolage Grotesque', sans-serif`;

  const tLines = wrapTxt(ctx, sl.titulo.toUpperCase(), titleFont, MAXW, 3);
  const tLH = 48 * F * 1.08;
  const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, subFont, MAXW * 0.9, 5) : [];
  const sLH = 17 * F * 1.55;

  const CTAH = sl.cta ? 42 * F : 0;
  const CTA_GAP = sl.cta ? 20 * F : 0;
  const SUB_GAP = sLines.length ? 14 * F : 0;
  const BLKH = tLines.length * tLH + SUB_GAP + sLines.length * sLH;

  let ty = CH - PAD_Y - CTAH - CTA_GAP - BLKH;

  // Title centered in accent
  ctx.font = titleFont;
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  tLines.forEach((ln) => { ctx.fillText(ln, CW / 2, ty); ty += tLH; });

  // Subtitle centered
  if (sLines.length) {
    ty += SUB_GAP;
    ctx.font = subFont;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.textAlign = "center";
    sLines.forEach((ln) => { ctx.fillText(ln, CW / 2, ty); ty += sLH; });
  }

  // CTA centered
  if (sl.cta) {
    const cf = `700 ${Math.round(11 * F)}px 'Bricolage Grotesque', sans-serif`;
    ctx.font = cf;
    ctx.textAlign = "start";
    const cw = ctx.measureText(sl.cta.toUpperCase()).width + 40 * F;
    const ch = 38 * F;
    const cx = (CW - cw) / 2;
    const cy = CH - PAD_Y - ch;
    ctx.fillStyle = accent;
    rrect(ctx, cx, cy, cw, ch, 8 * F);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText(sl.cta.toUpperCase(), CW / 2, cy + ch * 0.65);
  }
  ctx.textAlign = "start";
}

// ─── LAYOUT: SIDE (RIGHT or LEFT) ────────────────────────────
function drawSideText(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  PAD_X: number, PAD_Y: number, accent: string,
  side: 'left' | 'right',
) {
  const halfW = CW * 0.45;
  const MAXW = halfW - PAD_X;
  const startX = side === 'right' ? CW * 0.52 : PAD_X;

  const titleFont = `900 italic ${Math.round(50 * F)}px 'Bricolage Grotesque', sans-serif`;
  const subFont = `400 ${Math.round(16 * F)}px 'Bricolage Grotesque', sans-serif`;

  const tLines = wrapTxt(ctx, sl.titulo.toUpperCase(), titleFont, MAXW, 4);
  const tLH = 50 * F * 1.05;
  const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, subFont, MAXW, 5) : [];
  const sLH = 16 * F * 1.55;

  // Vertically center the text block
  const SUB_GAP = sLines.length ? 20 * F : 0;
  const CTA_H = sl.cta ? 55 * F : 0;
  const totalH = tLines.length * tLH + SUB_GAP + sLines.length * sLH + CTA_H;
  let ty = Math.max(PAD_Y + 60 * F, (CH - totalH) / 2);

  // Title
  ctx.font = titleFont;
  ctx.fillStyle = accent;
  ctx.textAlign = "start";
  tLines.forEach((ln) => { ctx.fillText(ln, startX, ty); ty += tLH; });

  // Subtitle
  if (sLines.length) {
    ty += SUB_GAP;
    ctx.font = subFont;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    sLines.forEach((ln) => { ctx.fillText(ln, startX, ty); ty += sLH; });
  }

  // CTA
  if (sl.cta) {
    drawCTA(ctx, sl, F, startX, ty + 28 * F, accent, 'start');
  }
}

// ─── LAYOUT: TOP-CENTER ──────────────────────────────────────
function drawTopCenter(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  PAD_X: number, PAD_Y: number, accent: string,
) {
  const MAXW = CW - PAD_X * 2;
  const titleFont = `900 italic ${Math.round(50 * F)}px 'Bricolage Grotesque', sans-serif`;
  const subFont = `400 ${Math.round(17 * F)}px 'Bricolage Grotesque', sans-serif`;

  const tLines = wrapTxt(ctx, sl.titulo.toUpperCase(), titleFont, MAXW, 3);
  const tLH = 50 * F * 1.05;
  const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, subFont, MAXW * 0.9, 4) : [];
  const sLH = 17 * F * 1.55;

  let ty = PAD_Y + 50 * F;

  // Title centered
  ctx.font = titleFont;
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  tLines.forEach((ln) => { ctx.fillText(ln, CW / 2, ty); ty += tLH; });

  // Subtitle centered
  if (sLines.length) {
    ty += 18 * F;
    ctx.font = subFont;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.textAlign = "center";
    sLines.forEach((ln) => { ctx.fillText(ln, CW / 2, ty); ty += sLH; });
  }

  // CTA centered
  if (sl.cta) {
    const cf = `700 ${Math.round(11 * F)}px 'Bricolage Grotesque', sans-serif`;
    ctx.font = cf;
    ctx.textAlign = "start";
    const cw = ctx.measureText(sl.cta.toUpperCase()).width + 40 * F;
    const ch = 38 * F;
    const cx = (CW - cw) / 2;
    const cy = ty + 20 * F;
    ctx.fillStyle = accent;
    rrect(ctx, cx, cy, cw, ch, 8 * F);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.fillText(sl.cta.toUpperCase(), CW / 2, cy + ch * 0.65);
  }
  ctx.textAlign = "start";
}

// ─── LAYOUT: CENTER ──────────────────────────────────────────
function drawCenter(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  PAD_X: number, PAD_Y: number, accent: string,
) {
  const MAXW = CW - PAD_X * 2;
  const titleFont = `900 italic ${Math.round(48 * F)}px 'Bricolage Grotesque', sans-serif`;
  const subFont = `400 ${Math.round(17 * F)}px 'Bricolage Grotesque', sans-serif`;

  const tLines = wrapTxt(ctx, sl.titulo.toUpperCase(), titleFont, MAXW, 3);
  const tLH = 48 * F * 1.08;
  const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, subFont, MAXW * 0.85, 5) : [];
  const sLH = 17 * F * 1.55;

  const SUB_GAP = sLines.length ? 20 * F : 0;
  const totalH = tLines.length * tLH + SUB_GAP + sLines.length * sLH;
  let ty = (CH - totalH) / 2;

  ctx.font = titleFont;
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  tLines.forEach((ln) => { ctx.fillText(ln, CW / 2, ty); ty += tLH; });

  if (sLines.length) {
    ty += SUB_GAP;
    ctx.font = subFont;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.textAlign = "center";
    sLines.forEach((ln) => { ctx.fillText(ln, CW / 2, ty); ty += sLH; });
  }
  ctx.textAlign = "start";
}

// ─── LAYOUT: SPLIT-BOTTOM (2 columns) ────────────────────────
function drawSplitBottom(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  CW: number, CH: number, F: number,
  PAD_X: number, PAD_Y: number, accent: string,
) {
  const colW = (CW - PAD_X * 3) / 2;
  const titleFont = `900 italic ${Math.round(42 * F)}px 'Bricolage Grotesque', sans-serif`;
  const subFont = `400 ${Math.round(16 * F)}px 'Bricolage Grotesque', sans-serif`;

  // Left column: title
  const tLines = wrapTxt(ctx, sl.titulo.toUpperCase(), titleFont, colW, 5);
  const tLH = 42 * F * 1.05;
  
  // Right column: subtitle
  const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, subFont, colW, 8) : [];
  const sLH = 16 * F * 1.55;

  // Draw a vertical divider line
  const divX = PAD_X + colW + PAD_X * 0.5;
  const blockTop = CH - PAD_Y - Math.max(tLines.length * tLH, sLines.length * sLH) - 20 * F;

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2 * F;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(divX, blockTop);
  ctx.lineTo(divX, CH - PAD_Y);
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // Title (left column)
  let ty = blockTop;
  ctx.font = titleFont;
  ctx.fillStyle = accent;
  ctx.textAlign = "start";
  tLines.forEach((ln) => { ctx.fillText(ln, PAD_X, ty); ty += tLH; });

  // Subtitle (right column)
  let sy = blockTop;
  ctx.font = subFont;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  const rightX = divX + PAD_X * 0.5;
  sLines.forEach((ln) => { ctx.fillText(ln, rightX, sy); sy += sLH; });
}

// ─── CTA BUTTON HELPER ───────────────────────────────────────
function drawCTA(
  ctx: CanvasRenderingContext2D, sl: ProcessedSlide,
  F: number, x: number, bottomY: number,
  accent: string, align: 'start' | 'center',
) {
  if (!sl.cta) return;
  const cf = `700 ${Math.round(11 * F)}px 'Bricolage Grotesque', sans-serif`;
  ctx.font = cf;
  ctx.textAlign = "start";
  const ctaText = sl.cta.toUpperCase();
  const cw = ctx.measureText(ctaText).width + 40 * F;
  const ch = 38 * F;
  const cy = bottomY - ch;
  ctx.fillStyle = accent;
  rrect(ctx, x, cy, cw, ch, 8 * F);
  ctx.fill();
  ctx.fillStyle = "#000000";
  ctx.fillText(ctaText, x + 20 * F, cy + ch * 0.65);
}

// ─── MAIN COMPOSE FUNCTION ───────────────────────────────────
export async function composeSlide(imgSrc: string | null, sl: ProcessedSlide, _faceB64: string): Promise<Blob> {
  const [W, H] = DIM[sl.fmt] || [1080, 1350];
  const SC = sl.res === "4K" ? 1 : 2;
  const CW = W * SC, CH = H * SC, F = SC;
  const accent = ACC[sl.light as LightKey] || "#c8ff00";
  const pos: LayoutPosition = sl.layoutPosition || 'bottom-left';

  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  return new Promise<Blob>((resolve) => {
    const doCompose = (bg: HTMLImageElement | null) => {
      if (bg) {
        ctx.drawImage(bg, 0, 0, CW, CH);
      } else {
        // Fallback dark gradient
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

        ctx.font = `400 ${Math.round(14 * F)}px 'Bricolage Grotesque', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.textAlign = "center";
        ctx.fillText("⚠ Image generation failed", CW / 2, CH * 0.35);
        ctx.textAlign = "start";
      }

      drawOverlay(ctx, CW, CH, pos);
      drawText(ctx, sl, CW, CH, F, pos, accent);
      canvas.toBlob((blob) => resolve(blob!), "image/png", 1.0);
    };

    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => doCompose(img);
      img.onerror = () => doCompose(null);
      img.src = imgSrc;
    } else {
      doCompose(null);
    }
  });
}
