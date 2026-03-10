import { useState } from 'react';
import { useCarousel } from '@/lib/carousel-store';

export function ApiModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apiKey, demo, setApiKey, setDemo, testApi, saveConfig } = useCarousel();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    const result = await testApi();
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    saveConfig();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-background/[0.92] backdrop-blur-xl z-[600] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-popover border border-border2 rounded-sm w-full max-w-[460px] max-h-[88vh] overflow-y-auto relative shadow-[0_0_40px_hsl(var(--primary)/0.08),0_0_80px_hsl(var(--primary)/0.04)]">
        <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-primary opacity-80 shadow-[-2px_-2px_8px_hsl(var(--neon-dim)/0.07)]" />
        <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-primary opacity-80 shadow-[2px_2px_8px_hsl(var(--neon-dim)/0.07)]" />

        {/* Header */}
        <div className="p-4 border-b border-border2 flex items-center justify-between">
          <span className="font-mono text-[11px] text-neon2 tracking-[2px] uppercase">API_CONFIG</span>
          <button
            onClick={onClose}
            className="bg-transparent border border-border2 text-muted-foreground text-sm cursor-pointer w-6 h-6 flex items-center justify-center transition-all duration-200 rounded-sm hover:border-destructive hover:text-destructive hover:shadow-[0_0_8px_hsl(var(--red)/0.2)]"
          >✕</button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          <div className="bg-card border border-border2 rounded-sm p-2.5 font-mono text-[9px] leading-relaxed text-muted-foreground tracking-[0.3px]">
            Modelo: <strong className="text-neon2">gemini-3-pro-image-preview</strong><br />
            Endpoint: <code className="bg-card-2 border border-border2 px-1 py-0.5 rounded-sm font-mono text-[9px] text-neon2">generativelanguage.googleapis.com/v1beta</code><br /><br />
            O <strong className="text-neon2">rosto de referência</strong> é enviado como <code className="bg-card-2 border border-border2 px-1 py-0.5 rounded-sm font-mono text-[9px] text-neon2">inline_data</code> (base64 JPEG). São feitas <strong className="text-neon2">4 chamadas paralelas</strong> por slide.
          </div>

          <div>
            <label className="block font-mono text-[9px] tracking-[1.5px] uppercase text-muted-foreground mb-1">
              GOOGLE AI STUDIO API KEY <span className="text-primary">*</span>
            </label>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="flex-1 bg-card border border-border2 rounded-sm text-foreground font-mono text-[11px] py-2 px-3 outline-none transition-all duration-200 caret-primary focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_0_16px_hsl(var(--primary)/0.06),inset_0_0_8px_hsl(var(--primary)/0.04)] focus:text-neon2 placeholder:text-muted-foreground"
              />
              <button
                onClick={handleTest}
                disabled={testing}
                className="bg-card border border-border2 rounded-sm text-foreground font-mono text-[9px] tracking-[1px] px-3 cursor-pointer whitespace-nowrap transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-[0_0_8px_hsl(var(--neon-dim)/0.07)]"
              >
                {testing ? '...' : 'TEST'}
              </button>
            </div>
            {testResult && (
              <div className={`font-mono text-[8px] font-bold mt-1 px-2 py-1 rounded-sm tracking-[0.5px] ${testResult.ok ? 'bg-primary/[0.06] text-primary border border-primary/[0.15]' : 'bg-destructive/[0.06] text-destructive border border-destructive/[0.15]'}`}>
                &gt;&gt; {testResult.ok ? 'STATUS: ' : 'ERROR: '}{testResult.message}
              </div>
            )}
            <div className="font-mono text-[8px] text-muted-foreground mt-1 tracking-[0.5px]">
              &gt;&gt; <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">aistudio.google.com/app/apikey</a>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[9px] tracking-[1.5px] uppercase text-muted-foreground mb-1">MODO</label>
            <div className="flex gap-1 max-w-[220px]">
              {[
                { val: true, icon: '🧪', label: 'DEMO' },
                { val: false, icon: '🔗', label: 'REAL' },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => setDemo(opt.val)}
                  className={`flex-1 bg-card border rounded-sm font-mono text-[9px] py-1.5 px-1 cursor-pointer transition-all duration-200 text-center flex flex-col items-center gap-0.5 select-none ${demo === opt.val ? 'bg-primary/[0.06] border-primary text-primary' : 'border-border2 text-muted-foreground hover:border-primary hover:text-primary'}`}
                >
                  <span className="text-[13px]">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            {demo && (
              <div className="font-mono text-[8px] text-warning mt-1 tracking-[0.5px]">
                &gt;&gt; DEMO: composição tipográfica real sem chamada à API.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border2 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-card border border-border2 rounded-sm text-foreground font-mono text-[9px] tracking-[1px] py-1.5 px-3 cursor-pointer transition-all duration-200 hover:border-primary hover:text-primary"
          >CANCEL</button>
          <button
            onClick={handleSave}
            className="bg-primary/[0.05] border border-primary/40 rounded-sm text-primary font-mono text-[9px] tracking-[1px] py-1.5 px-3 cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-[0_0_10px_hsl(var(--neon-dim)/0.07)]"
          >◈ SALVAR</button>
        </div>
      </div>
    </div>
  );
}
