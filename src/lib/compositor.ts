import type { ProcessedSlide, LightKey } from "./parser";

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

// Cor de acento por tema — igual ao buildLayout
const ACC: Record<LightKey, string> = {
  dramatic: "#00b4ff",
  warm: "#f5c842",
  green: "#c8ff00",
  moody: "#ffffff",
};

export async function composeSlide(imgSrc: string | null, sl: ProcessedSlide, faceB64: string): Promise<Blob> {
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

  // ── Margens sincronizadas com buildLayout ──────────────────────────
  const PAD_X = Math.round(CW * 0.07); // 7% horizontal  (~75px em 1080px)
  const PAD_Y = Math.round(CH * 0.06); // 6% vertical    (~81px em 1350px)
  const MAXW = CW - PAD_X * 2;
  const accent = ACC[sl.light as LightKey] ?? "#c8ff00";

  // ── Tipografia ─────────────────────────────────────────────────────
  const NUM_SIZE = Math.round(13 * F);
  const TTL_SIZE = Math.round(44 * F);
  const SUB_SIZE = Math.round(17 * F);
  const CTA_SIZE = Math.round(12 * F);

  const tFont = `800 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const sFont = `300 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const ctaFont = `700 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;

  return new Promise<Blob>((resolve) => {
    const doText = () => {
      // ── Gradiente de legibilidade ────────────────────────────────
      // 4 stops, começa em 28% para não escurecer rosto no topo
      const ov = ctx.createLinearGradient(0, CH * 0.28, 0, CH);
      ov.addColorStop(0, "rgba(0,0,0,0)");
      ov.addColorStop(0.35, "rgba(0,0,0,0.45)");
      ov.addColorStop(0.7, "rgba(0,0,0,0.82)");
      ov.addColorStop(1, "rgba(0,0,0,0.96)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      // ── Número do slide — topo esquerdo ─────────────────────────
      ctx.font = numFont;
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.textBaseline = "top";
      ctx.fillText(sl.num, PAD_X, PAD_Y);
      ctx.textBaseline = "alphabetic";

      // ── Medir blocos para calcular posição Y de partida ─────────
      const tLines = wrapTxt(ctx, sl.titulo, tFont, MAXW, 2);
      const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, sFont, MAXW, 3) : [];

      const tLH = TTL_SIZE * F * 1.12; // line-height título
      const sLH = SUB_SIZE * F * 1.55; // line-height subtítulo
      const GAP_TS = 16 * F; // espaço título → subtítulo
      const GAP_SC = 20 * F; // espaço subtítulo → CTA
      const CTA_H = sl.cta ? 40 * F : 0;
      const CTA_GAP = sl.cta ? GAP_SC : 0;

      const BLOCK_H =
        tLines.length * tLH + (sLines.length ? GAP_TS + sLines.length * sLH : 0) + (sl.cta ? CTA_GAP + CTA_H : 0);

      // Âncora: bloco termina em CH − PAD_Y
      let ty = CH - PAD_Y - BLOCK_H;

      // ── Título — cor de acento (lime, blue, gold…) ───────────────
      ctx.font = tFont;
      ctx.fillStyle = accent;
      tLines.forEach((ln) => {
        ctx.fillText(ln, PAD_X, ty);
        ty += tLH;
      });

      // ── Subtítulo — branco suave ─────────────────────────────────
      if (sLines.length) {
        ty += GAP_TS;
        ctx.font = sFont;
        ctx.fillStyle = "rgba(255,255,255,0.88)";
        sLines.forEach((ln) => {
          ctx.fillText(ln, PAD_X, ty);
          ty += sLH;
        });
      }

      // ── CTA — pílula alinhada à esquerda (mesma margem do texto) ─
      if (sl.cta) {
        ty += CTA_GAP;
        ctx.font = ctaFont;
        const ctaW = ctx.measureText(sl.cta).width + 44 * F;
        const ctaH = 40 * F;
        const cx = PAD_X; // ← esquerda, alinhado ao texto
        const cy = ty - ctaH * 0.8; // baseline alinhada com ty
        ctx.fillStyle = accent;
        rrect(ctx, cx, cy, ctaW, ctaH, 8 * F);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.fillText(sl.cta, cx + 22 * F, cy + ctaH * 0.65);
      }
    };

    // ── Fallback: sem imagem da IA ──────────────────────────────────
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

      // Se há face reference, renderiza como placeholder semitransparente
      // (isso só acontece se a API falhou — não é o fluxo normal)
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

    // ── Fluxo principal ─────────────────────────────────────────────
    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Desenha a imagem gerada pela IA em full canvas
        ctx.drawImage(img, 0, 0, CW, CH);
        // Aplica gradiente + texto por cima
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
