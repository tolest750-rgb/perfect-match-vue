import { useCarousel } from '@/lib/carousel-store';
import { EmptyState } from './EmptyState';
import { SlideCard } from './SlideCard';
import JSZip from 'jszip';

interface OutputPanelProps {
  onImageClick: (src: string) => void;
}

export function OutputPanel({ onImageClick }: OutputPanelProps) {
  const { slides, isGenerating, progress, generationComplete, composedBlobs } = useCarousel();

  const hasSlides = slides.length > 0;

  const dlZip = async () => {
    const zip = new JSZip();
    const root = zip.folder('carousel-britto')!;
    let n = 0;
    for (let i = 0; i < slides.length; i++) {
      if (!composedBlobs[i]) continue;
      const sf = root.folder('slide-' + String(slides[i].n).padStart(2, '0'))!;
      for (let v = 0; v < 4; v++) {
        const b = composedBlobs[i][v];
        if (b) { sf.file('var-' + (v + 1) + '.png', b); n++; }
      }
    }
    root.file('_prompts.txt', slides.map(s =>
      `=== SLIDE ${s.num} ===\nPOSITIVE:\n${s.prompt.pos}\n\nNEGATIVE:\n${s.prompt.neg}\n\nLAYOUT:\n${s.layout}`
    ).join('\n\n' + '─'.repeat(48) + '\n\n'));
    root.file('_data.json', JSON.stringify(slides.map(s => ({
      slide: s.n, titulo: s.titulo, subtitulo: s.subtitulo, cta: s.cta,
      positivePrompt: s.prompt.pos, negativePrompt: s.prompt.neg,
    })), null, 2));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'carousel-britto.zip';
    a.click();
  };

  const cpAll = () => {
    const text = slides.map(s =>
      `=== SLIDE ${s.num} ===\nPOSITIVE:\n${s.prompt.pos}\n\nNEGATIVE:\n${s.prompt.neg}\n\nLAYOUT:\n${s.layout}`
    ).join('\n\n' + '═'.repeat(48) + '\n\n');
    navigator.clipboard.writeText(text);
  };

  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const progressLabel = progress.done < progress.total
    ? `PROCESSING_SLIDE_${progress.done + 1}_OF_${progress.total}`
    : `${progress.total}_SLIDES_COMPLETE`;

  return (
    <div className="flex flex-col overflow-y-auto h-[calc(100vh-60px)] bg-bg2">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 py-3 px-5 border-b border-border2 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="font-mono text-[11px] text-neon2 tracking-[1px]">
          {isGenerating
            ? `>> GERANDO ${slides.length} SLIDE(S) × 4 VARIAÇÕES...`
            : generationComplete
            ? `>> ${slides.length} SLIDE(S) × 4 VARIAÇÕES // COMPLETO ✓`
            : '>> OUTPUT_PANEL'}
        </div>
        <div className="flex gap-1.5">
          {hasSlides && (
            <button
              onClick={cpAll}
              className="bg-card border border-border2 rounded-sm text-foreground font-mono text-[9px] tracking-[1px] py-1.5 px-3 cursor-pointer transition-all duration-200 flex items-center gap-1.5 hover:border-primary hover:text-primary hover:shadow-[0_0_10px_hsl(var(--neon-dim)/0.07)]"
            >📋 COPY ALL</button>
          )}
          {generationComplete && (
            <button
              onClick={dlZip}
              className="bg-primary/[0.05] border border-primary/40 rounded-sm text-primary font-mono text-[9px] tracking-[1px] py-1.5 px-3 cursor-pointer transition-all duration-200 flex items-center gap-1.5 hover:border-primary hover:shadow-[0_0_10px_hsl(var(--neon-dim)/0.07)]"
            >📦 ZIP ALL</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isGenerating && (
        <div className="px-5 pt-2">
          <div className="flex justify-between font-mono text-[8px] text-muted-foreground mb-1 tracking-[1px]">
            <span>{progressLabel}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="bg-card border border-border rounded-sm h-[3px] overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-sm transition-all duration-500 shadow-[0_0_8px_hsl(var(--primary))]"
              style={{ width: `${progressPct}%` }}
            />
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.5s_linear_infinite]" />
          </div>
        </div>
      )}

      {/* Quick nav */}
      {hasSlides && (
        <div className="flex flex-wrap gap-1 px-2.5 py-2.5">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => document.getElementById(`sc${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="bg-card border border-border2 rounded-sm text-muted-foreground font-mono text-[8px] tracking-[1px] py-0.5 px-[7px] cursor-pointer transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)]"
            >
              SL_{String(i + 1).padStart(2, '0')}
            </button>
          ))}
        </div>
      )}

      {/* Slides or empty */}
      {hasSlides ? (
        <div className="p-5 flex flex-col gap-4">
          {slides.map((slide, i) => (
            <div key={i} id={`sc${i}`}>
              <SlideCard slide={slide} index={i} onImageClick={onImageClick} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
