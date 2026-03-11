import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ProcessedSlide, StyleKey, LightKey, FormatKey, ResKey, LayoutPosition } from "./parser";
import { parseSlides } from "./parser";
import { buildPrompt, buildLayout, visualHasPerson, visualMentionsNamedPerson, detectTitleStyle } from "./prompts";
import type { TitleStyle } from "./prompts";
import { analyzeLayout, composeSlide, visualHasTitleInImage } from "./compositor";
import type { AILayout } from "./compositor";
import { callGemini } from "./gemini";

// ─── TYPES ────────────────────────────────────────────────────
export interface HistoryEntry {
  id: string;
  createdAt: string;
  rawText: string;
  style: StyleKey;
  light: LightKey;
  fmt: FormatKey;
  slideCount: number;
  thumbUrl?: string;
}

export interface FacePreset {
  id: string;
  name: string;
  dataUrl: string;
  b64: string;
}

export interface LayoutPreset {
  id: string;
  name: string;
  dataUrl: string;
}

interface CarouselState {
  faceB64: string;
  faceDataUrl: string;
  faceName: string;
  style: StyleKey;
  light: LightKey;
  fmt: FormatKey;
  res: ResKey;
  rawText: string;
  slides: ProcessedSlide[];
  composedBlobs: Record<number, (Blob | null)[]>;
  varUrls: Record<string, string>;
  varStatuses: Record<string, "idle" | "generating" | "done" | "error">;
  varErrors: Record<string, string>;
  slideStatuses: Record<number, "idle" | "processing" | "complete" | "error">;
  isGenerating: boolean;
  isStopping: boolean;
  progress: { done: number; total: number };
  generationComplete: boolean;
  layoutRefDataUrl: string;
  layoutRefName: string;
  slideSteps: Record<number, string[]>;
  history: HistoryEntry[];
  facePresets: FacePreset[];
  layoutPresets: LayoutPreset[];
}

interface CarouselActions {
  setFace: (file: File) => void;
  setStyle: (s: StyleKey) => void;
  setLight: (l: LightKey) => void;
  setFmt: (f: FormatKey) => void;
  setRes: (r: ResKey) => void;
  setRawText: (t: string) => void;
  setLayoutRef: (file: File) => void;
  startGeneration: () => Promise<void>;
  stopGeneration: () => void;
  regenVar: (slideIdx: number, varIdx: number) => Promise<void>;
  getVarBlob: (slideIdx: number, varIdx: number) => Blob | null;
  deleteHistory: (id: string) => Promise<void>;
  loadHistory: (entry: HistoryEntry) => void;
  saveFacePreset: (name: string) => void;
  deleteFacePreset: (id: string) => void;
  saveLayoutPreset: (name: string) => void;
  deleteLayoutPreset: (id: string) => void;
  applyFacePreset: (preset: FacePreset) => void;
  applyLayoutPreset: (preset: LayoutPreset) => void;
}

const CarouselContext = createContext<(CarouselState & CarouselActions) | null>(null);

export function useCarousel() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within CarouselProvider");
  return ctx;
}

// ─── HELPER: reduz imagem para base64 pequena p/ análise ──────
async function shrinkToBase64(imgSrc: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}

