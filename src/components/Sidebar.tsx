import { useCarousel } from '@/lib/carousel-store';
import { FaceUpload } from './FaceUpload';
import { ChipGroup } from './ChipGroup';
import type { StyleKey, LightKey, FormatKey, ResKey } from '@/lib/parser';

export function Sidebar() {
  const { rawText, setRawText, style, setStyle, light, setLight, fmt, setFmt, res, setRes, isGenerating, startGeneration } = useCarousel();

  const canGenerate = rawText.trim().length > 0 && !isGenerating;

  return (
    <aside className="bg-popover border-r border-border2 flex flex-col sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto shadow-[2px_0_20px_hsl(var(--primary)/0.03)]">
      <FaceUpload />

      {/* Carousel Data */}
      <div className="p-4 border-b border-border relative group">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent transition-all duration-300 group-hover:bg-primary group-hover:shadow-[0_0_8px_hsl(var(--primary))]" />
        <div className="font-mono text-[9px] tracking-[2.5px] uppercase text-muted-foreground mb-2.5 flex items-center gap-2">
          <span className="text-primary" style={{ textShadow: '0 0 6px hsl(var(--primary))' }}>◈</span>
          CAROUSEL_DATA
          <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
        </div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Cole aqui o conteúdo do carousel separado por ---"
          className="w-full bg-card border border-border2 rounded-sm text-foreground font-mono text-[11px] py-2 px-3 outline-none transition-all duration-200 caret-primary resize-y min-h-[120px] leading-relaxed focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_0_16px_hsl(var(--primary)/0.06),inset_0_0_8px_hsl(var(--primary)/0.04)] focus:text-neon2 placeholder:text-muted-foreground"
        />
        <div className="font-mono text-[8px] text-muted-foreground mt-1 leading-relaxed tracking-[0.5px]">
          Separe slides com <code className="bg-card-2 border border-border2 px-1 py-0.5 rounded-sm font-mono text-[9px] text-neon2">---</code>. Use campos: TÍTULO, SUBTÍTULO, CTA, VISUAL
        </div>
      </div>

      {/* Style */}
      <div className="p-4 border-b border-border relative group">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent transition-all duration-300 group-hover:bg-primary group-hover:shadow-[0_0_8px_hsl(var(--primary))]" />
        <div className="font-mono text-[9px] tracking-[2.5px] uppercase text-muted-foreground mb-2.5 flex items-center gap-2">
          <span className="text-primary" style={{ textShadow: '0 0 6px hsl(var(--primary))' }}>◈</span>
          PARAMETERS
          <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
        </div>

        <ChipGroup
          label="STYLE"
          value={style}
          onChange={(v) => setStyle(v as StyleKey)}
          options={[
            { value: 'cinematic', icon: '🎬', label: 'CINE' },
            { value: 'corporate', icon: '💼', label: 'CORP' },
            { value: 'futuristic', icon: '🔮', label: 'FUTR' },
            { value: 'editorial', icon: '📰', label: 'EDIT' },
          ]}
        />

        <ChipGroup
          label="LIGHTING"
          value={light}
          onChange={(v) => setLight(v as LightKey)}
          options={[
            { value: 'dramatic', icon: '⚡', label: 'DRAM' },
            { value: 'warm', icon: '🌅', label: 'WARM' },
            { value: 'green', icon: '💚', label: 'NEON' },
            { value: 'moody', icon: '🌑', label: 'MOOD' },
          ]}
        />

        <ChipGroup
          label="FORMAT"
          value={fmt}
          onChange={(v) => setFmt(v as FormatKey)}
          options={[
            { value: '4:5', icon: '▯', label: '4:5' },
            { value: '9:16', icon: '▮', label: '9:16' },
            { value: '1:1', icon: '◻', label: '1:1' },
          ]}
        />

        <ChipGroup
          label="RESOLUTION"
          value={res}
          onChange={(v) => setRes(v as ResKey)}
          options={[
            { value: '1K', label: '1K' },
            { value: '2K', label: '2K' },
            { value: '4K', label: '4K' },
          ]}
        />
      </div>

      {/* Generate Button */}
      <div className="p-4">
        <button
          onClick={startGeneration}
          disabled={!canGenerate}
          className="w-full bg-transparent border border-primary rounded-sm text-primary font-logo text-[11px] font-bold tracking-[3px] uppercase py-3.5 cursor-pointer transition-all duration-300 flex items-center justify-center gap-2.5 relative overflow-hidden shadow-[0_0_16px_hsl(var(--primary)/0.12),inset_0_0_16px_hsl(var(--primary)/0.04)] hover:bg-primary/[0.08] hover:shadow-[0_0_28px_hsl(var(--primary)/0.25),inset_0_0_24px_hsl(var(--primary)/0.08)] hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          style={{ textShadow: '0 0 10px hsl(var(--primary))' }}
        >
          {isGenerating && (
            <div className="w-3.5 h-3.5 border border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
          )}
          <span>{isGenerating ? 'PROCESSANDO...' : '◈ INICIAR GERAÇÃO'}</span>
        </button>
      </div>
    </aside>
  );
}
