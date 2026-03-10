import { useRef } from 'react';
import { useCarousel } from '@/lib/carousel-store';

export function FaceUpload() {
  const { faceDataUrl, faceName, setFace } = useCarousel();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFace(file);
  };

  return (
    <div className="p-4 border-b border-border relative group">
      <div className="font-mono text-[9px] tracking-[2.5px] uppercase text-muted-foreground mb-2.5 flex items-center gap-2">
        <span className="text-primary" style={{ textShadow: '0 0 6px hsl(var(--primary))' }}>◈</span>
        FACE_REFERENCE
        <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="border border-border2 rounded-sm p-3 flex items-center gap-3 cursor-pointer transition-all duration-300 relative overflow-hidden bg-card hover:border-primary hover:shadow-[0_0_20px_hsl(var(--primary)/0.08),inset_0_0_20px_hsl(var(--primary)/0.03)]"
      >
        <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />

        <div className="absolute top-0 left-0 w-3 h-0.5 bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
        <div className="absolute bottom-0 right-0 w-3 h-0.5 bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />

        <div className="relative w-[50px] h-[50px] shrink-0">
          <span className="absolute inset-[-3px] rounded-full border border-transparent border-t-primary border-r-primary animate-[faceRingSpin_3s_linear_infinite]" />
          <span className="absolute inset-[-6px] rounded-full border border-transparent border-b-primary/30 animate-[faceRingSpin_5s_linear_infinite_reverse]" />
          {faceDataUrl ? (
            <img src={faceDataUrl} alt="face" className="w-[50px] h-[50px] rounded-full object-cover border border-primary relative z-[1]" />
          ) : (
            <div className="w-[50px] h-[50px] rounded-full border border-primary bg-card flex items-center justify-center text-primary text-lg relative z-[1]">◈</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] text-neon2 tracking-[0.5px] truncate">
            {faceName || 'UPLOAD_FACE_REF'}
          </div>
          <div className="font-mono text-[8px] text-muted-foreground mt-0.5 tracking-[0.5px]">
            {faceDataUrl ? 'IDENTITY_LOCKED' : 'CLICK_TO_SELECT'}
          </div>
          {faceDataUrl && (
            <span className="inline-block bg-primary/[0.08] text-primary font-mono text-[7px] font-bold px-1.5 py-0.5 rounded-sm mt-1 tracking-[1px] border border-primary/20">
              LOADED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
