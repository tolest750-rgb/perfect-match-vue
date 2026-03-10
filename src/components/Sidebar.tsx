import { useState } from "react";
import { useCarousel } from "@/lib/carousel-store";
import type { HistoryEntry, FacePreset, LayoutPreset } from "@/lib/carousel-store";
import { FaceUpload } from "./FaceUpload";
import { LayoutRefUpload } from "./LayoutRefUpload";
import { ChipGroup } from "./ChipGroup";
import type { StyleKey, LightKey, FormatKey, ResKey } from "@/lib/parser";

export function Sidebar() {
  const {
    rawText,
    setRawText,
    style,
    setStyle,
    light,
    setLight,
    fmt,
    setFmt,
    res,
    setRes,
    isGenerating,
    isStopping,
    startGeneration,
    stopGeneration,
    history,
    deleteHistory,
    loadHistory,
    facePresets,
    saveFacePreset,
    deleteFacePreset,
    applyFacePreset,
    layoutPresets,
    saveLayoutPreset,
    deleteLayoutPreset,
    applyLayoutPreset,
    faceDataUrl,
    layoutRefDataUrl,
  } = useCarousel();

  const [activeTab, setActiveTab] = useState<"config" | "history">("config");
  const [facePresetName, setFacePresetName] = useState("");
  const [layoutPresetName, setLayoutPresetName] = useState("");
  const [showFacePresets, setShowFacePresets] = useState(false);
  const [showLayoutPresets, setShowLayoutPresets] = useState(false);

  const canGenerate = rawText.trim().length > 0 && !isGenerating;

  return (
    <aside className="bg-popover border-r border-border2 flex flex-col sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto shadow-[2px_0_20px_hsl(var(--primary)/0.03)]">
      {/* Tabs */}
      <div className="flex border-b border-border2 shrink-0">
        {(["config", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 font-mono text-[9px] tracking-[2px] uppercase py-2.5 transition-all duration-200 ${
              activeTab === tab
                ? "text-primary border-b border-primary shadow-[0_1px_0_hsl(var(--primary))]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "config" ? "◈ CONFIG" : "◫ HISTÓRICO"}
          </button>
        ))}
      </div>

      {activeTab === "config" && (
        <>
          {/* Face Upload + Presets */}
          <div className="border-b border-border2">
            <FaceUpload />
            {faceDataUrl && (
              <div className="px-4 pb-3 flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <input
                    value={facePresetName}
                    onChange={(e) => setFacePresetName(e.target.value)}
                    placeholder="Nome do preset..."
                    className="flex-1 bg-card border border-border2 rounded-sm font-mono text-[10px] px-2 py-1 text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => {
                      if (facePresetName.trim()) {
                        saveFacePreset(facePresetName.trim());
                        setFacePresetName("");
                      }
                    }}
                    className="bg-transparent border border-primary/50 rounded-sm text-primary font-mono text-[8px] tracking-[1px] px-2 py-1 hover:bg-primary/10 transition-colors"
                  >
                    SALVAR
                  </button>
                </div>
                {facePresets.length > 0 && (
                  <button
                    onClick={() => setShowFacePresets((v) => !v)}
                    className="text-left font-mono text-[8px] tracking-[1px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showFacePresets ? "▾" : "▸"} PRESETS SALVOS ({facePresets.length})
                  </button>
                )}
                {showFacePresets && (
                  <div className="flex flex-col gap-1">
                    {facePresets.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-card border border-border2 rounded-sm p-1.5"
                      >
                        <img src={p.dataUrl} className="w-6 h-6 rounded-full object-cover border border-primary/30" />
                        <span className="flex-1 font-mono text-[9px] text-foreground truncate">{p.name}</span>
                        <button
                          onClick={() => applyFacePreset(p)}
                          className="font-mono text-[8px] text-primary hover:underline"
                        >
                          USAR
                        </button>
                        <button
                          onClick={() => deleteFacePreset(p.id)}
                          className="font-mono text-[8px] text-destructive hover:underline"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Layout Ref + Presets */}
          <div className="border-b border-border2">
            <LayoutRefUpload />
            {layoutRefDataUrl && (
              <div className="px-4 pb-3 flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <input
                    value={layoutPresetName}
                    onChange={(e) => setLayoutPresetName(e.target.value)}
                    placeholder="Nome do preset..."
                    className="flex-1 bg-card border border-border2 rounded-sm font-mono text-[10px] px-2 py-1 text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => {
                      if (layoutPresetName.trim()) {
                        saveLayoutPreset(layoutPresetName.trim());
                        setLayoutPresetName("");
                      }
                    }}
                    className="bg-transparent border border-primary/50 rounded-sm text-primary font-mono text-[8px] tracking-[1px] px-2 py-1 hover:bg-primary/10 transition-colors"
                  >
                    SALVAR
                  </button>
                </div>
                {layoutPresets.length > 0 && (
                  <button
                    onClick={() => setShowLayoutPresets((v) => !v)}
                    className="text-left font-mono text-[8px] tracking-[1px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showLayoutPresets ? "▾" : "▸"} PRESETS SALVOS ({layoutPresets.length})
                  </button>
                )}
                {showLayoutPresets && (
                  <div className="flex flex-col gap-1">
                    {layoutPresets.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-card border border-border2 rounded-sm p-1.5"
                      >
                        <img src={p.dataUrl} className="w-8 h-8 object-cover rounded-sm border border-primary/30" />
                        <span className="flex-1 font-mono text-[9px] text-foreground truncate">{p.name}</span>
                        <button
                          onClick={() => applyLayoutPreset(p)}
                          className="font-mono text-[8px] text-primary hover:underline"
                        >
                          USAR
                        </button>
                        <button
                          onClick={() => deleteLayoutPreset(p.id)}
                          className="font-mono text-[8px] text-destructive hover:underline"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carousel Data */}
          <div className="p-4 border-b border-border relative group">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent transition-all duration-300 group-hover:bg-primary group-hover:shadow-[0_0_8px_hsl(var(--primary))]" />
            <div className="font-mono text-[9px] tracking-[2.5px] uppercase text-muted-foreground mb-2.5 flex items-center gap-2">
              <span className="text-primary" style={{ textShadow: "0 0 6px hsl(var(--primary))" }}>
                ◈
              </span>
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
              Separe slides com{" "}
              <code className="bg-card-2 border border-border2 px-1 py-0.5 rounded-sm font-mono text-[9px] text-neon2">
                ---
              </code>
              . Use campos: TÍTULO, SUBTÍTULO, CTA, VISUAL
            </div>
          </div>

          {/* Parameters */}
          <div className="p-4 border-b border-border relative group">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent transition-all duration-300 group-hover:bg-primary group-hover:shadow-[0_0_8px_hsl(var(--primary))]" />
            <div className="font-mono text-[9px] tracking-[2.5px] uppercase text-muted-foreground mb-2.5 flex items-center gap-2">
              <span className="text-primary" style={{ textShadow: "0 0 6px hsl(var(--primary))" }}>
                ◈
              </span>
              PARAMETERS
              <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
            </div>
            <ChipGroup
              label="STYLE"
              value={style}
              onChange={(v) => setStyle(v as StyleKey)}
              options={[
                { value: "cinematic", icon: "🎬", label: "CINE" },
                { value: "corporate", icon: "💼", label: "CORP" },
                { value: "futuristic", icon: "🔮", label: "FUTR" },
                { value: "editorial", icon: "📰", label: "EDIT" },
              ]}
            />
            <ChipGroup
              label="LIGHTING"
              value={light}
              onChange={(v) => setLight(v as LightKey)}
              options={[
                { value: "dramatic", icon: "⚡", label: "DRAM" },
                { value: "warm", icon: "🌅", label: "WARM" },
                { value: "green", icon: "💚", label: "NEON" },
                { value: "moody", icon: "🌑", label: "MOOD" },
              ]}
            />
            <ChipGroup
              label="FORMAT"
              value={fmt}
              onChange={(v) => setFmt(v as FormatKey)}
              options={[
                { value: "4:5", icon: "▯", label: "4:5" },
                { value: "9:16", icon: "▮", label: "9:16" },
                { value: "1:1", icon: "◻", label: "1:1" },
              ]}
            />
            <ChipGroup
              label="RESOLUTION"
              value={res}
              onChange={(v) => setRes(v as ResKey)}
              options={[
                { value: "1K", label: "1K" },
                { value: "2K", label: "2K" },
                { value: "4K", label: "4K" },
              ]}
            />
          </div>

          {/* Generate / Stop */}
          <div className="p-4 flex flex-col gap-2">
            <button
              onClick={startGeneration}
              disabled={!canGenerate}
              className="w-full bg-transparent border border-primary rounded-sm text-primary font-logo text-[11px] font-bold tracking-[3px] uppercase py-3.5 cursor-pointer transition-all duration-300 flex items-center justify-center gap-2.5 relative overflow-hidden shadow-[0_0_16px_hsl(var(--primary)/0.12),inset_0_0_16px_hsl(var(--primary)/0.04)] hover:bg-primary/[0.08] hover:shadow-[0_0_28px_hsl(var(--primary)/0.25),inset_0_0_24px_hsl(var(--primary)/0.08)] hover:-translate-y-px disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              style={{ textShadow: "0 0 10px hsl(var(--primary))" }}
            >
              {isGenerating && (
                <div className="w-3.5 h-3.5 border border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
              )}
              <span>{isGenerating ? "PROCESSANDO..." : "◈ INICIAR GERAÇÃO"}</span>
            </button>
            {isGenerating && (
              <button
                onClick={stopGeneration}
                disabled={isStopping}
                className="w-full bg-transparent border border-destructive/60 rounded-sm text-destructive font-mono text-[10px] tracking-[2px] uppercase py-2 cursor-pointer transition-all duration-200 hover:bg-destructive/10 hover:border-destructive disabled:opacity-40"
              >
                {isStopping ? "PARANDO..." : "◼ PARAR GERAÇÃO"}
              </button>
            )}
          </div>
        </>
      )}

      {activeTab === "history" && (
        <div className="flex flex-col gap-0 flex-1">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground p-8">
              <span className="text-3xl opacity-20">◫</span>
              <span className="font-mono text-[9px] tracking-[2px]">NENHUM HISTÓRICO</span>
            </div>
          ) : (
            history.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} onLoad={loadHistory} onDelete={deleteHistory} />
            ))
          )}
        </div>
      )}
    </aside>
  );
}

