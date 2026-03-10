import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ProcessedSlide, StyleKey, LightKey, FormatKey, ResKey, LayoutPosition } from "./parser";
import { parseSlides } from "./parser";
import { buildPrompt, buildLayout, visualHasPerson, detectTitleStyle } from "./prompts";
import type { TitleStyle } from "./prompts";
import { analyzeLayout, composeSlide, visualHasTitleInImage } from "./compositor";
import type { AILayout } from "./compositor";
import { callGemini } from "./gemini";

// ─── TYPES ────────────────────────────────────────────────────
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
  slideStatuses: Record<number, "idle" | "processing" | "complete" | "error">;
  isGenerating: boolean;
  progress: { done: number; total: number };
  generationComplete: boolean;
  layoutRefDataUrl: string;
  layoutRefName: string;
  slideSteps: Record<number, string[]>;
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
  titleStyle: TitleStyle,
): Promise<{ blob: Blob; url: string }> {
  // 1. Gera imagem
  const imgSrc = await callGemini(sl, varIdx, faceB64);

  // 2. Analisa layout com Haiku (detecta focusZone → textZone + gradient)
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
        titleInImg ? "" : sl.titulo, // se título está na imagem, não passa pro Haiku
        sl.subtitulo ?? "",
        !!sl.cta,
        sl.fmt,
        titleStyle,
      );
    } catch {
      /* usa DEFAULT_LAYOUT */
    }
  }

  // 3. Compõe slide com layout IA
  const blob = await composeSlide(imgSrc, sl, faceB64, aiLayout, isFirstOrLast);
  const url = URL.createObjectURL(blob);
  return { blob, url };
}

// ─── PROVIDER ────────────────────────────────────────────────
export function CarouselProvider({ children }: { children: React.ReactNode }) {
  const [faceB64, setFaceB64State] = useState("");
  const [faceDataUrl, setFaceDataUrl] = useState("");
  const [faceName, setFaceName] = useState("");
  const [layoutRefDataUrl, setLayoutRefDataUrl] = useState(""); // ← ADD
  const [layoutRefName, setLayoutRefName] = useState(""); // ← ADD
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [generationComplete, setGenerationComplete] = useState(false);
  const [slideSteps, setSlideSteps] = useState<Record<number, string[]>>({});

  const faceB64Ref = useRef("");

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

  const setVarUrl = (si: number, vi: number, url: string) => setVarUrls((p) => ({ ...p, [`${si}_${vi}`]: url }));
  const setVarStatus = (si: number, vi: number, s: "idle" | "generating" | "done" | "error") =>
    setVarStatuses((p) => ({ ...p, [`${si}_${vi}`]: s }));
  const setSlideStatus = (i: number, s: "idle" | "processing" | "complete" | "error") =>
    setSlideStatuses((p) => ({ ...p, [i]: s }));

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
    setSlideStatuses({});
    setSlideSteps({}); // ← ADD
    setIsGenerating(true);
    setGenerationComplete(false);
    setProgress({ done: 0, total: totalSlides });

    const newBlobs: Record<number, (Blob | null)[]> = {};

    for (let i = 0; i < processedSlides.length; i++) {
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
              newBlobs[i][v] = blob;
              setVarUrl(i, v, url);
              setVarStatus(i, v, "done");
              setComposedBlobs((prev) => ({ ...prev, [i]: [...newBlobs[i]] }));
            })
            .catch(() => setVarStatus(i, v, "error")),
        );
        await Promise.all(varJobs);
        setSlideStatus(i, "complete");
      } catch {
        setSlideStatus(i, "error");
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
    layoutRefDataUrl,
    layoutRefName, // ← ADD
    slideSteps, // ← ADD
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
    isGenerating,
    progress,
    generationComplete,
    setFace,
    setLayoutRef, // ← ADD setLayoutRef
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
