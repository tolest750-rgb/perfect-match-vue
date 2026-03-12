import { useState, useMemo } from "react";
import { useCarousel } from "@/lib/carousel-store";
import type { HistoryEntry, FacePreset, LayoutPreset } from "@/lib/carousel-store";
import { FaceUpload } from "./FaceUpload";
import { LayoutRefUpload } from "./LayoutRefUpload";
import { ChipGroup } from "./ChipGroup";
import type { StyleKey, LightKey, FormatKey, ResKey } from "@/lib/parser";

// ─── API CONFIG (legacy exports kept for compatibility) ──────
export interface GeminiKeyEntry {
  id: string;
  name: string;
  key: string;
  addedAt: number;
  failedAt?: number;
}
export interface ApiConfig {
  geminiKeys: GeminiKeyEntry[];
}
export function loadApiConfig(): ApiConfig { return { geminiKeys: [] }; }
export function saveApiConfig(_cfg: ApiConfig) {}
export function markKeyFailed(cfg: ApiConfig, _keyId: string): ApiConfig { return cfg; }
export function getOrderedGeminiKeys(_cfg: ApiConfig): GeminiKeyEntry[] { return []; }

// ─── PARSER VISUAL ────────────────────────────────────────────
interface SlideBlock {
  num: number;
  titulo?: string;
  subtitulo?: string;
  cta?: string;
  visual?: string;
  design?: string;
}
function parseRawToBlocks(raw: string): SlideBlock[] {
  if (!raw.trim()) return [];
  const chunks = raw.split(/\n\s*---\s*\n/);
  return chunks.map((chunk, i) => {
    const get = (keys: string[]) => {
      for (const key of keys) {
        const re = new RegExp(
          `(?:^|\\n)\\s*${key}\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:TÍTULO|TITULO|SUBTÍTULO|SUBTITULO|CALL TO ACTION|CTA|VISUAL|OBSERVAÇÃO|OBSERVACAO|$))`,
          "i",
        );
        const m = chunk.match(re);
        if (m) return m[1].trim();
      }
      for (const key of keys) {
        const re = new RegExp(`(?:^|\\n)\\s*${key}\\s*:\\s*(.+)`, "i");
        const m = chunk.match(re);
        if (m) return m[1].trim();
      }
      return undefined;
    };
    return {
      num: i + 1,
      titulo: get(["TÍTULO", "TITULO", "TITLE"]),
      subtitulo: get(["SUBTÍTULO", "SUBTITULO", "SUBTITLE"]),
      cta: get(["CALL TO ACTION", "CTA"]),
      visual: get(["VISUAL"]),
      design: get(["OBSERVAÇÃO DE DESIGN", "OBSERVACAO DE DESIGN", "DESIGN"]),
    };
  });
}

