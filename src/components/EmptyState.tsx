import { useMemo } from 'react';

export function EmptyState() {
  const hexes = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 4}s`,
      size: `${40 + Math.random() * 60}px`,
    })),
  []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10 min-h-[440px] relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_60%,hsl(var(--primary)/0.04),transparent)]" />

      {/* Hex grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {hexes.map(h => (
          <div
            key={h.id}
            className="absolute border border-primary/[0.06] animate-[hexPulse_4s_ease-in-out_infinite]"
            style={{
              left: h.left,
              top: h.top,
              animationDelay: h.delay,
              width: h.size,
              height: h.size,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          />
        ))}
      </div>

      <div className="text-[56px] animate-[emFloat_3s_ease-in-out_infinite] relative z-10" style={{ filter: 'drop-shadow(0 0 20px hsl(var(--primary)/0.4))' }}>◈</div>
      <div className="font-logo text-[16px] text-primary tracking-[3px] relative z-10" style={{ textShadow: '0 0 12px hsl(var(--primary)/0.25)' }}>
        CAROUSEL STUDIO
      </div>
      <div className="font-mono text-[10px] text-muted-foreground max-w-[360px] leading-relaxed tracking-[0.5px] relative z-10">
        Configure <strong className="text-neon2">FACE_REFERENCE</strong> e cole o conteúdo do carousel no painel lateral.
        <br />Ajuste <strong className="text-neon2">STYLE</strong>, <strong className="text-neon2">LIGHTING</strong> e <strong className="text-neon2">FORMAT</strong>, depois clique em <strong className="text-neon2">INICIAR GERAÇÃO</strong>.
      </div>
    </div>
  );
}
