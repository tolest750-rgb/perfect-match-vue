import { useState } from "react";
import { useCarousel } from "@/lib/carousel-store";
import { supabase } from "@/integrations/supabase/client";
import type { ProcessedSlide } from "@/lib/parser";

interface SlideCardProps {
  slide: ProcessedSlide;
  index: number;
  onImageClick: (src: string) => void;
  selectedVars?: Set<string>; // "slideIndex_varIndex"
  onToggleVar?: (key: string) => void;
  selectionMode?: boolean;
}

async function upscaleBlob(blob: Blob): Promise<Blob> {
  try {
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });

    const { data, error } = await supabase.functions.invoke("upscale-image", {
      body: { imageB64: b64, scale: 4 },
    });

    if (error) {
      console.error("[upscale] Edge function error:", error);
      return blob;
    }

    if (data?.imageUrl) {
      const imgRes = await fetch(data.imageUrl);
      if (imgRes.ok) return await imgRes.blob();
    }

    return blob;
  } catch (e) {
    console.error("[upscale] Error:", e);
    return blob;
  }
}

export function SlideCard({ slide, index, onImageClick, selectedVars, onToggleVar, selectionMode }: SlideCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [enhancing, setEnhancing] = useState<Record<string, boolean>>({});
  const { varUrls, varStatuses, varErrors, slideStatuses, slideSteps, regenVar, getVarBlob, faceDataUrl } =
    useCarousel();

  const status = slideStatuses[index] || "idle";
  const statusLabel = { idle: "IDLE", processing: "PROCESSING", complete: "COMPLETE", error: "ERROR" }[status];
  const statusClass = {
    idle: "bg-card-2 text-muted-foreground border-border",
    processing: "bg-warning/[0.08] text-warning border-warning/20",
    complete: "bg-primary/[0.08] text-primary border-primary/20 shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)]",
    error: "bg-destructive/[0.08] text-destructive border-destructive/20",
  }[status];

  const stepStatus = (step: number) => slideSteps[`${index}_${step}`] || "";
  const stepClass = (step: number) => {
    const s = stepStatus(step);
    if (s === "active")
      return "bg-warning/[0.06] text-warning border-warning/20 animate-[stepGlow_1s_ease-in-out_infinite]";
    if (s === "done")
      return "bg-primary/[0.05] text-primary border-primary/20 shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)]";
    if (s === "error") return "bg-destructive/[0.06] text-destructive border-destructive/20";
    return "bg-card-2 text-muted-foreground border-border";
  };

  const fmtClass =
    { "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "1:1": "aspect-square" }[slide.fmt] || "aspect-[4/5]";

  const dlOne = async (varIdx: number) => {
    const blob = getVarBlob(index, varIdx);
    if (!blob) return;
    const key = `${index}_${varIdx}`;
    setEnhancing((p) => ({ ...p, [key]: true }));
    try {
      const enhanced = await upscaleBlob(blob);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(enhanced);
      a.download = `slide-${String(slide.n).padStart(2, "0")}-v${varIdx + 1}-4K.png`;
      a.click();
    } finally {
      setEnhancing((p) => ({ ...p, [key]: false }));
    }
  };

  const dlAllZip = async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const folder = zip.folder(`carousel-sl${String(slide.n).padStart(2, "0")}`)!;
    setEnhancing((p) => ({ ...p, [`${index}_zip`]: true }));
    try {
      await Promise.all(
        [0, 1, 2, 3].map(async (v) => {
          const blob = getVarBlob(index, v);
          if (!blob) return;
          const enhanced = await upscaleBlob(blob);
          folder.file(`slide-${String(slide.n).padStart(2, "0")}-v${v + 1}-4K.png`, enhanced);
        }),
      );
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `carousel-slide-${String(slide.n).padStart(2, "0")}-4K.zip`;
      a.click();
    } finally {
      setEnhancing((p) => ({ ...p, [`${index}_zip`]: false }));
    }
  };

  return (
    <div className="bg-card border border-border2 rounded-sm overflow-hidden transition-all duration-300 relative hover:border-primary/25 hover:shadow-[0_0_24px_hsl(var(--primary)/0.04)] group/card">
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary opacity-60 transition-all duration-300 group-hover/card:w-4 group-hover/card:h-4 group-hover/card:opacity-100 group-hover/card:shadow-[0_0_6px_hsl(var(--primary))]" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary opacity-60 transition-all duration-300 group-hover/card:w-4 group-hover/card:h-4 group-hover/card:opacity-100 group-hover/card:shadow-[0_0_6px_hsl(var(--primary))]" />

      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between py-2.5 px-3.5 border-b border-border cursor-pointer select-none gap-2 transition-colors duration-200 relative overflow-hidden hover:before:opacity-100 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/[0.04] before:to-transparent before:opacity-0 before:transition-opacity before:duration-200"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 relative z-10">
          <span
            className="bg-transparent border border-primary text-primary font-mono text-[8px] tracking-[2px] py-0.5 px-2 rounded-sm whitespace-nowrap shrink-0"
            style={{
              textShadow: "0 0 6px hsl(var(--primary))",
              boxShadow: "0 0 6px hsl(var(--neon-dim)/0.07), inset 0 0 6px hsl(var(--neon-dim)/0.07)",
            }}
          >
            SL_{String(slide.n).padStart(2, "0")}
          </span>
          <span
            className={`font-mono text-[7px] tracking-[1.5px] py-0.5 px-[7px] rounded-sm whitespace-nowrap uppercase border shrink-0 ${statusClass}`}
          >
            {statusLabel}
          </span>
          <span className="font-ui text-xs text-muted-foreground font-normal whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0">
            {slide.titulo}
          </span>
        </div>
        <span
          className={`text-[10px] transition-transform duration-200 shrink-0 ${expanded ? "rotate-180 text-primary" : "text-muted-foreground"}`}
        >
          ▾
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div>
          {/* Step bar */}
          <div className="flex gap-1 items-center py-2 px-3.5 bg-background/40 border-b border-border flex-wrap">
            <span
              className={`font-mono text-[8px] tracking-[1px] py-0.5 px-2 rounded-sm border whitespace-nowrap transition-all duration-300 ${stepClass(1)}`}
            >
              ① IMG_GEN×4
            </span>
            <span className="text-border2 text-[10px]">›</span>
            <span
              className={`font-mono text-[8px] tracking-[1px] py-0.5 px-2 rounded-sm border whitespace-nowrap transition-all duration-300 ${stepClass(2)}`}
            >
              ② COMPOSITOR
            </span>
            <span className="text-border2 text-[10px]">›</span>
            <span
              className={`font-mono text-[8px] tracking-[1px] py-0.5 px-2 rounded-sm border whitespace-nowrap transition-all duration-300 ${stepClass(3)}`}
            >
              ③ FINAL
            </span>
          </div>

          {/* Variations Grid */}
          <div className="p-3.5">
            <div className="font-mono text-[9px] tracking-[2px] uppercase text-muted-foreground mb-2.5 flex items-center gap-2 before:content-['◈'] before:text-primary after:content-[''] after:flex-1 after:h-px after:bg-gradient-to-r after:from-border2 after:to-transparent">
              VARIAÇÕES // {slide.num}
            </div>

            <div className="grid grid-cols-4 gap-2 max-[1200px]:grid-cols-2 max-[600px]:grid-cols-1">
              {[0, 1, 2, 3].map((v) => {
                const key = `${index}_${v}`;
                const varStatus = varStatuses[key] || "idle";
                const url = varUrls[key];

                return (
                  <div
                    key={v}
                    className={`bg-background border rounded-sm overflow-hidden flex flex-col relative transition-all duration-300 group/var ${
                      selectionMode && selectedVars?.has(key)
                        ? "border-primary shadow-[0_0_16px_hsl(var(--primary)/0.25)]"
                        : "border-border2 hover:border-primary/25 hover:shadow-[0_0_16px_hsl(var(--primary)/0.06)]"
                    }`}
                  >
                    <div className="font-mono text-[7px] text-muted-foreground py-1 px-[7px] tracking-[2px] uppercase flex items-center gap-1">
                      <span
                        className={`w-1 h-1 rounded-full shrink-0 transition-all duration-300 ${varStatus === "done" ? "bg-primary shadow-[0_0_4px_hsl(var(--primary))]" : "bg-border2"} group-hover/var:bg-primary group-hover/var:shadow-[0_0_4px_hsl(var(--primary))]`}
                      />
                      VAR_{v + 1}
                    </div>
                    <div className={`relative overflow-hidden bg-background ${fmtClass}`}>
                      {varStatus === "generating" ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground font-mono text-[8px] tracking-[1px]">
                          <div className="w-5 h-5 border border-border2 border-t-primary rounded-full animate-spin shadow-[0_0_8px_hsl(var(--neon-dim)/0.07)]" />
                          <span>GERANDO</span>
                        </div>
                      ) : varStatus === "error" ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
                          <span className="text-xl text-destructive">✕</span>
                          <span className="text-[7px] text-destructive tracking-[1px] font-mono">FALHOU</span>
                          {varErrors?.[key] && (
                            <span className="text-[8px] text-destructive/70 font-mono text-center leading-relaxed break-words max-w-full bg-destructive/[0.07] border border-destructive/20 rounded-sm px-2 py-1.5">
                              {varErrors[key].slice(0, 180)}
                              {varErrors[key].length > 180 ? "…" : ""}
                            </span>
                          )}
                          <button
                            onClick={() => regenVar(index, v)}
                            className="font-mono text-[8px] tracking-[1px] border border-destructive/40 text-destructive rounded-sm px-2.5 py-1 hover:bg-destructive/10 transition-colors mt-1"
                          >
                            ↺ TENTAR NOVAMENTE
                          </button>
                        </div>
                      ) : url ? (
                        <>
                          <img
                            src={url}
                            alt=""
                            onClick={() => (selectionMode ? onToggleVar?.(key) : onImageClick(url))}
                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 opacity-100 hover:brightness-105 ${selectionMode ? "cursor-pointer" : "cursor-zoom-in"}`}
                          />
                          {/* Checkbox de seleção */}
                          {selectionMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleVar?.(key);
                              }}
                              className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all duration-150 z-10 ${
                                selectedVars?.has(key)
                                  ? "bg-primary border-primary text-black shadow-[0_0_8px_hsl(var(--primary))]"
                                  : "bg-black/40 border-white/60 backdrop-blur-sm hover:border-primary"
                              }`}
                            >
                              {selectedVars?.has(key) && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path
                                    d="M1.5 5L4 7.5L8.5 2.5"
                                    stroke="black"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                          {!selectionMode && (
                            <span className="absolute top-1 right-1 bg-primary text-primary-foreground font-mono text-[7px] font-bold py-0.5 px-1 rounded-sm tracking-[1px] uppercase">
                              OK
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground font-mono text-[8px] tracking-[1px]">
                          <span className="text-[22px] opacity-20 transition-all duration-300 group-hover/var:opacity-40">
                            ◈
                          </span>
                          <span>AGUARDANDO</span>
                        </div>
                      )}
                    </div>
                    {url && (
                      <div className="flex gap-0.5 p-1">
                        <button
                          onClick={() => dlOne(v)}
                          disabled={enhancing[`${index}_${v}`]}
                          className="flex-1 bg-card border border-border rounded-sm text-muted-foreground font-mono text-[8px] tracking-[0.5px] py-1 cursor-pointer transition-all duration-200 text-center hover:bg-primary/[0.06] hover:border-primary hover:text-primary hover:shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)] disabled:opacity-40"
                        >
                          {enhancing[`${index}_${v}`] ? "↑ UPSCALING..." : "▼ 4K"}
                        </button>
                        <button
                          onClick={() => regenVar(index, v)}
                          className="flex-1 bg-card border border-border rounded-sm text-muted-foreground font-mono text-[8px] tracking-[0.5px] py-1 cursor-pointer transition-all duration-200 text-center hover:bg-primary/[0.06] hover:border-primary hover:text-primary hover:shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)]"
                        >
                          ↺ REGEN
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {[0, 1, 2, 3].some((v) => !!varUrls[`${index}_${v}`]) && (
              <button
                onClick={dlAllZip}
                disabled={enhancing[`${index}_zip`]}
                className="w-full mt-2 bg-transparent border border-primary/40 rounded-sm text-primary font-mono text-[9px] tracking-[1.5px] uppercase py-1.5 cursor-pointer transition-all duration-200 hover:bg-primary/[0.06] hover:border-primary hover:shadow-[0_0_12px_hsl(var(--primary)/0.15)] disabled:opacity-40"
              >
                {enhancing[`${index}_zip`] ? "↑ UPSCALING + ZIP..." : "▼ TODAS · ZIP · 4K ENHANCE"}
              </button>
            )}
          </div>

          {/* Prompts section */}
          <div className="px-3.5 pb-3.5 flex flex-col gap-2">
            {/* Face ref */}
            {slide.useFaceRef && faceDataUrl && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-mono text-[8px] tracking-[1.5px] uppercase text-muted-foreground">
                    ◈ FACE_REF{" "}
                    <span className="font-mono text-[7px] tracking-[1px] py-0.5 px-1.5 rounded-sm uppercase bg-primary/[0.05] text-neon2 border border-primary/[0.15]">
                      ATIVO
                    </span>
                  </div>
                </div>
                <div className="bg-background border border-border2 rounded-sm p-2 flex items-center gap-2.5 transition-colors duration-200 hover:border-primary/20">
                  <img
                    src={faceDataUrl}
                    alt="face"
                    className="w-[30px] h-[30px] rounded-full object-cover border border-primary shadow-[0_0_8px_hsl(var(--neon-dim)/0.07)]"
                  />
                  <div className="font-mono text-[8px] text-muted-foreground leading-relaxed tracking-[0.3px]">
                    Identidade facial enviada como referência
                  </div>
                </div>
              </div>
            )}

            {!slide.useFaceRef && visualHasNamedPerson(slide.visual) && (
              <div className="bg-background border border-border2 rounded-sm p-2 font-mono text-[8px] text-muted-foreground">
                ◈ FACE_REF <span className="text-warning">OMITIDO</span> — nome próprio detectado no VISUAL
              </div>
            )}

            {/* Positive */}
            <PromptBlock
              label="POSITIVE"
              tag="GEMINI"
              tagClass="bg-primary/[0.07] text-primary border-primary/20"
              text={slide.prompt.pos}
            />
            {/* Negative */}
            <PromptBlock
              label="NEGATIVE"
              tag="EXCLUSÃO"
              tagClass="bg-destructive/[0.07] text-destructive border-destructive/20"
              text={slide.prompt.neg}
              textClass="text-[#7a3a3a]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to check named person in visual (imported logic)
function visualHasNamedPerson(visual: string): boolean {
  const v = (visual ?? "").toLowerCase();
  const knownNames = ["elon musk", "steve jobs", "bill gates", "mark zuckerberg"];
  if (knownNames.some((n) => v.includes(n))) return true;
  const pattern = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})+\b/g;
  return (visual.match(pattern) || []).length > 0;
}

function PromptBlock({
  label,
  tag,
  tagClass,
  text,
  textClass,
}: {
  label: string;
  tag: string;
  tagClass: string;
  text: string;
  textClass?: string;
}) {
  const copyText = () => navigator.clipboard.writeText(text);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 font-mono text-[8px] tracking-[1.5px] uppercase text-muted-foreground">
          ◈ {label}{" "}
          <span className={`font-mono text-[7px] tracking-[1px] py-0.5 px-1.5 rounded-sm uppercase border ${tagClass}`}>
            {tag}
          </span>
        </div>
        <button
          onClick={copyText}
          className="bg-transparent border border-border2 rounded-sm text-muted-foreground cursor-pointer font-mono text-[8px] tracking-[0.5px] py-0.5 px-2 transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)]"
        >
          COPY
        </button>
      </div>
      <div
        className={`bg-background border border-border rounded-sm font-mono text-[9px] leading-relaxed p-2.5 whitespace-pre-wrap break-words max-h-[110px] overflow-y-auto transition-all duration-200 hover:border-border2 ${textClass || "text-[#3a7a5a] hover:text-[#5aaa7a]"}`}
      >
        {text}
      </div>
    </div>
  );
}