// ─── PIPELINE: gerar → analisar → compor ─────────────────────
async function generateAndCompose(
  sl: ProcessedSlide,
  varIdx: number,
  faceB64: string,
  isFirstOrLast: boolean,
  titleStyle: TitleStyle,
): Promise<{ blob: Blob; url: string }> {
  const imgSrc = await callGemini(sl, varIdx, faceB64);

  let aiLayout: AILayout | undefined;
  if (imgSrc) {
    try {
      const snapDims: Record<string, [number, number]> = {
        "4:5": [540, 675],
        "9:16": [405, 720],
        "1:1": [540, 540],
      };
      const [sw, sh] = snapDims[sl.fmt] ?? [540, 675];
      const snap = await shrinkToBase64(imgSrc, sw, sh);
      const titleInImg = visualHasTitleInImage(sl.visual ?? "");
      aiLayout = await analyzeLayout(
        snap,
        titleInImg ? "" : sl.titulo,
        sl.subtitulo ?? "",
        !!sl.cta,
        sl.fmt,
        titleStyle,
      );
    } catch {
      /* usa DEFAULT_LAYOUT */
    }
  }

  const blob = await composeSlide(imgSrc, sl, faceB64, aiLayout, isFirstOrLast);
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

// ─── PROVIDER ────────────────────────────────────────────────
export function CarouselProvider({ children }: { children: React.ReactNode }) {
  const [faceB64, setFaceB64State] = useState("");
  const [faceDataUrl, setFaceDataUrl] = useState("");
  const [faceName, setFaceName] = useState("");
  const [layoutRefDataUrl, setLayoutRefDataUrl] = useState("");
  const [layoutRefName, setLayoutRefName] = useState("");
  const [style, setStyle] = useState<StyleKey>("cinematic");
  const [light, setLight] = useState<LightKey>("dramatic");
  const [fmt, setFmt] = useState<FormatKey>("4:5");
  const [res, setRes] = useState<ResKey>("2K");
  const [rawText, setRawText] = useState("");
  const [slides, setSlides] = useState<ProcessedSlide[]>([]);
  const [composedBlobs, setComposedBlobs] = useState<Record<number, (Blob | null)[]>>({});
  const [varUrls, setVarUrls] = useState<Record<string, string>>({});
  const [varStatuses, setVarStatuses] = useState<Record<string, "idle" | "generating" | "done" | "error">>({});
  const [slideStatuses, setSlideStatuses] = useState<Record<number, "idle" | "processing" | "complete" | "error">>({});
  const [varErrors, setVarErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [generationComplete, setGenerationComplete] = useState(false);
  const [slideSteps, setSlideSteps] = useState<Record<number, string[]>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [facePresets, setFacePresets] = useState<FacePreset[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("facePresets") || "[]");
    } catch {
      return [];
    }
  });
  const [layoutPresets, setLayoutPresets] = useState<LayoutPreset[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("layoutPresets") || "[]");
    } catch {
      return [];
    }
  });

  const faceB64Ref = useRef("");
  const stopRef = useRef(false);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setHistory(data))
      .catch(() => {});
  }, []);

  const setFace = useCallback((file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const b64 = dataUrl.split(",")[1];
      setFaceB64State(b64);
      faceB64Ref.current = b64;
      setFaceDataUrl(dataUrl);
      setFaceName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  const setLayoutRef = useCallback((file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLayoutRefDataUrl(dataUrl);
      setLayoutRefName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  // ── Presets ────────────────────────────────────────────────
  const saveFacePreset = useCallback(
    (name: string) => {
      if (!faceDataUrl || !faceB64Ref.current) return;
      const preset: FacePreset = { id: Date.now().toString(), name, dataUrl: faceDataUrl, b64: faceB64Ref.current };
      setFacePresets((prev) => {
        const next = [...prev, preset];
        localStorage.setItem("facePresets", JSON.stringify(next));
        return next;
      });
    },
    [faceDataUrl],
  );

  const deleteFacePreset = useCallback((id: string) => {
    setFacePresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localStorage.setItem("facePresets", JSON.stringify(next));
      return next;
    });
  }, []);

  const applyFacePreset = useCallback((preset: FacePreset) => {
    setFaceB64State(preset.b64);
    faceB64Ref.current = preset.b64;
    setFaceDataUrl(preset.dataUrl);
    setFaceName(preset.name);
  }, []);

  const saveLayoutPreset = useCallback(
    (name: string) => {
      if (!layoutRefDataUrl) return;
      const preset: LayoutPreset = { id: Date.now().toString(), name, dataUrl: layoutRefDataUrl };
      setLayoutPresets((prev) => {
        const next = [...prev, preset];
        localStorage.setItem("layoutPresets", JSON.stringify(next));
        return next;
      });
    },
    [layoutRefDataUrl],
  );

  const deleteLayoutPreset = useCallback((id: string) => {
    setLayoutPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      localStorage.setItem("layoutPresets", JSON.stringify(next));
      return next;
    });
  }, []);

  const applyLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutRefDataUrl(preset.dataUrl);
    setLayoutRefName(preset.name);
  }, []);

  // ── Histórico ──────────────────────────────────────────────
  const saveToHistory = useCallback(async (entry: Omit<HistoryEntry, "id" | "createdAt">) => {
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (res.ok) {
        const saved = await res.json();
        setHistory((prev) => [saved, ...prev]);
      }
    } catch {}
  }, []);

  const deleteHistory = useCallback(async (id: string) => {
    try {
      await fetch(`/api/history/${id}`, { method: "DELETE" });
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch {}
  }, []);

  const loadHistory = useCallback((entry: HistoryEntry) => {
    setRawText(entry.rawText);
    setStyle(entry.style);
    setLight(entry.light);
    setFmt(entry.fmt);
  }, []);

  // ── STOP ───────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    stopRef.current = true;
    setIsStopping(true);
  }, []);

  const setVarUrl = (si: number, vi: number, url: string) => setVarUrls((p) => ({ ...p, [`${si}_${vi}`]: url }));
  const setVarStatus = (si: number, vi: number, s: "idle" | "generating" | "done" | "error") =>
    setVarStatuses((p) => ({ ...p, [`${si}_${vi}`]: s }));
  const setSlideStatus = (i: number, s: "idle" | "processing" | "complete" | "error") =>
    setSlideStatuses((p) => ({ ...p, [i]: s }));

  const startGeneration = useCallback(async () => {
    if (!rawText.trim()) return;
    const parsed = parseSlides(rawText);
    if (!parsed.length) return;

    stopRef.current = false;
    const hasFaceRef = !!faceB64Ref.current;
    const totalSlides = parsed.length;

    const processedSlides: ProcessedSlide[] = parsed.map((s) => {
      // Face ref: only when there's a generic person AND no proper name detected
      const hasPerson = visualHasPerson(s.visual ?? "");
      const hasNamedPerson = visualMentionsNamedPerson(s.visual ?? "");
      const useFaceRef = hasFaceRef && hasPerson && !hasNamedPerson;

      const layoutPos: LayoutPosition = "bottom-left";
      return {
        ...s,
        prompt: buildPrompt(s, style, light, fmt, { useFaceRef }),
        layout: {
          ...buildLayout(light),
          layoutPos,
          slideNum: s.num,
          titulo: s.titulo,
          subtitulo: s.subtitulo ?? "",
          cta: s.cta ?? "",
        },
        layoutPosition: layoutPos,
        useFaceRef,
        fmt,
        style,
        light,
        res,
        titleStyle: detectTitleStyle(s.visual ?? "", s.design),
      };
    });

    setSlides(processedSlides);
    setComposedBlobs({});
    setVarUrls({});
    setVarStatuses({});
    setVarErrors({});
    setSlideStatuses({});
    setSlideSteps({});
    setIsGenerating(true);
    setIsStopping(false);
    setGenerationComplete(false);
    setProgress({ done: 0, total: totalSlides });

    const newBlobs: Record<number, (Blob | null)[]> = {};
    let firstThumbUrl: string | undefined;

    for (let i = 0; i < processedSlides.length; i++) {
      if (stopRef.current) {
        setSlideStatus(i, "idle");
        break;
      }

      setProgress({ done: i, total: totalSlides });
      setSlideStatus(i, "processing");
      newBlobs[i] = new Array(4).fill(null);
      [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "generating"));

      const isFirstOrLast = i === 0 || i === totalSlides - 1;
      const titleStyle = (processedSlides[i] as any).titleStyle ?? "default";

      try {
        const varJobs = [0, 1, 2, 3].map((v) =>
          generateAndCompose(processedSlides[i], v, faceB64Ref.current, isFirstOrLast, titleStyle)
            .then(({ blob, url }) => {
              if (stopRef.current) return;
              newBlobs[i][v] = blob;
              setVarUrl(i, v, url);
              setVarStatus(i, v, "done");
              if (!firstThumbUrl && i === 0 && v === 0) firstThumbUrl = url;
              setComposedBlobs((prev) => ({ ...prev, [i]: [...newBlobs[i]] }));
            })
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`[slide ${i} var ${v}]`, msg);
              setVarErrors((p) => ({ ...p, [`${i}_${v}`]: msg }));
              setVarStatus(i, v, "error");
            }),
        );
        await Promise.all(varJobs);
        if (!stopRef.current) setSlideStatus(i, "complete");
      } catch {
        setSlideStatus(i, "error");
        [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "error"));
      }
    }

    setProgress({ done: totalSlides, total: totalSlides });
    setIsGenerating(false);
    setIsStopping(false);

    if (!stopRef.current) {
      setGenerationComplete(true);
      await saveToHistory({
        rawText,
        style,
        light,
        fmt,
        slideCount: totalSlides,
        thumbUrl: firstThumbUrl,
      });
    }
  }, [rawText, style, light, fmt, res, saveToHistory]);

  const regenVar = useCallback(
    async (slideIdx: number, varIdx: number) => {
      const sl = slides[slideIdx];
      if (!sl) return;
      const isFirstOrLast = slideIdx === 0 || slideIdx === slides.length - 1;
      const titleStyle = (sl as any).titleStyle ?? "default";
      setVarStatus(slideIdx, varIdx, "generating");
      try {
        const { blob, url } = await generateAndCompose(sl, varIdx, faceB64Ref.current, isFirstOrLast, titleStyle);
        setVarUrl(slideIdx, varIdx, url);
        setVarStatus(slideIdx, varIdx, "done");
        setComposedBlobs((prev) => {
          const arr = [...(prev[slideIdx] || new Array(4).fill(null))];
          arr[varIdx] = blob;
          return { ...prev, [slideIdx]: arr };
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[regen slide ${slideIdx} var ${varIdx}]`, msg);
        setVarErrors((p) => ({ ...p, [`${slideIdx}_${varIdx}`]: msg }));
        setVarStatus(slideIdx, varIdx, "error");
      }
    },
    [slides],
  );

  const getVarBlob = useCallback((si: number, vi: number) => composedBlobs[si]?.[vi] || null, [composedBlobs]);

  const value: CarouselState & CarouselActions = {
    faceB64,
    faceDataUrl,
    faceName,
    layoutRefDataUrl,
    layoutRefName,
    slideSteps,
    style,
    light,
    fmt,
    res,
    rawText,
    slides,
    composedBlobs,
    varUrls,
    varStatuses,
    varErrors,
    slideStatuses,
    isGenerating,
    isStopping,
    progress,
    generationComplete,
    history,
    facePresets,
    layoutPresets,
    setFace,
    setLayoutRef,
    setStyle,
    setLight,
    setFmt,
    setRes,
    setRawText,
    startGeneration,
    stopGeneration,
    regenVar,
    getVarBlob,
    deleteHistory,
    loadHistory,
    saveFacePreset,
    deleteFacePreset,
    applyFacePreset,
    saveLayoutPreset,
    deleteLayoutPreset,
    applyLayoutPreset,
  };

  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>;
}
