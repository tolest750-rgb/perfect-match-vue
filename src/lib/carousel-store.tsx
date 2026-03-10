import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ProcessedSlide, StyleKey, LightKey, FormatKey, ResKey } from "./parser";
import { parseSlides } from "./parser";
import { buildPrompt, buildLayout, visualHasPerson } from "./prompts";
import { analyzeLayout, composeSlide } from "./compositor";
import type { AILayout } from "./compositor";
import { callGemini } from "./gemini";

// ─── TYPES ────────────────────────────────────────────────────
interface CarouselState {
  faceB64: string;
  faceDataUrl: string;
  faceName: string;
  layoutRefB64: string;
  layoutRefDataUrl: string;
  layoutRefName: string;
  style: StyleKey;
  light: LightKey;
  fmt: FormatKey;
  res: ResKey;
  rawText: string;
  slides: ProcessedSlide[];
  composedBlobs: Record<number, (Blob | null)[]>;
  varUrls: Record<string, string>;
  varStatuses: Record<string, "idle" | "generating" | "done" | "error">;
  slideStatuses: Record<number, "idle" | "processing" | "complete" | "error">;
  slideSteps: Record<string, "" | "active" | "done" | "error">;
  isGenerating: boolean;
  progress: { done: number; total: number };
  generationComplete: boolean;
}

interface CarouselActions {
  setFace: (file: File) => void;
  setLayoutRef: (file: File) => void;
  setStyle: (s: StyleKey) => void;
  setLight: (l: LightKey) => void;
  setFmt: (f: FormatKey) => void;
  setRes: (r: ResKey) => void;
  setRawText: (t: string) => void;
  startGeneration: () => Promise<void>;
  regenVar: (slideIdx: number, varIdx: number) => Promise<void>;
  getVarBlob: (slideIdx: number, varIdx: number) => Blob | null;
}

const CarouselContext = createContext<(CarouselState & CarouselActions) | null>(null);

export function useCarousel() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within CarouselProvider");
  return ctx;
}

// ─── PERSON DETECTION (named person heuristic) ────────────────
const visualMentionsNamedPerson = (visual: string): boolean => {
  const properNamePattern = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+\b/g;
  const matches = visual.match(properNamePattern) || [];
  const commonPhrases = [
    "call to action",
    "no slide",
    "na cena",
    "do slide",
    "em pé",
    "de frente",
    "ao fundo",
    "na mesa",
    "com fundo",
    "olhando para",
  ];
  return matches.some((m) => !commonPhrases.some((cp) => m.toLowerCase().includes(cp)));
};

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
): Promise<{ blob: Blob; url: string }> {
  // 1. Gera imagem
  const imgSrc = await callGemini(sl, varIdx, faceB64);

  // 2. Analisa layout com Haiku (se imagem gerada)
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
      aiLayout = await analyzeLayout(snap, sl.titulo, sl.subtitulo ?? "", !!sl.cta, sl.fmt);
    } catch {
      /* usa DEFAULT_LAYOUT */
    }
  }

  // 3. Compõe slide com posição IA + flag de logo
  const blob = await composeSlide(imgSrc, sl, faceB64, aiLayout, isFirstOrLast);
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

