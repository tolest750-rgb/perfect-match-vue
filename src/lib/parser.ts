export interface SlideData {
  n: number;
  tot: number;
  titulo: string;
  subtitulo: string;
  cta: string;
  visual: string;
  design: string;
  num: string;
}

/**
 * Layout position determines where text will be placed on the slide.
 * The compositor and prompt system both use this to coordinate
 * image generation with typography placement.
 */
export type LayoutPosition =
  | 'bottom-left'      // Text block bottom-left, subject top/right (default for person scenes)
  | 'bottom-center'    // Text block bottom-center, subject/scene fills top
  | 'right'            // Text block right side, subject left side
  | 'left'             // Text block left side, subject right side
  | 'top-center'       // Text block top-center, subject bottom
  | 'center'           // Text centered vertically, dark/abstract background
  | 'split-bottom';    // Two-column bottom: title left, subtitle right

export interface ProcessedSlide extends SlideData {
  prompt: { pos: string; neg: string };
  layout: string;
  layoutPosition: LayoutPosition;
  fmt: string;
  style: string;
  light: string;
  res: string;
}

export type StyleKey = 'cinematic' | 'corporate' | 'futuristic' | 'editorial';
export type LightKey = 'dramatic' | 'warm' | 'green' | 'moody';
export type FormatKey = '4:5' | '9:16' | '1:1';
export type ResKey = '1K' | '2K' | '4K';

export function parseSlides(raw: string): SlideData[] {
  const blocks = raw.split(/\n\s*-{3,}\s*\n/).map(b => b.trim()).filter(Boolean);
  const tot = blocks.length;
  return blocks.map((blk, i) => {
    const ex = (k: string): string => {
      let m = blk.match(new RegExp('[├└─].*?' + k + '[^:\\n]*:\\s*(.+?)(?=\\n[├└─]|$)', 'si'));
      if (!m) m = blk.match(new RegExp('^' + k + '[^:\\n]*:\\s*(.+?)(?=\\n[A-ZÁÉÍÓÚ]|$)', 'mi'));
      return m ? m[1].replace(/\(se houver\)/gi, '').trim() : '';
    };
    const titulo = ex('TÍTULO') || ex('TITULO');
    if (!titulo) return null;
    return {
      n: i + 1, tot, titulo,
      subtitulo: ex('SUBTÍTULO') || ex('SUBTITULO'),
      cta: (ex('CALL TO ACTION') || ex('CTA')).replace(/^[-–—]+$/, '').trim(),
      visual: ex('VISUAL'),
      design: ex('OBSERVA'),
      num: String(i + 1).padStart(2, '0') + '/' + String(tot).padStart(2, '0'),
    };
  }).filter(Boolean) as SlideData[];
}