function HistoryCard({
  entry,
  onLoad,
  onDelete,
}: {
  entry: HistoryEntry;
  onLoad: (e: HistoryEntry) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const date = new Date(entry.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const copyRaw = () => navigator.clipboard.writeText(entry.rawText);
  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(entry.id);
  };

  return (
    <div className="border-b border-border2 p-3 flex gap-2.5 hover:bg-card/40 transition-colors group/hcard">
      {entry.thumbUrl && (
        <img src={entry.thumbUrl} className="w-12 h-[60px] object-cover rounded-sm border border-border2 shrink-0" />
      )}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[8px] text-muted-foreground">{date}</span>
          <span className="font-mono text-[7px] bg-primary/10 text-primary border border-primary/20 px-1 rounded-sm">
            {entry.slideCount} slides
          </span>
          <span className="font-mono text-[7px] bg-card-2 border border-border2 text-muted-foreground px-1 rounded-sm">
            {entry.fmt}
          </span>
        </div>
        <p className="font-mono text-[9px] text-foreground leading-relaxed line-clamp-2 break-words">
          {entry.rawText.slice(0, 80)}…
        </p>
        <div className="flex gap-1 mt-0.5">
          <button
            onClick={() => onLoad(entry)}
            className="font-mono text-[8px] tracking-[1px] bg-card border border-border2 rounded-sm px-2 py-0.5 text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            ↩ CARREGAR
          </button>
          <button
            onClick={copyRaw}
            className="font-mono text-[8px] tracking-[1px] bg-card border border-border2 rounded-sm px-2 py-0.5 text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            ⎘ COPIAR
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="font-mono text-[8px] tracking-[1px] bg-card border border-border2 rounded-sm px-2 py-0.5 text-destructive hover:border-destructive transition-colors disabled:opacity-40"
          >
            {deleting ? "..." : "✕"}
          </button>
        </div>
      </div>
    </div>
  );
}
