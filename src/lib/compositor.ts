import type { ProcessedSlide, LightKey } from './parser';

function wrapTxt(ctx: CanvasRenderingContext2D, txt: string, font: string, maxW: number, maxL: number): string[] {
  ctx.font = font;
  const words = txt.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      if (lines.length >= maxL) { lines[lines.length - 1] += '…'; return lines; }
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
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
};

export async function composeSlide(imgSrc: string | null, sl: ProcessedSlide, faceB64: string): Promise<Blob> {
  const [W, H] = DIM[sl.fmt] || [1080, 1350];
  const SC = sl.res === '4K' ? 1 : 2;
  const CW = W * SC, CH = H * SC, F = SC;
  const ACC: Record<LightKey, string> = { dramatic: '#00b4ff', warm: '#f5c842', green: '#c8ff00', moody: '#ffffff' };

  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  return new Promise<Blob>((resolve) => {
    const doText = () => {
      const ov = ctx.createLinearGradient(0, CH * 0.22, 0, CH);
      ov.addColorStop(0, 'rgba(0,0,0,0)');
      ov.addColorStop(0.38, 'rgba(0,0,0,0.30)');
      ov.addColorStop(1, 'rgba(0,0,0,0.93)');
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, CW, CH);

      const PAD = 22 * F, MAXW = CW - PAD * 2.5;

      ctx.font = `700 ${Math.round(13 * F)}px 'Bricolage Grotesque', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      ctx.textBaseline = 'top';
      ctx.fillText(sl.num, PAD, PAD);
      ctx.textBaseline = 'alphabetic';

      const tFont = `800 ${Math.round(42 * F)}px 'Bricolage Grotesque', sans-serif`;
      const tLines = wrapTxt(ctx, sl.titulo, tFont, MAXW, 2);
      const tLH = 42 * F * 1.15;

      const sFont = `300 ${Math.round(16 * F)}px 'Bricolage Grotesque', sans-serif`;
      const sLines = sl.subtitulo ? wrapTxt(ctx, sl.subtitulo, sFont, MAXW, 3) : [];
      const sLH = 16 * F * 1.45;

      const CTAH = sl.cta ? 40 * F : 0;
      const BLKH = tLines.length * tLH + (sLines.length ? 10 * F + sLines.length * sLH : 0);
      let ty = CH - PAD - CTAH - BLKH - 8 * F;

      ctx.font = tFont;
      ctx.fillStyle = '#ffffff';
      tLines.forEach(ln => { ctx.fillText(ln, PAD, ty); ty += tLH; });

      if (sLines.length) {
        ty += 10 * F;
        ctx.font = sFont;
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        sLines.forEach(ln => { ctx.fillText(ln, PAD, ty); ty += sLH; });
      }

      if (sl.cta) {
        const cf = `700 ${Math.round(11 * F)}px 'Bricolage Grotesque', sans-serif`;
        ctx.font = cf;
        const cw = ctx.measureText(sl.cta).width + 36 * F, ch = 36 * F;
        const cx = CW - PAD - cw, cy = CH - PAD - ch;
        ctx.fillStyle = ACC[sl.light as LightKey];
        rrect(ctx, cx, cy, cw, ch, 8 * F);
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.fillText(sl.cta, cx + 18 * F, cy + ch * 0.65);
      }
    };

    const draw = (bg: HTMLImageElement | null) => {
      if (bg) {
        ctx.drawImage(bg, 0, 0, CW, CH);
        doText();
        canvas.toBlob(blob => resolve(blob!), 'image/png', 1.0);
      } else {
        const GC: Record<string, [string, string]> = {
          dramatic: ['#030318', '#06103a'],
          warm: ['#100500', '#221000'],
          green: ['#010901', '#020f03'],
          moody: ['#080810', '#10101e'],
        };
        const colors = GC[sl.light] || ['#030318', '#06103a'];
        const grd = ctx.createLinearGradient(0, 0, 0, CH);
        grd.addColorStop(0, colors[0]);
        grd.addColorStop(1, colors[1]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, CW, CH);

        if (faceB64) {
          const fi = new Image();
          fi.onload = () => {
            const fh = CH * 0.5, fw = fh * (fi.width / fi.height), fx = (CW - fw) / 2;
            ctx.save();
            ctx.globalAlpha = 0.45;
            ctx.drawImage(fi, fx, 0, fw, fh);
            ctx.restore();
            doText();
            canvas.toBlob(blob => resolve(blob!), 'image/png', 1.0);
          };
          fi.onerror = () => {
            doText();
            canvas.toBlob(blob => resolve(blob!), 'image/png', 1.0);
          };
          fi.src = 'data:image/jpeg;base64,' + faceB64;
        } else {
          doText();
          canvas.toBlob(blob => resolve(blob!), 'image/png', 1.0);
        }
        return;
      }
    };

    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
      img.src = imgSrc;
    } else {
      draw(null);
    }
  });
}