// ─── PROVIDER ────────────────────────────────────────────────
export function CarouselProvider({ children }: { children: React.ReactNode }) {
  const [faceB64, setFaceB64] = useState("");
  const [faceDataUrl, setFaceDataUrl] = useState("");
  const [faceName, setFaceName] = useState("");
  const [layoutRefB64, setLayoutRefB64State] = useState("");
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
  const [slideSteps, setSlideSteps] = useState<Record<string, "" | "active" | "done" | "error">>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [generationComplete, setGenerationComplete] = useState(false);

  const faceB64Ref = useRef(faceB64);
  faceB64Ref.current = faceB64;

  const setFace = useCallback((file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const b64 = dataUrl.split(",")[1];
      setFaceB64(b64);
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
      const b64 = dataUrl.split(",")[1];
      setLayoutRefB64State(b64);
      setLayoutRefDataUrl(dataUrl);
      setLayoutRefName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  const setVarUrl = (si: number, vi: number, url: string) => setVarUrls((p) => ({ ...p, [`${si}_${vi}`]: url }));
  const setVarStatus = (si: number, vi: number, s: "idle" | "generating" | "done" | "error") =>
    setVarStatuses((p) => ({ ...p, [`${si}_${vi}`]: s }));
  const setSlideStatus = (i: number, s: "idle" | "processing" | "complete" | "error") =>
    setSlideStatuses((p) => ({ ...p, [i]: s }));
  const setSlideStep = (i: number, step: number, s: "" | "active" | "done" | "error") =>
    setSlideSteps((p) => ({ ...p, [`${i}_${step}`]: s }));

  const startGeneration = useCallback(async () => {
    if (!rawText.trim()) return;
    const parsed = parseSlides(rawText);
    if (!parsed.length) return;

    const hasFaceRef = !!faceB64Ref.current;
    const totalSlides = parsed.length;

    const processedSlides: ProcessedSlide[] = parsed.map((s, i) => {
      const isFirstSlide = i === 0;
      const useFaceRef =
        hasFaceRef && visualHasPerson(s.visual ?? "") && (isFirstSlide || !visualMentionsNamedPerson(s.visual ?? ""));
      return {
        ...s,
        prompt: buildPrompt(s, style, light, fmt, { useFaceRef }),
        layout: buildLayout(light),
        useFaceRef,
        fmt,
        style,
        light,
        res,
      };
    });

    setSlides(processedSlides);
    setComposedBlobs({});
    setVarUrls({});
    setVarStatuses({});
    setSlideStatuses({});
    setSlideSteps({});
    setIsGenerating(true);
    setGenerationComplete(false);
    setProgress({ done: 0, total: totalSlides });

    const newBlobs: Record<number, (Blob | null)[]> = {};

    for (let i = 0; i < processedSlides.length; i++) {
      setProgress({ done: i, total: totalSlides });
      setSlideStatus(i, "processing");
      setSlideStep(i, 1, "active");
      newBlobs[i] = new Array(4).fill(null);
      [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "generating"));

      // 1º slide (i===0) e último (i===totalSlides-1) recebem logo
      const isFirstOrLast = i === 0 || i === totalSlides - 1;

      try {
        const varJobs = [0, 1, 2, 3].map((v) =>
          generateAndCompose(processedSlides[i], v, faceB64Ref.current, isFirstOrLast)
            .then(({ blob, url }) => {
              newBlobs[i][v] = blob;
              setVarUrl(i, v, url);
              setVarStatus(i, v, "done");
              setComposedBlobs((prev) => ({ ...prev, [i]: [...newBlobs[i]] }));
            })
            .catch(() => setVarStatus(i, v, "error")),
        );
        await Promise.all(varJobs);
        setSlideStep(i, 1, "done");
        setSlideStep(i, 2, "done");
        setSlideStep(i, 3, "done");
        setSlideStatus(i, "complete");
      } catch {
        setSlideStatus(i, "error");
        setSlideStep(i, 1, "error");
        [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "error"));
      }
    }

    setProgress({ done: totalSlides, total: totalSlides });
    setIsGenerating(false);
    setGenerationComplete(true);
  }, [rawText, style, light, fmt, res]);

  const regenVar = useCallback(
    async (slideIdx: number, varIdx: number) => {
      const sl = slides[slideIdx];
      if (!sl) return;
      // Determina se este slide é primeiro ou último
      const isFirstOrLast = slideIdx === 0 || slideIdx === slides.length - 1;
      setVarStatus(slideIdx, varIdx, "generating");
      try {
        const { blob, url } = await generateAndCompose(sl, varIdx, faceB64Ref.current, isFirstOrLast);
        setVarUrl(slideIdx, varIdx, url);
        setVarStatus(slideIdx, varIdx, "done");
        setComposedBlobs((prev) => {
          const arr = [...(prev[slideIdx] || new Array(4).fill(null))];
          arr[varIdx] = blob;
          return { ...prev, [slideIdx]: arr };
        });
      } catch {
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
    layoutRefB64,
    layoutRefDataUrl,
    layoutRefName,
    style,
    light,
    fmt,
    res,
    rawText,
    slides,
    composedBlobs,
    varUrls,
    varStatuses,
    slideStatuses,
    slideSteps,
    isGenerating,
    progress,
    generationComplete,
    setFace,
    setLayoutRef,
    setStyle,
    setLight,
    setFmt,
    setRes,
    setRawText,
    startGeneration,
    regenVar,
    getVarBlob,
  };

  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>;
}
