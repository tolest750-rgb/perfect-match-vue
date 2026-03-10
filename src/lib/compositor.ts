import type { ProcessedSlide, LightKey, LayoutPosition } from "./parser";

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
  moody: "#e0e0ff",
};

// Carrega Bricolage Grotesque uma única vez
let fontLoaded = false;
async function ensureFont() {
  if (fontLoaded) return;
  try {
    const font = new FontFace(
      "Bricolage Grotesque",
      "url(https://fonts.gstatic.com/s/bricolagegrotesque/v8/3y9U6as8bTXq_nANBjzKo3IeZx8z6up3BfSQCpTXABw.woff2)",
      { weight: "100 900", style: "normal" },
    );
    const loaded = await font.load();
    document.fonts.add(loaded);
    fontLoaded = true;
  } catch {
    // fallback silencioso — usa sans-serif
  }
}

function hexToRgb(hex: string): string | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : null;
}

export async function composeSlide(imgSrc: string | null, sl: ProcessedSlide, faceB64: string): Promise<Blob> {
  await ensureFont();

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

  // Margens: 7% horizontal, 6% vertical
  const PAD_X = Math.round(CW * 0.07);
  const PAD_Y = Math.round(CH * 0.06);

  const layoutObj = sl.layout as any;
  const accent: string = layoutObj?.accent ?? ACC[sl.light as LightKey] ?? "#c8ff00";
  const layoutPos: LayoutPosition = layoutObj?.layoutPos ?? "bottom-left";

  // ── Tipografia ──────────────────────────────────────────────
  const NUM_SIZE = Math.round(13 * F);
  const TTL_SIZE = Math.round(88 * F);
  const SUB_SIZE = Math.round(18 * F);
  const CTA_SIZE = Math.round(12 * F);

  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const tFont = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const sFont = `400 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const ctaFont = `700 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;

  return new Promise<Blob>((resolve) => {
    const doText = () => {
      // ── Gradiente de legibilidade adaptado ao layoutPos ──────
      let ov: CanvasGradient;
      if (layoutPos === "right") {
        ov = ctx.createLinearGradient(CW * 0.42, 0, CW, 0);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.25, "rgba(0,0,0,0.45)");
        ov.addColorStop(0.65, "rgba(0,0,0,0.82)");
        ov.addColorStop(1, "rgba(0,0,0,0.93)");
      } else if (layoutPos === "left") {
        ov = ctx.createLinearGradient(CW * 0.58, 0, 0, 0);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.25, "rgba(0,0,0,0.45)");
        ov.addColorStop(0.65, "rgba(0,0,0,0.82)");
        ov.addColorStop(1, "rgba(0,0,0,0.93)");
      } else if (layoutPos === "top-center") {
        ov = ctx.createLinearGradient(0, 0, 0, CH * 0.52);
        ov.addColorStop(0, "rgba(0,0,0,0.97)");
        ov.addColorStop(0.45, "rgba(0,0,0,0.60)");
        ov.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        ov = ctx.createLinearGradient(0, CH * 0.25, 0, CH);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.3, "rgba(0,0,0,0.38)");
        ov.addColorStop(0.65, "rgba(0,0,0,0.78)");
        ov.addColorStop(1, "rgba(0,0,0,0.93)");
      }

ctx.fillStyle = ov;
ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = ov;
    ctx.fillRect(0, 0, CW, CH);

// Camada de cor ambiente — accent contamina o gradiente escuro
const accentRgb = hexToRgb(accent);
if (accentRgb) {
  let accentOv: CanvasGradient;
  if (layoutPos === "right") {
    accentOv = ctx.createLinearGradient(CW * 0.54, 0, CW, 0);
  } else if (layoutPos === "left") {
    accentOv = ctx.createLinearGradient(CW * 0.46, 0, 0, 0);
  } else if (layoutPos === "top-center") {
    accentOv = ctx.createLinearGradient(0, 0, 0, CH * 0.45);
  } else {
    accentOv = ctx.createLinearGradient(0, CH * 0.45, 0, CH);
  }
  accentOv.addColorStop(0, `rgba(${accentRgb},0)`);
  accentOv.addColorStop(0.6, `rgba(${accentRgb},0.06)`);
  accentOv.addColorStop(1, `rgba(${accentRgb},0.13)`);
  ctx.fillStyle = accentOv;
  ctx.fillRect(0, 0, CW, CH);
}
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      // ── Zona e largura do bloco de texto ────────────────────
      const isHorizontal = layoutPos === "right" || layoutPos === "left";
      const textW = isHorizontal ? CW * 0.46 - PAD_X : CW - PAD_X * 2;
      const textX = layoutPos === "right" ? CW * 0.54 : PAD_X;

      // ── Medir linhas ─────────────────────────────────────────
      const tLines = wrapTxt(ctx, sl.titulo, tFont, textW, 3);
      const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, sFont, textW, 4) : [];

      const tLH = TTL_SIZE * F * 0.98; // linhas coladas, igual à referência
      const sLH = SUB_SIZE * F * 1.55;
      const GAP_TS = 24 * F;
      const GAP_SC = 20 * F;
      const CTA_H = sl.cta ? 38 * F : 0;
      const CTA_GAP = sl.cta ? GAP_SC : 0;

      const BLOCK_H =
        tLines.length * tLH + (sLines.length ? GAP_TS + sLines.length * sLH : 0) + (sl.cta ? CTA_GAP + CTA_H : 0);

      // ── Y inicial por layoutPos ──────────────────────────────
      let ty: number;
      if (layoutPos === "top-center") {
        ty = PAD_Y * 2;
      } else if (isHorizontal) {
        ty = CH * 0.32; // começa em 32% — igual à referência
      } else {
        ty = CH - PAD_Y - BLOCK_H; // ancora no fundo
      }

      // ── Número do slide — topo esquerdo ─────────────────────
      ctx.font = tFont;
      tLines.forEach((ln, idx) => {
        const isAccentLine = idx === tLines.length - 1;

      if (isAccentLine) {
        // Glow difuso por baixo
        ctx.save();
        ctx.shadowColor = accent;
        ctx.shadowBlur = 38 * F;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4 * F;
        ctx.fillStyle = accent;
        ctx.fillText(ln, textX, ty);
        ctx.restore();
    
        // Segunda passada sem shadow — garante nitidez
        ctx.save();
        ctx.fillStyle = accent;
        ctx.fillText(ln, textX, ty);
        ctx.restore();
      } else {
        // Linhas brancas: drop shadow sutil direcional
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.75)";
        ctx.shadowBlur = 18 * F;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3 * F;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(ln, textX, ty);
        ctx.restore();
      }

  ty += tLH;
});

      // ── Subtítulo — branco suave ─────────────────────────────
      if (sLines.length) {
        ty += GAP_TS;
        ctx.font = sFont;
        sLines.forEach((ln) => {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.65)";
          ctx.shadowBlur = 12 * F;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 2 * F;
          ctx.fillStyle = "rgba(255,255,255,0.82)";
          ctx.fillText(ln, textX, ty);
          ctx.restore();
          ty += sLH;
        });
      }

      // ── CTA — pílula sólida accent, texto preto ──────────────
     if (sl.cta) {
      ty += CTA_GAP;
      ctx.font = ctaFont;
      const ctaW = ctx.measureText(sl.cta).width + 40 * F;
      const ctaH = 38 * F;
      const cx = textX;
      const cy = ty - ctaH * 0.82;
    
      // Sombra projetada do pill
      ctx.save();
      ctx.shadowColor = accent;
      ctx.shadowBlur = 28 * F;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 6 * F;
      ctx.fillStyle = accent;
      rrect(ctx, cx, cy, ctaW, ctaH, 22 * F);
      ctx.fill();
      ctx.restore();
    
      // Fill limpo por cima (sem shadow — evita borrão no texto interno)
      ctx.fillStyle = accent;
      rrect(ctx, cx, cy, ctaW, ctaH, 22 * F);
      ctx.fill();
    
      // Highlight de luz no topo do pill (reflexo)
      const pillHL = ctx.createLinearGradient(cx, cy, cx, cy + ctaH * 0.5);
      pillHL.addColorStop(0, "rgba(255,255,255,0.22)");
      pillHL.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = pillHL;
      rrect(ctx, cx, cy, ctaW, ctaH * 0.5, 22 * F);
      ctx.fill();
    
      // Texto do CTA
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 4 * F;
      ctx.shadowOffsetY = 1 * F;
      ctx.fillStyle = "#000000";
      ctx.fillText(sl.cta, cx + 20 * F, cy + ctaH * 0.65);
      ctx.restore();
    }

    // ── Fallback: sem imagem da IA ───────────────────────────────
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
          const fx = (CW - fw) / 2;
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.drawImage(fi, fx, CH * 0.05, fw, fh);
          ctx.restore();
          doText();
          canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
        };
        fi.onerror = () => {
          doText();
          canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
        };
        fi.src = "data:image/jpeg;base64," + faceB64;
      } else {
        doText();
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      }
    };

    // ── Fluxo principal ──────────────────────────────────────────
    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CW, CH);
        doText();
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      };
      img.onerror = () => drawFallback();
      img.src = imgSrc;
    } else {
      drawFallback();
    }
  });
}
