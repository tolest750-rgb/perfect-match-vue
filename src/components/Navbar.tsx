import { useCarousel } from '@/lib/carousel-store';

export function Navbar({ onOpenModal }: { onOpenModal: () => void }) {
  const { apiKey, demo } = useCarousel();

  const pillClass = demo
    ? 'border-warning/40 text-warning'
    : apiKey
    ? 'border-primary/40 text-neon2'
    : 'border-border2 text-muted-foreground';

  const pillText = demo ? 'DEMO_MODE' : apiKey ? 'API_ONLINE' : 'CONFIG_API';
  const dotClass = demo
    ? 'bg-warning shadow-[0_0_6px_hsl(var(--warning))]'
    : apiKey
    ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]'
    : 'bg-muted';

  return (
    <nav className="h-[60px] flex items-center justify-between px-7 border-b border-border2 bg-background/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-[300] shadow-[0_1px_0_hsl(var(--neon-dim)/0.07),0_4px_24px_hsl(var(--neon)/0.05)]">
      <div className="flex items-center gap-3.5">
        <div className="font-logo text-[17px] font-black tracking-[3px] text-primary animate-[logoPulse_4s_ease-in-out_infinite] relative">
          BRITTO<span className="text-accent" style={{ textShadow: '0 0 10px hsl(var(--accent)/0.5)' }}>★</span>
          <span className="absolute bottom-[-2px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-[lineGlow_4s_ease-in-out_infinite]" />
        </div>
        <div className="hidden md:block font-mono text-[9px] text-muted-foreground tracking-[2px] border border-border2 px-2.5 py-0.5 rounded-sm bg-card relative overflow-hidden">
          CAROUSEL_STUDIO // v4.0
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent animate-[shimmer_3s_linear_infinite]" />
        </div>
      </div>

      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
          <div className="w-[5px] h-[5px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-[blink_1.5s_ease-in-out_infinite]" />
          <span>SYS_ONLINE</span>
        </div>

        <button
          onClick={onOpenModal}
          className={`flex items-center gap-[7px] bg-card border rounded-sm py-1.5 px-3.5 font-mono text-[10px] tracking-[1px] cursor-pointer transition-all duration-200 relative overflow-hidden hover:border-primary hover:text-primary hover:shadow-[0_0_12px_hsl(var(--neon-dim)/0.07),inset_0_0_12px_hsl(var(--neon-dim)/0.07)] ${pillClass}`}
        >
          <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-muted transition-all duration-200" />
          <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${dotClass}`} />
          <span>{pillText}</span>
        </button>
      </div>
    </nav>
  );
}
