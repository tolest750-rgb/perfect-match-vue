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

export async function composeSlide(imgSrc: string | null, sl: ProcessedSlide, faceB64: string): Promise<Blob> {
  const [W, H] = DIM[sl.fmt] || [1080, 1350];
  const SC = sl.res === "4K" ? 1 : 2;
  const CW = W * SC,
    CH = H * SC,
    F = SC;
  const ACC: Record<LightKey, string> = { dramatic: "#00b4ff", warm: "#f5c842", green: "#c8ff00", moody: "#ffffff" };

  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  return new Promise<Blob>((resolve) => {
    const doText = () => {
      // Gradiente mais profundo para garantir legibilidade do texto
      const ov = ctx.createLinearGradient(0, CH * 0.3, 0, CH);
      ov.addColorStop(0, "rgba(0,0,0,0)");
      ov.addColorStop(0.45, "rgba(0,0,0,0.45)");
      ov.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      // Margens generosas: 7% horizontal, 6% vertical
      const PAD_X = Math.round(CW * 0.07);
      const PAD_Y = Math.round(CH * 0.06);
      const MAXW = CW - PAD_X * 2;

      // Número do slide — canto superior esquerdo com margem
      ctx.font = `700 ${Math.round(13 * F)}px 'Bricolage Grotesque', sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.42)";
      ctx.textBaseline = "top";
      ctx.fillText(sl.num, PAD_X, PAD_Y);
      ctx.textBaseline = "alphabetic";

      const tFont = `800 ${Math.round(42 * F)}px 'Bricolage Grotesque', sans-serif`;
      const tLines = wrapTxt(ctx, sl.titulo, tFont, MAXW, 2);
      const tLH = 42 * F * 1.18;

      const sFont = `300 ${Math.round(16 * F)}px 'Bricolage Grotesque', sans-serif`;
      const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, sFont, MAXW, 3) : [];
      const sLH = 16 * F * 1.5;

      // Altura do bloco CTA + espaçamento entre CTA e texto
      const CTAH = sl.cta ? 40 * F : 0;
      const CTA_GAP = sl.cta ? 18 * F : 0;

      // Altura total do bloco de texto
      const BLKH = tLines.length * tLH + (sLines.length ? 14 * F + sLines.length * sLH : 0);

      // Posição Y inicial do título: sobe a partir do fundo com margem + CTA + gap
      let ty = CH - PAD_Y - CTAH - CTA_GAP - BLKH;

      // Título
      ctx.font = tFont;
      ctx.fillStyle = "#ffffff";
      tLines.forEach((ln) => {
        ctx.fillText(ln, PAD_X, ty);
        ty += tLH;
      });

      // Subtítulo
      if (sLines.length) {
        ty += 14 * F;
        ctx.font = sFont;
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        sLines.forEach((ln) => {
          ctx.fillText(ln, PAD_X, ty);
          ty += sLH;
        });
      }

      // CTA — alinhado à esquerda com mesma margem PAD_X, na base com PAD_Y
      if (sl.cta) {
        const cf = `700 ${Math.round(11 * F)}px 'Bricolage Grotesque', sans-serif`;
        ctx.font = cf;
        const cw = ctx.measureText(sl.cta).width + 36 * F;
        const ch = 36 * F;
        const cx = PAD_X; // ← alinhado à esquerda junto ao texto
        const cy = CH - PAD_Y - ch;
        ctx.fillStyle = ACC[sl.light as LightKey];
        rrect(ctx, cx, cy, cw, ch, 8 * F);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.fillText(sl.cta, cx + 18 * F, cy + ch * 0.65);
      }
    };

    const draw = (bg: HTMLImageElement | null) => {
      if (bg) {
        ctx.drawImage(bg, 0, 0, CW, CH);
        doText();
        canvas.toBlob((blob) => resolve(blob!), "image/png", 1.0);
      } else {
        // Fallback: dark gradient only — do NOT paste the face reference photo
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

        // Add a subtle "no image generated" indicator
        ctx.font = `400 ${Math.round(14 * F)}px 'Bricolage Grotesque', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.textAlign = "center";
        ctx.fillText("⚠ Image generation failed — API error", CW / 2, CH * 0.35);
        ctx.textAlign = "start";

        doText();
        canvas.toBlob((blob) => resolve(blob!), "image/png", 1.0);
        return;
      }
    };

    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
      img.src = imgSrc;
    } else {
      draw(null);
    }
  });
}