// ─── SIDEBAR ─────────────────────────────────────────────────
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
  const [showFacePresets, setShowFacePresets] = useState(true);
  const [showLayoutPresets, setShowLayoutPresets] = useState(true);
  const [textMode, setTextMode] = useState<"edit" | "preview">("edit");
  const [copied, setCopied] = useState(false);

  // ── Text helpers ────────────────────────────────────────────
  const canGenerate = rawText.trim().length > 0 && !isGenerating;
  const slideBlocks = useMemo(() => parseRawToBlocks(rawText), [rawText]);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const handleClear = () => {
    if (!rawText.trim()) return;
    if (window.confirm("Apagar todo o texto do roteiro?")) {
      setRawText("");
      setTextMode("edit");
    }
  };

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
          {/* ── Face Upload + Presets ───────────────────────── */}
          <div className="border-b border-border2">
            <FaceUpload />
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {faceDataUrl && (
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
              )}
              {facePresets.length > 0 && (
                <>
                  <button
                    onClick={() => setShowFacePresets((v) => !v)}
                    className="text-left font-mono text-[8px] tracking-[1px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showFacePresets ? "▾" : "▸"} FACE PRESETS ({facePresets.length})
                  </button>
                  {showFacePresets && (
                    <div className="flex flex-col gap-1">
                      {facePresets.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => applyFacePreset(p)}
                          title={`Usar: ${p.name}`}
                          className="flex items-center gap-2 bg-card border border-border2 rounded-sm p-1.5 cursor-pointer hover:border-primary hover:bg-primary/[0.04] transition-all duration-150 group/fp"
                        >
                          <img
                            src={p.dataUrl}
                            className="w-6 h-6 rounded-full object-cover border border-primary/30 group-hover/fp:border-primary transition-colors"
                          />
                          <span className="flex-1 font-mono text-[9px] text-foreground truncate">{p.name}</span>
                          <span className="font-mono text-[7px] text-primary opacity-0 group-hover/fp:opacity-100 transition-opacity tracking-[1px]">
                            USAR ↵
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFacePreset(p.id);
                            }}
                            className="font-mono text-[8px] text-muted-foreground hover:text-destructive transition-colors ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Layout Ref + Presets ────────────────────────── */}
          <div className="border-b border-border2">
            <LayoutRefUpload />
            <div className="px-4 pb-3 flex flex-col gap-1.5">
              {layoutRefDataUrl && (
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
              )}
              {layoutPresets.length > 0 && (
                <>
                  <button
                    onClick={() => setShowLayoutPresets((v) => !v)}
                    className="text-left font-mono text-[8px] tracking-[1px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {showLayoutPresets ? "▾" : "▸"} LAYOUT PRESETS ({layoutPresets.length})
                  </button>
                  {showLayoutPresets && (
                    <div className="flex flex-col gap-1">
                      {layoutPresets.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => applyLayoutPreset(p)}
                          title={`Usar: ${p.name}`}
                          className="flex items-center gap-2 bg-card border border-border2 rounded-sm p-1.5 cursor-pointer hover:border-primary hover:bg-primary/[0.04] transition-all duration-150 group/lp"
                        >
                          <img
                            src={p.dataUrl}
                            className="w-8 h-8 object-cover rounded-sm border border-primary/30 group-hover/lp:border-primary transition-colors"
                          />
                          <span className="flex-1 font-mono text-[9px] text-foreground truncate">{p.name}</span>
                          <span className="font-mono text-[7px] text-primary opacity-0 group-hover/lp:opacity-100 transition-opacity tracking-[1px]">
                            USAR ↵
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLayoutPreset(p.id);
                            }}
                            className="font-mono text-[8px] text-muted-foreground hover:text-destructive transition-colors ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Carousel Data ───────────────────────────────── */}
          <div className="p-4 border-b border-border relative group">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent transition-all duration-300 group-hover:bg-primary group-hover:shadow-[0_0_8px_hsl(var(--primary))]" />
            <div className="font-mono text-[9px] tracking-[2.5px] uppercase text-muted-foreground mb-2 flex items-center gap-2">
              <span className="text-primary" style={{ textShadow: "0 0 6px hsl(var(--primary))" }}>
                ◈
              </span>
              CAROUSEL_DATA
              {slideBlocks.length > 0 && (
                <span className="font-mono text-[7px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-sm">
                  {slideBlocks.length} SL
                </span>
              )}
              <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
            </div>

            {rawText.trim().length > 0 && (
              <div className="flex gap-1 mb-2">
                {(["edit", "preview"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTextMode(mode)}
                    className={`flex-1 font-mono text-[8px] tracking-[1px] py-1 rounded-sm border transition-all duration-150 ${textMode === mode ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border2 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                  >
                    {mode === "edit" ? "✎ EDITAR" : "◧ PREVIEW"}
                  </button>
                ))}
              </div>
            )}

            {textMode === "edit" && (
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Cole aqui o conteúdo do carousel separado por ---"
                className="w-full bg-card border border-border2 rounded-sm text-foreground font-mono text-[11px] py-2 px-3 outline-none transition-all duration-200 caret-primary resize-y min-h-[120px] leading-relaxed focus:border-primary focus:shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_0_16px_hsl(var(--primary)/0.06),inset_0_0_8px_hsl(var(--primary)/0.04)] focus:text-neon2 placeholder:text-muted-foreground"
              />
            )}

            {textMode === "preview" && slideBlocks.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                {slideBlocks.map((sl) => (
                  <div
                    key={sl.num}
                    className="bg-card border border-border2 rounded-sm overflow-hidden hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-background/60 border-b border-border2">
                      <span
                        className="font-mono text-[8px] tracking-[2px] text-primary border border-primary/30 px-1.5 py-0.5 rounded-sm shrink-0"
                        style={{ textShadow: "0 0 6px hsl(var(--primary))" }}
                      >
                        SL_{String(sl.num).padStart(2, "0")}
                      </span>
                      {sl.titulo && (
                        <span className="font-mono text-[9px] text-foreground font-semibold truncate">{sl.titulo}</span>
                      )}
                    </div>
                    <div className="px-2.5 py-2 flex flex-col gap-1.5">
                      {sl.subtitulo && <PreviewField label="SUB" value={sl.subtitulo} />}
                      {sl.cta && <PreviewField label="CTA" value={sl.cta} accent />}
                      {sl.visual && <PreviewField label="VIS" value={sl.visual} muted truncate />}
                      {sl.design && <PreviewField label="DSG" value={sl.design} muted truncate />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1.5 mt-2">
              <button
                onClick={handleCopy}
                disabled={!rawText.trim()}
                className="flex-1 bg-card border border-border2 rounded-sm text-muted-foreground font-mono text-[8px] tracking-[1px] py-1.5 transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-[0_0_6px_hsl(var(--neon-dim)/0.07)] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {copied ? "✓ COPIADO" : "⎘ COPIAR"}
              </button>
              <button
                onClick={handleClear}
                disabled={!rawText.trim()}
                className="flex-1 bg-card border border-border2 rounded-sm text-muted-foreground font-mono text-[8px] tracking-[1px] py-1.5 transition-all duration-200 hover:border-destructive hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ✕ APAGAR
              </button>
            </div>
            <div className="font-mono text-[8px] text-muted-foreground mt-1.5 leading-relaxed tracking-[0.5px]">
              Separe slides com{" "}
              <code className="bg-card-2 border border-border2 px-1 py-0.5 rounded-sm font-mono text-[9px] text-neon2">
                ---
              </code>
              . Campos: TÍTULO, SUBTÍTULO, CTA, VISUAL
            </div>
          </div>

          {/* ── Parameters ──────────────────────────────────── */}
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

          {/* ── Generate / Stop ─────────────────────────────── */}
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

      {/* ── Histórico ───────────────────────────────────────── */}
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

// ─── PREVIEW FIELD ────────────────────────────────────────────
function PreviewField({
  label,
  value,
  accent,
  muted,
  truncate,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex gap-1.5 items-start">
      <span
        className={`font-mono text-[7px] tracking-[1px] py-0.5 px-1 rounded-sm border shrink-0 mt-0.5 ${accent ? "bg-primary/10 text-primary border-primary/25" : "bg-card-2 text-muted-foreground border-border2"}`}
      >
        {label}
      </span>
      <span
        className={`font-mono text-[9px] leading-relaxed ${truncate ? "line-clamp-2" : ""} ${muted ? "text-muted-foreground" : accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── HISTORY CARD ─────────────────────────────────────────────
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
  return (
    <div className="border-b border-border2 p-3 flex gap-2.5 hover:bg-card/40 transition-colors">
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
            onClick={() => navigator.clipboard.writeText(entry.rawText)}
            className="font-mono text-[8px] tracking-[1px] bg-card border border-border2 rounded-sm px-2 py-0.5 text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            ⎘ COPIAR
          </button>
          <button
            onClick={async () => {
              setDeleting(true);
              await onDelete(entry.id);
            }}
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
