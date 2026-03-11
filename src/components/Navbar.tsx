export function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  return (
    <nav className="h-[60px] flex items-center justify-between px-4 md:px-7 border-b border-border2 bg-background/95 backdrop-blur-xl fixed top-0 left-0 right-0 z-[300] shadow-[0_1px_0_hsl(var(--neon-dim)/0.07),0_4px_24px_hsl(var(--neon)/0.05)]">
      <div className="flex items-center gap-2 md:gap-3.5">
        {/* Mobile hamburger */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden text-primary p-1.5 border border-border2 rounded-sm hover:border-primary transition-colors"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="font-logo text-[14px] md:text-[17px] font-black tracking-[3px] text-primary animate-[logoPulse_4s_ease-in-out_infinite] relative">
          BRITTO<span className="text-accent" style={{ textShadow: '0 0 10px hsl(var(--accent)/0.5)' }}>★</span>
          <span className="absolute bottom-[-2px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-[lineGlow_4s_ease-in-out_infinite]" />
        </div>
        <div className="hidden md:block font-mono text-[9px] text-muted-foreground tracking-[2px] border border-border2 px-2.5 py-0.5 rounded-sm bg-card relative overflow-hidden">
          CAROUSEL_STUDIO // v4.0
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.04] to-transparent animate-[shimmer_3s_linear_infinite]" />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3.5">
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
          <div className="w-[5px] h-[5px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-[blink_1.5s_ease-in-out_infinite]" />
          <span>ONLINE</span>
        </div>

        <div className="flex items-center gap-[7px] bg-card border border-primary/40 rounded-sm py-1 md:py-1.5 px-2 md:px-3.5 font-mono text-[9px] md:text-[10px] tracking-[1px] text-neon2 relative overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
          <span>API</span>
        </div>
      </div>
    </nav>
  );
}
