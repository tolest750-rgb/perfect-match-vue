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

// Cor de acento base por tema
const ACC: Record<LightKey, string> = {
  dramatic: "#00b4ff",
  warm: "#f5c842",
  green: "#c8ff00",
  moody: "#e0e0ff",
};

// Carrega a fonte Bricolage Grotesque do Google Fonts uma única vez
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

export async function composeSlide(imgSrc: string | null, sl: ProcessedSlide, faceB64: string): Promise<Blob> {
  // Garante que a fonte está carregada antes de desenhar
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

  // Acento do slide — vem do layout object ou fallback pelo light
  const layoutObj = sl.layout as any;
  const accent: string = layoutObj?.accent ?? ACC[sl.light as LightKey] ?? "#c8ff00";
  const layoutPos: LayoutPosition = layoutObj?.layoutPos ?? "bottom-left";

  // ── Tamanhos de fonte ────────────────────────────────────────
  const NUM_SIZE = Math.round(13 * F);
  const TTL_SIZE = Math.round(52 * F); // maior — mais próximo da referência
  const SUB_SIZE = Math.round(19 * F);
  const CTA_SIZE = Math.round(13 * F);

  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const tFont = `900 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const sFont = `400 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const ctaFont = `700 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;

  return new Promise<Blob>((resolve) => {
    const doText = () => {
      // ── Gradiente de legibilidade adaptado ao layoutPos ──────
      let ov: CanvasGradient;
      if (layoutPos === "right") {
        // Escurece da direita para o centro
        ov = ctx.createLinearGradient(CW * 0.42, 0, CW, 0);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.25, "rgba(0,0,0,0.50)");
        ov.addColorStop(0.65, "rgba(0,0,0,0.88)");
        ov.addColorStop(1, "rgba(0,0,0,0.97)");
      } else if (layoutPos === "left") {
        // Escurece da esquerda para o centro
        ov = ctx.createLinearGradient(CW * 0.58, 0, 0, 0);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.25, "rgba(0,0,0,0.50)");
        ov.addColorStop(0.65, "rgba(0,0,0,0.88)");
        ov.addColorStop(1, "rgba(0,0,0,0.97)");
      } else if (layoutPos === "top-center") {
        // Escurece do topo para baixo
        ov = ctx.createLinearGradient(0, 0, 0, CH * 0.52);
        ov.addColorStop(0, "rgba(0,0,0,0.97)");
        ov.addColorStop(0.45, "rgba(0,0,0,0.60)");
        ov.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        // bottom-left / bottom-center / split-bottom / center
        ov = ctx.createLinearGradient(0, CH * 0.25, 0, CH);
        ov.addColorStop(0, "rgba(0,0,0,0)");
        ov.addColorStop(0.3, "rgba(0,0,0,0.40)");
        ov.addColorStop(0.65, "rgba(0,0,0,0.80)");
        ov.addColorStop(1, "rgba(0,0,0,0.97)");
      }
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      // ── Zona e largura do texto ──────────────────────────────
      const isHorizontal = layoutPos === "right" || layoutPos === "left";
      const textW = isHorizontal ? CW * 0.46 - PAD_X : CW - PAD_X * 2;
      const textX =
        layoutPos === "right"
          ? CW * 0.54 // começa em 54% da largura
          : PAD_X; // esquerda padrão

      // ── Medir linhas ─────────────────────────────────────────
      const tLines = wrapTxt(ctx, sl.titulo, tFont, textW, 3);
      const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, sFont, textW, 4) : [];

      const tLH = TTL_SIZE * F * 1.08;
      const sLH = SUB_SIZE * F * 1.55;
      const GAP_TS = 18 * F;
      const GAP_SC = 22 * F;
      const CTA_H = sl.cta ? 44 * F : 0;
      const CTA_GAP = sl.cta ? GAP_SC : 0;

      const BLOCK_H =
        tLines.length * tLH + (sLines.length ? GAP_TS + sLines.length * sLH : 0) + (sl.cta ? CTA_GAP + CTA_H : 0);

      // ── Y inicial por layoutPos ──────────────────────────────
      let ty: number;
      if (layoutPos === "top-center") {
        ty = PAD_Y * 2;
      } else if (isHorizontal) {
        ty = (CH - BLOCK_H) / 2; // centraliza verticalmente
      } else {
        ty = CH - PAD_Y - BLOCK_H; // ancora no fundo
      }

      // ── Número do slide — sempre topo esquerdo ───────────────
      ctx.font = numFont;
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.textBaseline = "top";
      ctx.fillText(sl.num, PAD_X, PAD_Y);
      ctx.textBaseline = "alphabetic";

      // ── Título com gradiente branco → accent ─────────────────
      // Cria gradiente vertical que vai do branco (topo) ao accent (base)
      const titleBlockH = tLines.length * tLH;
      const titleGrad = ctx.createLinearGradient(0, ty - tLH, 0, ty + titleBlockH);
      titleGrad.addColorStop(0, "#ffffff"); // topo: branco puro
      titleGrad.addColorStop(0.5, "#ffffff"); // meio ainda branco
      titleGrad.addColorStop(1, accent); // base: cor de acento (lime, blue, gold…)
      ctx.font = tFont;
      ctx.fillStyle = titleGrad;
      tLines.forEach((ln) => {
        ctx.fillText(ln, textX, ty);
        ty += tLH;
      });

      // ── Subtítulo — branco puro ──────────────────────────────
      if (sLines.length) {
        ty += GAP_TS;
        ctx.font = sFont;
        ctx.fillStyle = "#ffffff";
        sLines.forEach((ln) => {
          ctx.fillText(ln, textX, ty);
          ty += sLH;
        });
      }

      // ── CTA — pílula com mesmo gradiente do título ───────────
      if (sl.cta) {
        ty += CTA_GAP;
        ctx.font = ctaFont;
        const ctaW = ctx.measureText(sl.cta).width + 48 * F;
        const ctaH = 44 * F;
        const cx = textX;
        const cy = ty - ctaH * 0.82;

        // Gradiente horizontal branco → accent no botão
        const ctaGrad = ctx.createLinearGradient(cx, 0, cx + ctaW, 0);
        ctaGrad.addColorStop(0, "#ffffff");
        ctaGrad.addColorStop(1, accent);
        ctx.fillStyle = ctaGrad;
        rrect(ctx, cx, cy, ctaW, ctaH, 10 * F);
        ctx.fill();

        ctx.fillStyle = "#000000";
        ctx.fillText(sl.cta, cx + 24 * F, cy + ctaH * 0.65);
      }
    };

    // ── Fallback sem imagem da IA ────────────────────────────────
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
