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

interface AILayout {
  titleX: number; // 0-1 relativo à largura
  titleY: number; // 0-1 relativo à altura
  titleAlign: "left" | "center" | "right";
  titleMaxWidthRatio: number; // 0-1 — fração da largura disponível
  subtitleX: number;
  subtitleY: number;
  subtitleAlign: "left" | "center" | "right";
  subtitleMaxWidthRatio: number;
  ctaX: number;
  ctaY: number;
  gradientType: "bottom" | "top" | "left" | "right" | "radial-center";
  gradientStart: number; // 0-1 — onde o gradiente começa
  gradientMaxOpacity: number; // 0-0.95
}

async function analyzeLayout(
  imageBase64: string,
  titulo: string,
  subtitulo: string,
  hasCta: boolean,
  fmt: string,
): Promise<AILayout> {
  const defaultLayout: AILayout = {
    titleX: 0.07,
    titleY: 0.72,
    titleAlign: "left",
    titleMaxWidthRatio: 0.86,
    subtitleX: 0.07,
    subtitleY: 0.83,
    subtitleAlign: "left",
    subtitleMaxWidthRatio: 0.86,
    ctaX: 0.07,
    ctaY: 0.91,
    gradientType: "bottom",
    gradientStart: 0.38,
    gradientMaxOpacity: 0.88,
  };

  try {
    const systemPrompt = `You are a world-class editorial art director specializing in cinematic social media layouts.
You analyze an image and decide the optimal position for text overlay elements following these principles:
- Visual hierarchy: title dominates, subtitle supports, CTA closes
- Text must land on naturally dark or blurred zones — never over a bright face or busy scene detail
- Composition must feel like a magazine cover or movie poster
- Prefer asymmetric, cinematic placements over centered layouts unless the image demands it
- The gradient should be as subtle as possible while still ensuring legibility

Respond ONLY with a valid JSON object. No explanation, no markdown, no backticks.`;

    const userPrompt = `Analyze this ${fmt} image and decide the best text layout.

Title text: "${titulo}"
Subtitle text: "${subtitulo}"
Has CTA button: ${hasCta}

Return this exact JSON structure with your decisions:
{
  "titleX": <0-1 horizontal position as fraction of width>,
  "titleY": <0-1 vertical position as fraction of height — this is the baseline of the first title line>,
  "titleAlign": <"left" | "center" | "right">,
  "titleMaxWidthRatio": <0.4-0.92 fraction of total width available for title block>,
  "subtitleX": <0-1>,
  "subtitleY": <0-1>,
  "subtitleAlign": <"left" | "center" | "right">,
  "subtitleMaxWidthRatio": <0.4-0.92>,
  "ctaX": <0-1>,
  "ctaY": <0-1>,
  "gradientType": <"bottom" | "top" | "left" | "right" | "radial-center">,
  "gradientStart": <0-1 where gradient begins fading in>,
  "gradientMaxOpacity": <0.55-0.92 maximum opacity of the dark overlay>
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: imageBase64 },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.content?.map((c: any) => c.text || "").join("") ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as AILayout;
    return { ...defaultLayout, ...parsed };
  } catch {
    return defaultLayout;
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
  const accentRgb = hexToRgb(accent) ?? "200,255,0";
  // aiLayout será preenchido depois que a imagem for carregada
  let aiLayout: AILayout | null = null;

  // ── Tipografia ────────────────────────────────────────────────
  const NUM_SIZE = Math.round(14 * F);
  const TTL_SIZE = Math.round(96 * F);
  const SUB_SIZE = Math.round(34 * F); // legível a distância
  const CTA_SIZE = Math.round(20 * F);

  const numFont = `700 ${NUM_SIZE}px 'Bricolage Grotesque', sans-serif`;
  const tFont = `800 ${TTL_SIZE}px 'Bricolage Grotesque', sans-serif`; // bold
  const sFont = `400 ${SUB_SIZE}px 'Bricolage Grotesque', sans-serif`; // regular
  const ctaFont = `700 ${CTA_SIZE}px 'Bricolage Grotesque', sans-serif`;

  return new Promise<Blob>((resolve) => {
    const exportBlob = () => {
      const out = upscale2x(canvas);
      out.toBlob((b) => resolve(b!), "image/png", 1.0);
    };

    const doText = () => {
      const L = aiLayout!;
      const [imgW, imgH] = [CW, CH];

      // ── 1. GRADIENTE — direção e intensidade decididos pela IA ──────
      let ov: CanvasGradient;
      switch (L.gradientType) {
        case "top":
          ov = ctx.createLinearGradient(0, 0, 0, imgH * (1 - L.gradientStart));
          ov.addColorStop(0, `rgba(0,0,0,${L.gradientMaxOpacity})`);
          ov.addColorStop(1, "rgba(0,0,0,0)");
          break;
        case "left":
          ov = ctx.createLinearGradient(0, 0, imgW * (1 - L.gradientStart), 0);
          ov.addColorStop(0, `rgba(0,0,0,${L.gradientMaxOpacity})`);
          ov.addColorStop(1, "rgba(0,0,0,0)");
          break;
        case "right":
          ov = ctx.createLinearGradient(imgW, 0, imgW * L.gradientStart, 0);
          ov.addColorStop(0, `rgba(0,0,0,${L.gradientMaxOpacity})`);
          ov.addColorStop(1, "rgba(0,0,0,0)");
          break;
        case "radial-center":
          ov = ctx.createRadialGradient(imgW / 2, imgH / 2, imgH * 0.1, imgW / 2, imgH / 2, imgH * 0.7);
          ov.addColorStop(0, "rgba(0,0,0,0)");
          ov.addColorStop(1, `rgba(0,0,0,${L.gradientMaxOpacity})`);
          break;
        default: // bottom
          ov = ctx.createLinearGradient(0, imgH * L.gradientStart, 0, imgH);
          ov.addColorStop(0, "rgba(0,0,0,0)");
          ov.addColorStop(0.3, `rgba(0,0,0,${L.gradientMaxOpacity * 0.4})`);
          ov.addColorStop(0.65, `rgba(0,0,0,${L.gradientMaxOpacity * 0.78})`);
          ov.addColorStop(1, `rgba(0,0,0,${L.gradientMaxOpacity})`);
      }
      ctx.fillStyle = ov;
      ctx.fillRect(0, 0, imgW, imgH);

      // ── 2. COR AMBIENTE ──────────────────────────────────────────────
      const ambOv = ctx.createLinearGradient(0, imgH * (L.gradientStart + 0.1), 0, imgH);
      ambOv.addColorStop(0, `rgba(${accentRgb},0)`);
      ambOv.addColorStop(0.6, `rgba(${accentRgb},0.05)`);
      ambOv.addColorStop(1, `rgba(${accentRgb},0.12)`);
      ctx.fillStyle = ambOv;
      ctx.fillRect(0, 0, imgW, imgH);

      // ── 3. HELPERS DE POSIÇÃO ────────────────────────────────────────
      const tx = (ratio: number) => ratio * imgW;
      const ty = (ratio: number) => ratio * imgH;

      // ── 4. NÚMERO DO SLIDE ───────────────────────────────────────────
      ctx.save();
      ctx.font = numFont;
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 8 * F;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.textBaseline = "top";
      ctx.fillText(sl.num, PAD_X, PAD_Y);
      ctx.textBaseline = "alphabetic";
      ctx.restore();

      // ── 5. TÍTULO ────────────────────────────────────────────────────
      const titleMaxW = imgW * L.titleMaxWidthRatio;
      const tLines = wrapTxt(ctx, sl.titulo, tFont, titleMaxW, 3);
      const tLH = TTL_SIZE * F * 0.96;

      ctx.font = tFont;
      ctx.textAlign = L.titleAlign;
      let curY = ty(L.titleY);

      tLines.forEach((ln, idx) => {
        const isAccentLine = idx === tLines.length - 1;
        const lineX = tx(L.titleX);

        if (isAccentLine) {
          ctx.save();
          ctx.textAlign = L.titleAlign;
          ctx.shadowColor = accent;
          ctx.shadowBlur = 55 * F;
          ctx.shadowOffsetY = 6 * F;
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = accent;
          ctx.fillText(ln, lineX, curY);
          ctx.restore();
          ctx.save();
          ctx.textAlign = L.titleAlign;
          ctx.shadowColor = `rgba(${accentRgb},0.4)`;
          ctx.shadowBlur = 20 * F;
          ctx.shadowOffsetY = 3 * F;
          ctx.fillStyle = accent;
          ctx.fillText(ln, lineX, curY);
          ctx.restore();
        } else {
          ctx.save();
          ctx.textAlign = L.titleAlign;
          ctx.shadowColor = "rgba(0,0,0,0.80)";
          ctx.shadowBlur = 22 * F;
          ctx.shadowOffsetY = 4 * F;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(ln, lineX, curY);
          ctx.restore();
        }
        curY += tLH;
      });
      ctx.textAlign = "left"; // reset

      // ── 6. SUBTÍTULO ─────────────────────────────────────────────────
      if (sl.subtitulo) {
        const subMaxW = imgW * L.subtitleMaxWidthRatio;
        const sLines = wrapTxt(ctx, sl.subtitulo, sFont, subMaxW, 3);
        const sLH = SUB_SIZE * F * 1.5;

        ctx.font = sFont;
        ctx.textAlign = L.subtitleAlign;
        curY = ty(L.subtitleY);

        sLines.forEach((ln) => {
          ctx.save();
          ctx.textAlign = L.subtitleAlign;
          ctx.shadowColor = "rgba(0,0,0,0.70)";
          ctx.shadowBlur = 16 * F;
          ctx.shadowOffsetY = 3 * F;
          ctx.fillStyle = "rgba(255,255,255,0.88)";
          ctx.fillText(ln, tx(L.subtitleX), curY);
          ctx.restore();
          curY += sLH;
        });
        ctx.textAlign = "left";
      }

      // ── 7. CTA ───────────────────────────────────────────────────────
      if (sl.cta) {
        ctx.font = ctaFont;
        const ICON_W = 32 * F;
        const ICON_GAP = 12 * F;
        const PAD_L = 28 * F;
        const PAD_R = 20 * F;
        const tm = ctx.measureText(sl.cta);
        const ctaW = PAD_L + tm.width + ICON_GAP + ICON_W + PAD_R;
        const ctaH = 58 * F;
        const cx = tx(L.ctaX);
        const cy = ty(L.ctaY) - ctaH * 0.5;

        ctx.save();
        ctx.shadowColor = `rgba(${accentRgb},0.55)`;
        ctx.shadowBlur = 36 * F;
        ctx.shadowOffsetY = 8 * F;
        ctx.fillStyle = accent;
        rrect(ctx, cx, cy, ctaW, ctaH, 30 * F);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = accent;
        rrect(ctx, cx, cy, ctaW, ctaH, 30 * F);
        ctx.fill();

        const hl = ctx.createLinearGradient(cx, cy, cx, cy + ctaH * 0.55);
        hl.addColorStop(0, "rgba(255,255,255,0.28)");
        hl.addColorStop(0.5, "rgba(255,255,255,0.06)");
        hl.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = hl;
        rrect(ctx, cx, cy, ctaW, ctaH * 0.55, 30 * F);
        ctx.fill();

        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5 * F;
        rrect(ctx, cx, cy, ctaW, ctaH, 30 * F);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.font = ctaFont;
        ctx.shadowColor = "rgba(0,0,0,0.30)";
        ctx.shadowBlur = 5 * F;
        ctx.shadowOffsetY = 1 * F;
        ctx.fillStyle = "#000000";
        ctx.textBaseline = "middle";
        ctx.fillText(sl.cta, cx + PAD_L, cy + ctaH * 0.5);
        ctx.textBaseline = "alphabetic";
        ctx.restore();

        const iconCX = cx + PAD_L + tm.width + ICON_GAP + ICON_W * 0.5;
        const iconCY = cy + ctaH * 0.5;
        const iconR = ICON_W * 0.42;

        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.beginPath();
        ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.2 * F;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const aW = iconR * 0.55;
        const aH = iconR * 0.45;
        ctx.beginPath();
        ctx.moveTo(iconCX - aW, iconCY);
        ctx.lineTo(iconCX + aW, iconCY);
        ctx.moveTo(iconCX + aW - aH * 0.8, iconCY - aH);
        ctx.lineTo(iconCX + aW, iconCY);
        ctx.lineTo(iconCX + aW - aH * 0.8, iconCY + aH);
        ctx.stroke();
        ctx.restore();
      }
    }; // fim doText

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

          const b64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
          analyzeLayout(b64, sl.titulo, sl.subtitulo ?? "", !!sl.cta, sl.fmt).then((layout) => {
            aiLayout = layout;
            doText();
            exportBlob();
          });

          exportBlob();
        };
        fi.onerror = () => {
          analyzeLayout("", sl.titulo, sl.subtitulo ?? "", !!sl.cta, sl.fmt).then((layout) => {
            aiLayout = layout;
            doText();
            exportBlob();
          });
          exportBlob();
        };
        fi.src = "data:image/jpeg;base64," + faceB64;
      } else {
        analyzeLayout("", sl.titulo, sl.subtitulo ?? "", !!sl.cta, sl.fmt).then((layout) => {
          aiLayout = layout;
          doText();
          exportBlob();
        });
        exportBlob();
      }
    };

    // ── Fluxo principal ────────────────────────────────────────────
    if (imgSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        ctx.drawImage(img, 0, 0, CW, CH);

        // Captura a imagem como base64 para análise
        const snapshotCanvas = document.createElement("canvas");
        snapshotCanvas.width = Math.round(CW / 2); // metade — suficiente para visão
        snapshotCanvas.height = Math.round(CH / 2);
        const sCtx = snapshotCanvas.getContext("2d")!;
        sCtx.drawImage(canvas, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        const b64 = snapshotCanvas.toDataURL("image/jpeg", 0.85).split(",")[1];

        aiLayout = await analyzeLayout(b64, sl.titulo, sl.subtitulo ?? "", !!sl.cta, sl.fmt);
        doText();
        exportBlob();
      };
      img.onerror = () => drawFallback();
      img.src = imgSrc;
    } else {
      drawFallback();
    }
  });
}
