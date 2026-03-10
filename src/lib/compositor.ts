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

function hexToRgb(hex: string): string | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)},${parseInt(r[2], 16)},${parseInt(r[3], 16)}` : null;
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
    // fallback silencioso
  }
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

  const PAD_X = Math.round(CW * 0.07);
  const PAD_Y = Math.round(CH * 0.055);

  const layoutObj = sl.layout as any;
  const accent: string = layoutObj?.accent ?? ACC[sl.light as LightKey] ?? "#c8ff00";
  const layoutPos: LayoutPosition = layoutObj?.layoutPos ?? "bottom-left";
  const accentRgb = hexToRgb(accent) ?? "200,255,0";

  // ── Tipografia — tamanhos maiores e proporcionais ──────────────
  const NUM_SIZE = Math.round(14 * F);
  const TTL_SIZE = Math.round(96 * F);
  const SUB_SIZE = Math.round(34 * F); // +30% — legível a distância
  const CTA_SIZE = Math.round(20 * F);

  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const tFont = `800 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`; // bold sem ser ultra-pesado
  const sFont = `400 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`; // regular
  const ctaFont = `700 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;

  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const tFont = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const sFont = `500 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const ctaFont = `800 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;

  return new Promise<Blob>((resolve) => {
    const doText = () => {
      // ── 1. GRADIENTE DE LEGIBILIDADE — suave, não opaco ─────────
      // Começa mais tarde e não chega a preto puro — mantém a foto viva
      let ov: CanvasGradient;
      if (layoutPos === "right") {
        ov = ctx.createLinearGradient(CW * 0.38, 0, CW, 0);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.18, "rgba(0,0,0,0.30)");
        ov.addColorStop(0.55, "rgba(0,0,0,0.72)");
        ov.addColorStop(1, "rgba(0,0,0,0.88)");
      } else if (layoutPos === "left") {
        ov = ctx.createLinearGradient(CW * 0.62, 0, 0, 0);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.18, "rgba(0,0,0,0.30)");
        ov.addColorStop(0.55, "rgba(0,0,0,0.72)");
        ov.addColorStop(1, "rgba(0,0,0,0.88)");
      } else if (layoutPos === "top-center") {
        ov = ctx.createLinearGradient(0, 0, 0, CH * 0.5);
        ov.addColorStop(0, "rgba(0,0,0,0.90)");
        ov.addColorStop(0.4, "rgba(0,0,0,0.50)");
        ov.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        // bottom-left / bottom-center / split-bottom / center
        // Gradiente começa na metade — foto respira até lá
        ov = ctx.createLinearGradient(0, CH * 0.38, 0, CH);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.28, "rgba(0,0,0,0.32)");
        ov.addColorStop(0.58, "rgba(0,0,0,0.68)");
        ov.addColorStop(1, "rgba(0,0,0,0.88)");
      }
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      // ── 2. CAMADA DE COR AMBIENTE — accent contamina as sombras ─
      // Simula o efeito de luz colorida da cena tocando a zona escura
      let accentOv: CanvasGradient;
      if (layoutPos === "right") {
        accentOv = ctx.createLinearGradient(CW * 0.55, 0, CW, 0);
      } else if (layoutPos === "left") {
        accentOv = ctx.createLinearGradient(CW * 0.45, 0, 0, 0);
      } else if (layoutPos === "top-center") {
        accentOv = ctx.createLinearGradient(0, 0, 0, CH * 0.42);
      } else {
        accentOv = ctx.createLinearGradient(0, CH * 0.5, 0, CH);
      }
      accentOv.addColorStop(0, `rgba(${accentRgb},0)`);
      accentOv.addColorStop(0.55, `rgba(${accentRgb},0.05)`);
      accentOv.addColorStop(1, `rgba(${accentRgb},0.12)`);
      ctx.fillStyle = accentOv;
      ctx.fillRect(0, 0, CW, CH);

      // ── 3. ZONA E LARGURA DO BLOCO DE TEXTO ─────────────────────
      const isHorizontal = layoutPos === "right" || layoutPos === "left";
      const textW = isHorizontal ? CW * 0.46 - PAD_X : CW - PAD_X * 2;
      const textX = layoutPos === "right" ? CW * 0.54 : PAD_X;

      // ── 4. MEDIR LINHAS ──────────────────────────────────────────
      const tLines = wrapTxt(ctx, sl.titulo, tFont, textW, 3);
      const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, sFont, textW, 3) : [];

      const tLH = TTL_SIZE * F * 0.96;
      const sLH = SUB_SIZE * F * 1.5;
      const GAP_TS = 32 * F; // mais respiro entre título e subtítulo
      const GAP_SC = 28 * F;
      const CTA_H = sl.cta ? 56 * F : 0; // pílula maior
      const CTA_GAP = sl.cta ? GAP_SC : 0;

      const BLOCK_H =
        tLines.length * tLH + (sLines.length ? GAP_TS + sLines.length * sLH : 0) + (sl.cta ? CTA_GAP + CTA_H : 0);

      // ── 5. Y INICIAL POR LAYOUTPOS ───────────────────────────────
      let ty: number;
      if (layoutPos === "top-center") {
        ty = PAD_Y * 2;
      } else if (isHorizontal) {
        ty = CH * 0.3;
      } else {
        ty = CH - PAD_Y * 1.4 - BLOCK_H;
      }

      // ── 6. NÚMERO DO SLIDE ───────────────────────────────────────
      ctx.save();
      ctx.font = numFont;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8 * F;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.textBaseline = "top";
      ctx.fillText(sl.num, PAD_X, PAD_Y);
      ctx.textBaseline = "alphabetic";
      ctx.restore();

      // ── 7. TÍTULO — shadow direcional + glow na linha accent ─────
      ctx.font = tFont;
      tLines.forEach((ln, idx) => {
        const isAccentLine = idx === tLines.length - 1;

        if (isAccentLine) {
          // Passada 1: glow difuso — cria o halo da luz da cena
          ctx.save();
          ctx.shadowColor = accent;
          ctx.shadowBlur = 55 * F;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 6 * F;
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = accent;
          ctx.fillText(ln, textX, ty);
          ctx.restore();

          // Passada 2: texto nítido por cima
          ctx.save();
          ctx.shadowColor = `rgba(${accentRgb},0.4)`;
          ctx.shadowBlur = 20 * F;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3 * F;
          ctx.fillStyle = accent;
          ctx.fillText(ln, textX, ty);
          ctx.restore();
        } else {
          // Linhas brancas: drop shadow direcional sutil
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.80)";
          ctx.shadowBlur = 22 * F;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4 * F;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(ln, textX, ty);
          ctx.restore();
        }

        ty += tLH;
      });

      // ── 8. SUBTÍTULO — maior, shadow suave, tint de cena ────────
      if (sLines.length) {
        ty += GAP_TS;
        ctx.font = sFont;
        sLines.forEach((ln) => {
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.70)";
          ctx.shadowBlur = 16 * F;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3 * F;
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.fillText(ln, textX, ty);
          ctx.restore();
          ty += sLH;
        });
      }

      // ── 9. CTA — pílula premium com glow, highlight e sombra ────
      if (sl.cta) {
  ty += CTA_GAP;
  ctx.font = ctaFont;

  const ICON_W   = 32 * F;   // largura reservada para o ícone
  const ICON_GAP = 12 * F;
  const PAD_L    = 28 * F;
  const PAD_R    = 20 * F;

  const textMetrics = ctx.measureText(sl.cta);
  const ctaW = PAD_L + textMetrics.width + ICON_GAP + ICON_W + PAD_R;
  const ctaH = 58 * F;
  const cx   = textX;
  const cy   = ty;

  // Sombra projetada colorida
  ctx.save();
  ctx.shadowColor   = `rgba(${accentRgb},0.55)`;
  ctx.shadowBlur    = 36 * F;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8 * F;
  ctx.fillStyle = accent;
  rrect(ctx, cx, cy, ctaW, ctaH, 30 * F);
  ctx.fill();
  ctx.restore();

  // Fill limpo
  ctx.fillStyle = accent;
  rrect(ctx, cx, cy, ctaW, ctaH, 30 * F);
  ctx.fill();

  // Highlight chanfro
  const hl = ctx.createLinearGradient(cx, cy, cx, cy + ctaH * 0.55);
  hl.addColorStop(0,   "rgba(255,255,255,0.28)");
  hl.addColorStop(0.5, "rgba(255,255,255,0.06)");
  hl.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  rrect(ctx, cx, cy, ctaW, ctaH * 0.55, 30 * F);
  ctx.fill();

  // Borda sutil
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth   = 1.5 * F;
  rrect(ctx, cx, cy, ctaW, ctaH, 30 * F);
  ctx.stroke();
  ctx.restore();

  // Texto do CTA
  ctx.save();
  ctx.font          = ctaFont;
  ctx.shadowColor   = "rgba(0,0,0,0.30)";
  ctx.shadowBlur    = 5 * F;
  ctx.shadowOffsetY = 1 * F;
  ctx.fillStyle     = "#000000";
  ctx.textBaseline  = "middle";
  ctx.fillText(sl.cta, cx + PAD_L, cy + ctaH * 0.5);
  ctx.textBaseline  = "alphabetic";
  ctx.restore();

  // Ícone — círculo escuro semitransparente + seta →
  const iconCX = cx + PAD_L + textMetrics.width + ICON_GAP + ICON_W * 0.5;
  const iconCY = cy + ctaH * 0.5;
  const iconR  = ICON_W * 0.42;

  // Fundo do ícone
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Seta →  desenhada com linhas
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth   = 2.2 * F;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  const aW = iconR * 0.55;  // metade do comprimento da seta
  const aH = iconR * 0.45;  // altura das pontas
  ctx.beginPath();
  ctx.moveTo(iconCX - aW, iconCY);
  ctx.lineTo(iconCX + aW, iconCY);
  ctx.moveTo(iconCX + aW - aH * 0.8, iconCY - aH);
  ctx.lineTo(iconCX + aW, iconCY);
  ctx.lineTo(iconCX + aW - aH * 0.8, iconCY + aH);
  ctx.stroke();
  ctx.restore();
}

    // ── Fallback: sem imagem da IA ─────────────────────────────────
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

    // ── Fluxo principal ────────────────────────────────────────────
    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CW, CH);
        doText();
      
        // Upscale 4K: renderiza num canvas 2x maior com ImageBitmap de alta qualidade
        createImageBitmap(canvas, {
          resizeWidth:   CW * 2,
          resizeHeight:  CH * 2,
          resizeQuality: "high",
        }).then((bmp) => {
          const up = document.createElement("canvas");
          up.width  = CW * 2;
          up.height = CH * 2;
          const uc = up.getContext("2d")!;
          uc.imageSmoothingEnabled  = true;
          uc.imageSmoothingQuality  = "high";
          uc.drawImage(bmp, 0, 0);
          bmp.close();
          up.toBlob((b) => resolve(b!), "image/png", 1.0);
        }).catch(() => {
          // fallback sem upscale se o browser não suportar
          canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
        });
      };
      img.onerror = () => drawFallback();
      img.src = imgSrc;
    } else {
      drawFallback();
    }
  });
}
