export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  if (!src) return null;
  return (
    <div
      className="fixed inset-0 bg-background/[0.97] z-[700] flex items-center justify-center p-5 cursor-zoom-out"
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        className="max-w-[88vw] max-h-[88vh] rounded-sm object-contain border border-border2 shadow-[0_0_40px_hsl(var(--primary)/0.08)]"
      />
    </div>
  );
}
