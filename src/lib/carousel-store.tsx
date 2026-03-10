import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ProcessedSlide, StyleKey, LightKey, FormatKey, ResKey } from "./parser";
import { parseSlides } from "./parser";
import { buildPrompt, buildLayout, detectLayoutPosition } from "./prompts";
import { callGemini } from "./gemini";
import { composeSlide } from "./compositor";

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

const PERSON_KEYWORDS = [
  "pessoa", "homem", "mulher", "menino", "menina", "criança",
  "executivo", "empresário", "líder", "atleta", "médico", "profissional",
  "founder", "person", "man", "woman", "boy", "girl", "child", "human",
  "ceo", "speaker",
];

const visualMentionsPerson = (visual: string) =>
  PERSON_KEYWORDS.some((kw) => visual.toLowerCase().includes(kw));

/**
 * Detects if the VISUAL field mentions a specific named person/character
 * (proper nouns like "Elon Musk", "Steve Jobs", "Batman").
 * When a proper name is found, the face reference should NOT be used —
 * the AI model will generate the named person's likeness directly.
 */
const visualMentionsNamedPerson = (visual: string): boolean => {
  // Match capitalized words that look like proper names (2+ consecutive capitalized words)
  const properNamePattern = /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+\b/g;
  const matches = visual.match(properNamePattern) || [];
  
  // Filter out common Portuguese phrases that start with capitals (beginning of sentences)
  const commonPhrases = [
    'call to action', 'no slide', 'na cena', 'do slide', 'em pé', 'de frente',
    'ao fundo', 'na mesa', 'com fundo', 'olhando para',
  ];
  
  return matches.some(m => {
    const lower = m.toLowerCase();
    return !commonPhrases.some(cp => lower.includes(cp));
  });
};

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
  const layoutRefB64Ref = useRef(layoutRefB64);
  layoutRefB64Ref.current = layoutRefB64;

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
      layoutRefB64Ref.current = b64;
      setLayoutRefDataUrl(dataUrl);
      setLayoutRefName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  const setVarUrl = (slideIdx: number, varIdx: number, url: string) => {
    setVarUrls((prev) => ({ ...prev, [`${slideIdx}_${varIdx}`]: url }));
  };
  const setVarStatus = (slideIdx: number, varIdx: number, status: "idle" | "generating" | "done" | "error") => {
    setVarStatuses((prev) => ({ ...prev, [`${slideIdx}_${varIdx}`]: status }));
  };
  const setSlideStatus = (idx: number, status: "idle" | "processing" | "complete" | "error") => {
    setSlideStatuses((prev) => ({ ...prev, [idx]: status }));
  };
  const setSlideStep = (idx: number, step: number, status: "" | "active" | "done" | "error") => {
    setSlideSteps((prev) => ({ ...prev, [`${idx}_${step}`]: status }));
  };

  const startGeneration = useCallback(async () => {
    if (!rawText.trim()) return;
    const parsed = parseSlides(rawText);
    if (!parsed.length) return;

    const hasFaceRef = !!faceB64Ref.current;

    const processedSlides: ProcessedSlide[] = parsed.map((s, i) => {
      const layoutPos = detectLayoutPosition(s, i, parsed.length);
      const useFaceRef = hasFaceRef && visualMentionsPerson(s.visual ?? "") && !visualMentionsNamedPerson(s.visual ?? "");
      return {
        ...s,
        prompt: buildPrompt(s, style, light, fmt, layoutPos, { useFaceRef }),
        layout: buildLayout(s, light, fmt, layoutPos),
        layoutPosition: layoutPos,
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
    setProgress({ done: 0, total: processedSlides.length });

    const newBlobs: Record<number, (Blob | null)[]> = {};

    for (let i = 0; i < processedSlides.length; i++) {
      setProgress({ done: i, total: processedSlides.length });
      setSlideStatus(i, "processing");
      setSlideStep(i, 1, "active");
      newBlobs[i] = new Array(4).fill(null);
      [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "generating"));

      try {
        const imgJobs = [0, 1, 2, 3].map((v) => callGemini(processedSlides[i], v, faceB64Ref.current, layoutRefB64Ref.current));
        const results = await Promise.allSettled(imgJobs);
        setSlideStep(i, 1, "done");
        setSlideStep(i, 2, "active");

        const compJobs = results.map((res, v) => {
          const src = res.status === "fulfilled" ? res.value : null;
          return composeSlide(src, processedSlides[i], faceB64Ref.current)
            .then((blob) => {
              newBlobs[i][v] = blob;
              const url = URL.createObjectURL(blob);
              setVarUrl(i, v, url);
              setVarStatus(i, v, "done");
              setComposedBlobs((prev) => ({ ...prev, [i]: [...newBlobs[i]] }));
            })
            .catch(() => { setVarStatus(i, v, "error"); });
        });

        await Promise.all(compJobs);
        setSlideStep(i, 2, "done");
        setSlideStep(i, 3, "done");
        setSlideStatus(i, "complete");
      } catch {
        setSlideStatus(i, "error");
        setSlideStep(i, 1, "error");
        [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "error"));
      }
    }

    setProgress({ done: processedSlides.length, total: processedSlides.length });
    setIsGenerating(false);
    setGenerationComplete(true);
  }, [rawText, style, light, fmt, res]);

  const regenVar = useCallback(
    async (slideIdx: number, varIdx: number) => {
      const sl = slides[slideIdx];
      if (!sl) return;
      setVarStatus(slideIdx, varIdx, "generating");
      try {
        const src = await callGemini(sl, varIdx, faceB64Ref.current, layoutRefB64Ref.current);
        const blob = await composeSlide(src, sl, faceB64Ref.current);
        const url = URL.createObjectURL(blob);
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

  const getVarBlob = useCallback(
    (slideIdx: number, varIdx: number) => composedBlobs[slideIdx]?.[varIdx] || null,
    [composedBlobs],
  );

  const value: CarouselState & CarouselActions = {
    faceB64, faceDataUrl, faceName,
    style, light, fmt, res, rawText,
    slides, composedBlobs, varUrls, varStatuses,
    slideStatuses, slideSteps, isGenerating, progress, generationComplete,
    setFace, setStyle, setLight, setFmt, setRes, setRawText,
    startGeneration, regenVar, getVarBlob,
  };

  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>;
}
