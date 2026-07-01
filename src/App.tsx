/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Headphones, 
  Sparkles, 
  Download, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Play, 
  Pause,
  SkipForward,
  SkipBack,
  FileText, 
  Lock,
  Unlock,
  Volume2,
  Info,
  Clock,
  VolumeX,
  FileDown,
  CheckCircle2,
  ListMusic,
  DownloadCloud,
  ChevronRight,
  Bookmark,
  Eye,
  EyeOff
} from "lucide-react";
import JSZip from "jszip";

// Quick templates to help user test the application easily
const TEXT_TEMPLATES = [
  {
    id: "productivity",
    label: "Flow State Guide",
    description: "Tips on entering deep focus",
    text: `The Flow State is a mental state where you are fully immersed in an activity. It leads to higher focus, faster learning, and deep satisfaction. 

To enter flow:
First, eliminate all distractions. Silence your phone, close unnecessary browser tabs, and commit to a single task.
Second, choose a task that is challenging but matches your skill level. 
Third, set a clear goal. When you know exactly what you are trying to achieve, your brain doesn't waste energy choosing what to do next.
Finally, give yourself at least ninety minutes of uninterrupted time. The first fifteen minutes are just a warm-up; deep focus happens in the remaining hour.`
  },
  {
    id: "mindfulness",
    label: "Mindfulness Breathing",
    description: "Calming voice meditation",
    text: `Take a deep breath in through your nose, letting your chest and belly expand. Hold it for a moment, and then slowly exhale through your mouth. 

Allow your shoulders to drop and release any tension in your jaw. Mindfulness is not about clearing your mind of thoughts; it is about observing them without judgment. 

When you listen to this voice, try to focus on the cadence, the rise and fall of the tone, and let it ground you in the present moment. Whenever your mind wanders, gently bring your attention back to the sound of the breathing voice.`
  },
  {
    id: "essay",
    label: "The Value of Silence",
    description: "Short cognitive essay",
    text: `In the era of constant connectivity, silence has become a rare luxury. We fill every micro-moment of our day with podcasts, music, feeds, or notifications. 

Yet, cognitive science shows that the brain requires idle time to process information, solidify memories, and spark creative ideas. True rest is not passive consumption; it is the absence of input. 

Try spending just ten minutes today sitting in absolute silence, observing the world around you. You might find that the quietest moments are when your mind speaks with the greatest clarity.`
  }
];

const VOICES = [
  { id: "Calm narrator", name: "Calm Narrator", desc: "Soothing & Peaceful (Kore)", details: "Best for literature, essays, and relaxing logs" },
  { id: "Professional reader", name: "Professional Reader", desc: "Clear & Articulate (Fenrir)", details: "Best for news, docs, and formal technical articles" },
  { id: "Friendly voice", name: "Friendly Voice", desc: "Warm & Conversational (Zephyr)", details: "Best for blog posts, newsletters, and emails" },
  { id: "Slow clear reading", name: "Slow Clear Reading", desc: "Deliberate & Clear (Puck)", details: "Best for deep studies or complex tutorials" },
  { id: "Energetic reading", name: "Energetic Reading", desc: "Lively & Engaging (Charon)", details: "Best for stories, highlights, and dynamic text" }
];

const STYLES = [
  { id: "Normal", name: "Normal Speed", desc: "Default tone and natural pacing" },
  { id: "Slow", name: "Slow Tempo", desc: "Relaxed pacing with generous pauses" },
  { id: "Very clear", name: "Ultra Distinct", desc: "Pristine pronunciation and enunciation" },
  { id: "Podcast style", name: "Podcast Cadence", desc: "Engaging, casual solo storytelling feel" }
];

const LOADING_MESSAGES = [
  "Analyzing text structure...",
  "Configuring vocal tone and resonance...",
  "Synthesizing natural voice patterns...",
  "Optimizing audio clarity and pace...",
  "Assembling pristine WAV audio file...",
  "Still working: reading paragraphs smoothly...",
  "Finalizing vocal output delivery..."
];

interface AudioPart {
  partIndex: number; // 0-based index
  text: string;
  audioUrl: string | null;
  blob: Blob | null;
  status: "idle" | "generating" | "completed" | "failed";
  error?: string;
}

// Automatically split long text into parts of around 4,000 characters each cleanly
const splitTextIntoParts = (fullText: string, partSize: number = 4000): string[] => {
  if (!fullText || !fullText.trim()) return [];
  
  const paragraphs = fullText.split(/\n+/);
  const parts: string[] = [];
  let currentPart = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Check if adding this paragraph fits in the partSize
    if ((currentPart + "\n\n" + trimmedPara).length <= partSize) {
      currentPart = currentPart ? currentPart + "\n\n" + trimmedPara : trimmedPara;
    } else {
      // It exceeds! If we have something in currentPart, save it
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }

      // Now process the paragraph itself
      if (trimmedPara.length > partSize) {
        // Paragraph is too long, split by sentence
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)/g) || [trimmedPara];
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;

          if ((currentPart + " " + trimmedSentence).length <= partSize) {
            currentPart = currentPart ? currentPart + " " + trimmedSentence : trimmedSentence;
          } else {
            if (currentPart) {
              parts.push(currentPart);
            }
            // Fallback for extremely long single sentences
            if (trimmedSentence.length > partSize) {
              let temp = trimmedSentence;
              while (temp.length > partSize) {
                parts.push(temp.substring(0, partSize));
                temp = temp.substring(partSize);
              }
              currentPart = temp;
            } else {
              currentPart = trimmedSentence;
            }
          }
        }
      } else {
        currentPart = trimmedPara;
      }
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts;
};

// Split free text into safe chunks of 800-1200 characters for SpeechSynthesis
const splitFreeTextIntoChunks = (fullText: string, maxChars = 1000): string[] => {
  if (!fullText || !fullText.trim()) return [];
  const paragraphs = fullText.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if ((currentChunk + "\n\n" + trimmedPara).length <= maxChars) {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmedPara : trimmedPara;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (trimmedPara.length > maxChars) {
        // split by sentence
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)/g) || [trimmedPara];
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;

          if ((currentChunk + " " + trimmedSentence).length <= maxChars) {
            currentChunk = currentChunk ? currentChunk + " " + trimmedSentence : trimmedSentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            if (trimmedSentence.length > maxChars) {
              let temp = trimmedSentence;
              while (temp.length > maxChars) {
                chunks.push(temp.substring(0, maxChars));
                temp = temp.substring(maxChars);
              }
              currentChunk = temp;
            } else {
              currentChunk = trimmedSentence;
            }
          }
        }
      } else {
        currentChunk = trimmedPara;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

// Client-side helper functions for High Quality AI Voice mode
const base64ToUint8Array = (base64String: string): Uint8Array => {
  const binaryString = window.atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const concatUint8Arrays = (arrays: Uint8Array[]): Uint8Array => {
  let totalLength = 0;
  for (const arr of arrays) {
    totalLength += arr.length;
  }
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
};

function addWavHeader(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const dataLength = pcmData.length;
  const fileLength = dataLength + 36;

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, fileLength, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  view.setUint32(28, byteRate, true);

  const blockAlign = numChannels * (bitsPerSample / 8);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  const combined = new Uint8Array(44 + pcmData.length);
  combined.set(new Uint8Array(header), 0);
  combined.set(pcmData, 44);

  return combined;
}

function splitTextIntoChunks(text: string, maxChunkSize: number = 800): string[] {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if ((currentChunk + "\n" + trimmedPara).length <= maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + "\n" + trimmedPara : trimmedPara;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      if (trimmedPara.length > maxChunkSize) {
        const sentences = trimmedPara.match(/[^.!?]+[.!?]+(\s|$)/g) || [trimmedPara];
        for (const sentence of sentences) {
          const trimmedSentence = sentence.trim();
          if (!trimmedSentence) continue;

          if ((currentChunk + " " + trimmedSentence).length <= maxChunkSize) {
            currentChunk = currentChunk ? currentChunk + " " + trimmedSentence : trimmedSentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = trimmedSentence;
          }
        }
      } else {
        currentChunk = trimmedPara;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"free" | "ai">("free");

  // Common error state
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------
  // TAB 1: FREE SIMPLE VOICE STATE
  // --------------------------------------------------
  const [freeText, setFreeText] = useState(TEXT_TEMPLATES[0].text);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [freeVoice, setFreeVoice] = useState<string>("");
  const [freeSpeed, setFreeSpeed] = useState<number>(1);
  const [isPlayingFree, setIsPlayingFree] = useState(false);
  const [isPausedFree, setIsPausedFree] = useState(false);
  const [freeChunks, setFreeChunks] = useState<string[]>([]);
  const [currentFreeIndex, setCurrentFreeIndex] = useState(0);
  const [hasStoredFree, setHasStoredFree] = useState(false);

  // --------------------------------------------------
  // TAB 2: HIGH QUALITY AI VOICE STATE
  // --------------------------------------------------
  const [aiText, setAiText] = useState(TEXT_TEMPLATES[0].text);
  const [selectedVoice, setSelectedVoice] = useState("Friendly voice");
  const [selectedStyle, setSelectedStyle] = useState("Normal");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(true);

  // Playlist & Generation States
  const [audioParts, setAudioParts] = useState<AudioPart[]>([]);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [isPlaying, setIsPlaying] = useState(false);

  // References
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Refs for SpeechSynthesis play states to avoid closure capture issues
  const isPlayingFreeRef = useRef(false);
  const freeChunksRef = useRef<string[]>([]);
  const currentFreeIndexRef = useRef(0);

  // Sync React states to refs for background player
  useEffect(() => {
    isPlayingFreeRef.current = isPlayingFree;
  }, [isPlayingFree]);

  useEffect(() => {
    freeChunksRef.current = freeChunks;
  }, [freeChunks]);

  useEffect(() => {
    currentFreeIndexRef.current = currentFreeIndex;
  }, [currentFreeIndex]);

  // Load browser voices for Free Simple Voice
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      setVoices(allVoices);
      if (allVoices.length > 0) {
        // Try to pick a natural English voice if possible, else default to first
        const defaultVoice = allVoices.find(v => v.lang.startsWith("en-") && v.name.includes("Google")) || 
                             allVoices.find(v => v.lang.startsWith("en")) || 
                             allVoices.find(v => v.default) || 
                             allVoices[0];
        setFreeVoice(prev => prev || defaultVoice.voiceURI || defaultVoice.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Sync API Key from local storage
  useEffect(() => {
    const savedKey = localStorage.getItem("pal_gemini_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setRememberKey(true);
    } else {
      setRememberKey(false);
    }

    // Check if there is a saved Free mode reading position
    const savedFreeIndex = localStorage.getItem("pal_free_last_index");
    const savedFreeText = localStorage.getItem("pal_free_last_text");
    if (savedFreeIndex !== null && savedFreeText) {
      setHasStoredFree(true);
    }
  }, []);

  // Rotate loading messages dynamically during long audio synthesis
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setLoadingMsgIndex(0);
      interval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Clean up audio Object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      audioParts.forEach((part) => {
        if (part.audioUrl) {
          URL.revokeObjectURL(part.audioUrl);
        }
      });
    };
  }, [audioParts]);

  // Clean up ongoing SpeechSynthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle playing AI audio automatically when active index changes (continuous flow)
  useEffect(() => {
    if (audioParts.length > 0 && audioParts[currentPlayingIndex]?.audioUrl) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.src = audioParts[currentPlayingIndex].audioUrl!;
        audioPlayerRef.current.load();
        if (isPlaying) {
          audioPlayerRef.current.play().catch((e) => console.log("Continuous play delayed:", e));
        }
      }
    }
  }, [currentPlayingIndex]);

  // Reset chunks when Free text changes
  useEffect(() => {
    setFreeChunks([]);
    setCurrentFreeIndex(0);
  }, [freeText]);

  // --------------------------------------------------
  // TAB 1: FREE VOICE HANDLERS
  // --------------------------------------------------
  const startFreeReading = (startIndex: number = 0) => {
    if (freeText.trim() === "") {
      setError("Please paste some text first in the Free Simple Voice input box.");
      return;
    }
    setError(null);

    let activeChunks = freeChunks;
    if (freeChunks.length === 0) {
      activeChunks = splitFreeTextIntoChunks(freeText);
      setFreeChunks(activeChunks);
      if (activeChunks.length === 0) return;
    }

    readFreeChunk(startIndex, activeChunks);
  };

  const readFreeChunk = (index: number, chunksArray: string[]) => {
    if (index < 0 || index >= chunksArray.length) {
      setIsPlayingFree(false);
      setIsPausedFree(false);
      window.speechSynthesis.cancel();
      return;
    }

    setIsPlayingFree(true);
    setIsPausedFree(false);
    setCurrentFreeIndex(index);

    // Save position in localStorage
    localStorage.setItem("pal_free_last_index", index.toString());
    localStorage.setItem("pal_free_last_text", freeText);
    setHasStoredFree(true);

    window.speechSynthesis.cancel();

    const chunkText = chunksArray[index];
    const utterance = new SpeechSynthesisUtterance(chunkText);

    // Apply voice selection
    if (freeVoice) {
      const selected = voices.find(v => v.voiceURI === freeVoice || v.name === freeVoice);
      if (selected) {
        utterance.voice = selected;
      }
    }

    // Apply speed rate
    utterance.rate = freeSpeed;

    utterance.onend = () => {
      // Continue automatically only if the user didn't stop or pause
      if (isPlayingFreeRef.current) {
        const nextIdx = index + 1;
        if (nextIdx < chunksArray.length) {
          readFreeChunk(nextIdx, chunksArray);
        } else {
          setIsPlayingFree(false);
          setIsPausedFree(false);
        }
      }
    };

    utterance.onerror = (e) => {
      console.error("Utterance speech error:", e);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handlePauseFree = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsPausedFree(true);
    }
  };

  const handleResumeFree = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsPausedFree(false);
    }
  };

  const handleStopFree = () => {
    setIsPlayingFree(false);
    setIsPausedFree(false);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const handleNextFree = () => {
    const nextIdx = currentFreeIndex + 1;
    if (nextIdx < freeChunks.length) {
      if (isPlayingFree) {
        readFreeChunk(nextIdx, freeChunks);
      } else {
        setCurrentFreeIndex(nextIdx);
      }
    }
  };

  const handlePrevFree = () => {
    const prevIdx = currentFreeIndex - 1;
    if (prevIdx >= 0) {
      if (isPlayingFree) {
        readFreeChunk(prevIdx, freeChunks);
      } else {
        setCurrentFreeIndex(prevIdx);
      }
    }
  };

  const handleRestoreFree = () => {
    const savedIndexStr = localStorage.getItem("pal_free_last_index");
    const savedFreeText = localStorage.getItem("pal_free_last_text");
    if (savedIndexStr !== null && savedFreeText) {
      const savedIndex = parseInt(savedIndexStr, 10);
      setFreeText(savedFreeText);
      const chunks = splitFreeTextIntoChunks(savedFreeText);
      setFreeChunks(chunks);
      if (chunks.length > 0) {
        const targetIndex = Math.min(savedIndex, chunks.length - 1);
        setCurrentFreeIndex(targetIndex);
        readFreeChunk(targetIndex, chunks);
      }
    }
  };

  const handleChunkClick = (index: number) => {
    if (isPlayingFree) {
      readFreeChunk(index, freeChunks);
    } else {
      setCurrentFreeIndex(index);
    }
  };

  // --------------------------------------------------
  // TAB 2: HIGH QUALITY AI VOICE HANDLERS
  // --------------------------------------------------
  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    if (rememberKey) {
      localStorage.setItem("pal_gemini_api_key", val);
    }
  };

  const handleRememberChange = (checked: boolean) => {
    setRememberKey(checked);
    if (checked) {
      localStorage.setItem("pal_gemini_api_key", apiKey);
    } else {
      localStorage.removeItem("pal_gemini_api_key");
    }
  };

  const handleClearSavedApiKey = () => {
    setApiKey("");
    localStorage.removeItem("pal_gemini_api_key");
    setRememberKey(false);
  };

  // Convert text to speech recursively/sequentially
  const handleGenerateAudio = async () => {
    if (!apiKey.trim()) {
      setError("Please paste your Gemini API key in the API key input box first.");
      return;
    }
    if (!aiText.trim()) {
      setError("Please paste or type some text first in the AI text area.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsPlaying(false);

    // Revoke old urls to prevent leaks
    audioParts.forEach((p) => {
      if (p.audioUrl) URL.revokeObjectURL(p.audioUrl);
    });

    const partsTexts = splitTextIntoParts(aiText, 4000);
    
    // Initialize parts state
    const initialParts: AudioPart[] = partsTexts.map((txt, idx) => ({
      partIndex: idx,
      text: txt,
      audioUrl: null,
      blob: null,
      status: "idle" as const,
    }));

    setAudioParts(initialParts);
    setCurrentPlayingIndex(0);
    
    let updatedParts = [...initialParts];
    let hasAtLeastOneSuccess = false;

    for (let i = 0; i < partsTexts.length; i++) {
      setGenerationProgress({ current: i + 1, total: partsTexts.length });
      
      // Update currently generating item
      updatedParts = updatedParts.map((p, idx) => 
        idx === i ? { ...p, status: "generating" as const } : p
      );
      setAudioParts(updatedParts);

      let success = false;
      let generatedUrl: string | null = null;
      let audioBlob: Blob | null = null;
      let lastError = "";

      // Map user voice selection to Gemini prebuilt voice config name
      // Prebuilt options: 'Kore' (Calm), 'Fenrir' (Professional), 'Zephyr' (Friendly), 'Puck' (Deliberate), 'Charon' (Energetic)
      let voiceName = "Zephyr";
      if (selectedVoice === "Calm narrator") {
        voiceName = "Kore";
      } else if (selectedVoice === "Professional reader") {
        voiceName = "Fenrir";
      } else if (selectedVoice === "Friendly voice") {
        voiceName = "Zephyr";
      } else if (selectedVoice === "Slow clear reading") {
        voiceName = "Puck";
      } else if (selectedVoice === "Energetic reading") {
        voiceName = "Charon";
      }

      // Design a tailored prompt guiding style, speed, and pronunciation directly inside the prompt
      let stylePrompt = "Read the following article aloud in a natural narrator voice.";

      if (selectedVoice === "Calm narrator") {
        stylePrompt = "Read the following article aloud in a slow, clear, calm narrator voice. Speak in a calm, soothing, gentle narrative tone with a peaceful delivery.";
      } else if (selectedVoice === "Professional reader") {
        stylePrompt = "Read the following article aloud in an articulate, steady, professional reader voice. Speak in an articulate, steady, professional news-anchor or audiobook style with perfect diction.";
      } else if (selectedVoice === "Friendly voice") {
        stylePrompt = "Read the following article aloud in a warm, friendly voice. Speak in a warm, friendly, conversational, and natural tone, as if talking to a colleague.";
      } else if (selectedVoice === "Slow clear reading") {
        stylePrompt = "Read the following article aloud in an extremely slow, deliberate, clear reader voice. Speak extremely slowly and deliberately, pausing slightly between sentences for clear comprehension.";
      } else if (selectedVoice === "Energetic reading") {
        stylePrompt = "Read the following article aloud in an enthusiastic, lively narrator voice. Speak with high enthusiasm, a lively cadence, and an engaging narrative flow.";
      }

      if (selectedStyle === "Slow") {
        stylePrompt += " Use a relaxed pace, speaking slowly with comfortable, deliberate pauses.";
      } else if (selectedStyle === "Very clear") {
        stylePrompt += " Focus on crisp, pristine enunciation of every word and syllable.";
      } else if (selectedStyle === "Podcast style") {
        stylePrompt += " Deliver the narration with an engaging, casual, yet informative solo podcast storytelling cadence.";
      }

      stylePrompt += "\nKeep the pronunciation natural.\nDo not summarize.\nDo not add extra words.\nOnly read the provided article text.";

      const chunks = splitTextIntoChunks(partsTexts[i], 800);
      const chunkArrays: Uint8Array[] = [];
      let isPartSuccess = true;

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunkText = chunks[chunkIdx];
        const finalPrompt = `${stylePrompt}\n\nARTICLE:\n${chunkText}`;
        let base64Audio: string | undefined;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey.trim()}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: finalPrompt }] }],
                  generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                      },
                    },
                  },
                }),
              }
            );

            if (!res.ok) {
              let errMsg = `Failed to generate audio chunk ${chunkIdx + 1} of part ${i + 1}.`;
              try {
                const errData = await res.json();
                if (errData.error?.message) {
                  errMsg = errData.error.message;
                }
              } catch (e) {}

              const errLower = errMsg.toLowerCase();
              if (errLower.includes("key") && (errLower.includes("not valid") || errLower.includes("invalid") || errLower.includes("unauthorized") || errLower.includes("api_key"))) {
                errMsg = "Your Gemini API key is invalid. Please double-check and enter a valid API key on the High Quality AI Voice tab.";
              } else if (errLower.includes("quota") || errLower.includes("exhausted") || errLower.includes("limit") || errLower.includes("resource") || errLower.includes("429")) {
                errMsg = "Your Gemini quota is finished. Use Free Simple Voice mode or try another API key.";
              }
              throw new Error(errMsg);
            }

            const data = await res.json();
            base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (!base64Audio) {
              throw new Error(`No audio data returned from Gemini TTS API.`);
            }
            break; // Success
          } catch (chunkErr: any) {
            console.error(`Attempt ${attempts} failed for part ${i + 1} chunk ${chunkIdx + 1}:`, chunkErr);
            lastError = chunkErr.message || chunkErr;
            if (attempts < maxAttempts) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          }
        }

        if (base64Audio) {
          chunkArrays.push(base64ToUint8Array(base64Audio));
        } else {
          isPartSuccess = false;
          break; // Stop part processing since a chunk failed
        }
      }

      if (isPartSuccess && chunkArrays.length > 0) {
        const combinedPcm = concatUint8Arrays(chunkArrays);
        const wavData = addWavHeader(combinedPcm, 24000, 1, 16);
        audioBlob = new Blob([wavData], { type: "audio/wav" });
        generatedUrl = URL.createObjectURL(audioBlob);
        success = true;
        hasAtLeastOneSuccess = true;
      }

      if (success && generatedUrl && audioBlob) {
        updatedParts = updatedParts.map((p, idx) => 
          idx === i ? { ...p, status: "completed" as const, audioUrl: generatedUrl, blob: audioBlob } : p
        );
      } else {
        updatedParts = updatedParts.map((p, idx) => 
          idx === i ? { ...p, status: "failed" as const, error: lastError } : p
        );
      }
      setAudioParts(updatedParts);
    }

    setIsLoading(false);

    if (hasAtLeastOneSuccess) {
      // Find the first completed part to start playing
      const firstCompletedIdx = updatedParts.findIndex(p => p.status === "completed");
      if (firstCompletedIdx !== -1) {
        setCurrentPlayingIndex(firstCompletedIdx);
        setIsPlaying(true);
        setTimeout(() => {
          if (audioPlayerRef.current) {
            audioPlayerRef.current.play().catch((e) => {
              console.log("Auto-play blocked by browser. Ready for user click.", e);
            });
          }
        }, 150);
      }

      // Scroll to playlist controls
      setTimeout(() => {
        const playerElement = document.getElementById("audio-playlist-workspace");
        playerElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else {
      setError("All parts failed to generate. Please check your network, Gemini API key configuration or try Free Simple Voice.");
    }
  };

  // Continuous play logic when audio ends (skips failed parts)
  const handleAudioEnded = () => {
    let nextIdx = currentPlayingIndex + 1;
    while (nextIdx < audioParts.length && !audioParts[nextIdx]?.audioUrl) {
      nextIdx++;
    }
    if (nextIdx < audioParts.length && audioParts[nextIdx]?.audioUrl) {
      setCurrentPlayingIndex(nextIdx);
      setIsPlaying(true);
      setTimeout(() => {
        audioPlayerRef.current?.play().catch((e) => console.log(e));
      }, 150);
    } else {
      setIsPlaying(false);
    }
  };

  // AI Playlist actions
  const handlePlayPause = () => {
    if (!audioPlayerRef.current || audioParts.length === 0) return;
    
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      let targetIdx = currentPlayingIndex;
      if (!audioParts[targetIdx]?.audioUrl) {
        targetIdx = audioParts.findIndex(p => p.audioUrl);
      }
      
      if (targetIdx !== -1) {
        setCurrentPlayingIndex(targetIdx);
        setIsPlaying(true);
        setTimeout(() => {
          audioPlayerRef.current?.play().catch((e) => console.log(e));
        }, 100);
      }
    }
  };

  const handleNext = () => {
    let nextIdx = currentPlayingIndex + 1;
    while (nextIdx < audioParts.length && !audioParts[nextIdx]?.audioUrl) {
      nextIdx++;
    }
    if (nextIdx < audioParts.length && audioParts[nextIdx]?.audioUrl) {
      setCurrentPlayingIndex(nextIdx);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    let prevIdx = currentPlayingIndex - 1;
    while (prevIdx >= 0 && !audioParts[prevIdx]?.audioUrl) {
      prevIdx--;
    }
    if (prevIdx >= 0 && audioParts[prevIdx]?.audioUrl) {
      setCurrentPlayingIndex(prevIdx);
      setIsPlaying(true);
    }
  };

  const downloadCurrentPart = () => {
    const currentPart = audioParts[currentPlayingIndex];
    if (currentPart && currentPart.audioUrl) {
      const link = document.createElement("a");
      link.href = currentPart.audioUrl;
      link.download = `narrated-article-part-${currentPart.partIndex + 1}.wav`;
      link.click();
    }
  };

  const downloadAllPartsAsZip = async () => {
    const completedParts = audioParts.filter(p => p.blob);
    if (completedParts.length === 0) {
      setError("No generated audio parts to pack yet.");
      return;
    }

    try {
      const zip = new JSZip();
      completedParts.forEach((p, idx) => {
        if (p.blob) {
          zip.file(`part-${idx + 1}-narrated.wav`, p.blob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = `article-narrations-all-parts.zip`;
      link.click();
      
      URL.revokeObjectURL(zipUrl);
    } catch (e: any) {
      console.error(e);
      setError("Failed to compile ZIP file. Please try downloading parts individually.");
    }
  };

  const handleClearText = () => {
    if (activeTab === "free") {
      setFreeText("");
      setFreeChunks([]);
      setCurrentFreeIndex(0);
    } else {
      setAiText("");
      setAudioParts([]);
    }
    setError(null);
  };

  const handleLoadTemplate = (templateText: string) => {
    if (activeTab === "free") {
      setFreeText(templateText);
    } else {
      setAiText(templateText);
    }
    setError(null);
  };

  // Approximate duration calculation (roughly 140 words per minute / ~900 chars per minute)
  const calculateEstimatedDuration = (inputText: string) => {
    if (!inputText.trim()) return null;
    const wordsCount = inputText.trim().split(/\s+/).length;
    const minutes = Math.ceil(wordsCount / 140);
    return minutes === 1 ? "Approx. 1 minute read" : `Approx. ${minutes} minutes read`;
  };

  // Preview properties
  const isVeryLongFree = freeText.length > 15000;
  const isVeryLongAi = aiText.length > 15000;
  
  const previewPartsAi = splitTextIntoParts(aiText, 4000);
  const totalPartsCountAi = previewPartsAi.length;

  const currentFreeChunks = freeChunks.length > 0 ? freeChunks : splitFreeTextIntoChunks(freeText);

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 font-sans flex flex-col overflow-x-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Subtle Ambient Glow Ornaments */}
      <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-emerald-950/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-[500px] h-[500px] bg-[#131316]/40 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-center px-8 py-5 border-b border-white/5 bg-[#0F0F11] relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white">
            <Headphones className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-medium tracking-tight text-white">Personal Article Listener</h1>
            <p className="text-xs text-slate-500">Listen to study guides, logs, and essays on your own schedule.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium mt-4 sm:mt-0">
          <span className="text-emerald-400 flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Active
          </span>
          <span className="px-2.5 py-1 bg-white/5 rounded border border-white/10 text-slate-400 uppercase tracking-widest text-[10px] font-mono">
            v4.0 Duo
          </span>
        </div>
      </header>

      {/* Mode Switches / Tab Navigation */}
      <div className="bg-[#0D0D0F] border-b border-white/5 py-3 px-8 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          
          {/* Main Tab Controls */}
          <div className="flex bg-white/5 p-1 rounded-xl self-start" id="tab-controls">
            <button
              onClick={() => {
                setActiveTab("free");
                setError(null);
                handleStopFree();
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "free"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              Free Simple Voice
              <span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider ml-1 text-white">
                Browser
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab("ai");
                setError(null);
                handleStopFree();
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "ai"
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              High Quality AI Voice
              <span className="text-[10px] bg-emerald-500/25 text-emerald-300 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider ml-1">
                Gemini
              </span>
            </button>
          </div>

          {/* Quick Info Bar */}
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {activeTab === "free" 
                ? "Free mode uses your browser's local TTS engine with zero network cost." 
                : "Premium AI mode generates realistic narrations via your own Gemini API key."
              }
            </span>
          </div>
        </div>
      </div>

      {/* Quick Explanation Card */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111114] border border-white/5 p-5 rounded-2xl">
          <div className={`p-4 rounded-xl border transition-all ${activeTab === "free" ? "bg-emerald-500/5 border-emerald-500/25" : "bg-transparent border-transparent"}`}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
              <Volume2 className="w-4 h-4 text-emerald-400" /> Free Simple Voice
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Best for daily listening. Completely free with no API key required. Uses your browser's offline vocal synthesizers. Supports indefinite text length.
            </p>
          </div>
          <div className={`p-4 rounded-xl border transition-all ${activeTab === "ai" ? "bg-emerald-500/5 border-emerald-500/25" : "bg-transparent border-transparent"}`}>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-emerald-400" /> High Quality AI Voice
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Best for premium, natural human-like voice quality and downloadable audio formats. Connects securely via your own Gemini API key and tracks your standard quota.
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="flex-grow flex flex-col lg:flex-row p-6 gap-6 relative z-10 max-w-7xl mx-auto w-full">
        
        {/* LEFT COLUMN: Input and Config panel */}
        <div className="flex-grow flex flex-col gap-4 w-full lg:w-2/3">
          
          {/* -------------------------------------------
              TAB 1: FREE VOICE VIEW (LEFT COLUMN)
              ------------------------------------------- */}
          {activeTab === "free" && (
            <div className="flex-grow relative bg-[#131316] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col min-h-[480px]">
              
              {/* Box header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                <label htmlFor="free-text-area" className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" /> Free Article Content
                </label>

                {isVeryLongFree && (
                  <span className="bg-amber-950/80 border border-amber-800 text-amber-200 px-2.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-mono uppercase tracking-wider animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Long Article
                  </span>
                )}
              </div>

              {/* Text Area */}
              <textarea 
                id="free-text-area"
                className="w-full flex-grow bg-transparent border-0 text-slate-300 placeholder:text-slate-600 focus:outline-none resize-none text-base md:text-lg leading-relaxed focus:ring-0 min-h-[250px]"
                placeholder="Paste your long-form article, books, notes, or study guidelines here..."
                value={freeText}
                onChange={(e) => {
                  setFreeText(e.target.value);
                  if (error) setError(null);
                }}
              />

              {/* Stats and Helpers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs font-mono text-slate-500 gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{freeText.length.toLocaleString()} characters</span>
                  {freeText.trim() && (
                    <>
                      <span>•</span>
                      <span className="text-slate-400">{calculateEstimatedDuration(freeText)}</span>
                      <span>•</span>
                      <span className="text-emerald-400/90 font-medium">
                        Split into {currentFreeChunks.length} local chunks (~1,000 characters each)
                      </span>
                    </>
                  )}
                </div>
                <button 
                  onClick={handleClearText}
                  className="text-red-400/80 hover:text-red-400 transition-colors flex items-center gap-1 self-end sm:self-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Content
                </button>
              </div>

              {/* Controls Footer */}
              <div className="mt-6 flex flex-wrap items-center gap-3 bg-[#0F0F12] border border-white/5 p-4 rounded-xl">
                
                {/* Play, Pause, Resume, Stop controls */}
                <div className="flex items-center gap-2">
                  {!isPlayingFree ? (
                    <button
                      onClick={() => startFreeReading(currentFreeIndex)}
                      disabled={!freeText.trim()}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/15 disabled:opacity-45 disabled:cursor-not-allowed text-sm"
                    >
                      <Play className="w-4 h-4 fill-current" /> Start Reading
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {!isPausedFree ? (
                        <button
                          onClick={handlePauseFree}
                          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-medium px-5 py-2.5 rounded-xl transition-all text-sm"
                        >
                          <Pause className="w-4 h-4 fill-current" /> Pause
                        </button>
                      ) : (
                        <button
                          onClick={handleResumeFree}
                          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-5 py-2.5 rounded-xl transition-all text-sm"
                        >
                          <Play className="w-4 h-4 fill-current" /> Resume
                        </button>
                      )}

                      <button
                        onClick={handleStopFree}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-medium px-4 py-2.5 rounded-xl transition-all text-sm"
                      >
                        <VolumeX className="w-4 h-4" /> Stop
                      </button>
                    </div>
                  )}
                </div>

                {/* Next / Prev paragraph buttons */}
                <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                  <button
                    onClick={handlePrevFree}
                    disabled={currentFreeIndex === 0 || currentFreeChunks.length <= 1}
                    className="p-2.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Previous paragraph"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextFree}
                    disabled={currentFreeIndex >= currentFreeChunks.length - 1 || currentFreeChunks.length <= 1}
                    className="p-2.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Next paragraph"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Restore Saved Position */}
                {hasStoredFree && (
                  <button
                    onClick={handleRestoreFree}
                    className="ml-auto flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 rounded-xl transition-all text-xs font-medium"
                  >
                    <Bookmark className="w-3.5 h-3.5" /> Continue Last Position
                  </button>
                )}
              </div>

              {/* Offline Disclaimer */}
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-white/5 p-3 rounded-xl border border-white/5">
                <Info className="w-4 h-4 text-emerald-500/80 shrink-0" />
                <p>
                  Free mode uses your browser voice. No API key, no cost, no download. Ideal for offline or high-volume notes parsing.
                </p>
              </div>
            </div>
          )}

          {/* -------------------------------------------
              TAB 2: HIGH QUALITY AI VOICE (LEFT COLUMN)
              ------------------------------------------- */}
          {activeTab === "ai" && (
            <div className="flex-grow flex flex-col gap-4">
              
              {/* API Key Configuration Card */}
              <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
                <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" /> Gemini Authentication Setup
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  <div className="md:col-span-8 relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      placeholder="Paste your Gemini API key (AI Studio)"
                      value={apiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 text-sm font-mono pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="md:col-span-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={rememberKey}
                        onChange={(e) => handleRememberChange(e.target.checked)}
                        className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500/20 focus:ring-offset-0 bg-[#1A1A1E] w-4 h-4"
                      />
                      Remember key
                    </label>

                    {apiKey && (
                      <button
                        onClick={handleClearSavedApiKey}
                        className="text-red-400/80 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 transition-all text-[11px] font-mono font-medium flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" /> Clear saved API key
                      </button>
                    )}
                  </div>
                </div>

                {/* Quota Warning Banner */}
                <div className="mt-4 flex items-start gap-2.5 text-xs text-amber-300/90 bg-amber-950/20 p-3.5 rounded-xl border border-amber-800/30 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-200 mb-0.5">API Quota Information</p>
                    <p>
                      High Quality AI Voice uses your own Gemini API key and may consume your Gemini quota.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Your key is processed securely server-side and is only saved locally in your own browser's storage if "Remember key" is checked.
                    </p>
                  </div>
                </div>
              </div>

              {/* Text Area Card */}
              <div className="flex-grow relative bg-[#131316] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col min-h-[350px]">
                
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                  <label htmlFor="ai-text-area" className="text-xs uppercase tracking-widest text-slate-500 font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> Premium Article Content
                  </label>

                  {isVeryLongAi && (
                    <span className="bg-amber-950/80 border border-amber-800 text-amber-200 px-2.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-mono uppercase tracking-wider animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Long Article
                    </span>
                  )}
                </div>

                <textarea 
                  id="ai-text-area"
                  className="w-full flex-grow bg-transparent border-0 text-slate-300 placeholder:text-slate-600 focus:outline-none resize-none text-base md:text-lg leading-relaxed focus:ring-0 min-h-[180px]"
                  placeholder="Paste text to generate premium studio voice recordings here..."
                  value={aiText}
                  onChange={(e) => {
                    setAiText(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isLoading}
                />

                {/* Stats & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs font-mono text-slate-500 gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{aiText.length.toLocaleString()} characters</span>
                    {aiText.trim() && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">{calculateEstimatedDuration(aiText)}</span>
                        <span>•</span>
                        <span className="text-emerald-400/90 font-medium">
                          Will generate in {totalPartsCountAi} {totalPartsCountAi === 1 ? "part" : "parts"} (~4k characters each)
                        </span>
                      </>
                    )}
                  </div>
                  <button 
                    onClick={handleClearText}
                    disabled={isLoading}
                    className="text-red-400/80 hover:text-red-400 disabled:opacity-40 transition-colors flex items-center gap-1 self-end sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear Content
                  </button>
                </div>

                {/* Generate Button Container */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-[#0F0F12] border border-white/5 p-4 rounded-xl">
                  
                  <div className="flex items-center gap-2">
                    {!isLoading ? (
                      <button
                        onClick={handleGenerateAudio}
                        disabled={!aiText.trim() || !apiKey.trim()}
                        className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-md shadow-emerald-500/15 disabled:opacity-45 disabled:cursor-not-allowed text-sm"
                      >
                        <Sparkles className="w-4.5 h-4.5" /> Generate AI Voice
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsLoading(false)}
                        className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-medium px-6 py-3 rounded-xl transition-all text-sm"
                      >
                        <Loader2 className="w-4.5 h-4.5 animate-spin" /> Stop Generation
                      </button>
                    )}
                  </div>

                  {isLoading && (
                    <div className="flex-grow md:max-w-xs flex flex-col gap-1 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-400">
                        <span className="animate-pulse">Generating part {generationProgress.current} of {generationProgress.total}...</span>
                        <span>{Math.round((generationProgress.current / generationProgress.total) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                          style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick template selector buttons */}
          <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
            <h4 className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Pick Starter Article Template
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TEXT_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleLoadTemplate(tmpl.text)}
                  disabled={isLoading}
                  className="flex flex-col items-start text-left p-4 rounded-xl border border-white/5 bg-[#17171C]/40 hover:bg-[#17171C] hover:border-emerald-500/20 transition-all text-xs"
                >
                  <span className="font-semibold text-white mb-1">{tmpl.label}</span>
                  <span className="text-[10px] text-slate-500">{tmpl.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Player lists, Highlight lists, or Side controls */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4">
          
          {/* Error Banner */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-2xl flex items-start gap-2.5 text-xs relative"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-grow pr-4">
                <strong className="font-semibold block mb-0.5">Execution Alert</strong>
                {error}
              </div>
              <button 
                onClick={() => setError(null)} 
                className="absolute top-3 right-3 text-red-400 hover:text-white font-mono text-sm"
              >
                ×
              </button>
            </motion.div>
          )}

          {/* -------------------------------------------
              TAB 1: FREE VOICE CONFIG & HIGHLIGHTS (RIGHT COLUMN)
              ------------------------------------------- */}
          {activeTab === "free" && (
            <div className="flex flex-col gap-4">
              
              {/* Local Voices & Speed Controls */}
              <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
                <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-4 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" /> Browser Voice Settings
                </h3>

                {/* Voice Selection Dropdown */}
                <div className="flex flex-col gap-2 mb-4">
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Select Voice</label>
                  <select
                    value={freeVoice}
                    onChange={(e) => setFreeVoice(e.target.value)}
                    disabled={isPlayingFree}
                    className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                  >
                    {voices.length === 0 ? (
                      <option value="">No voices detected. Using system default.</option>
                    ) : (
                      voices.map((v) => (
                        <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                          {v.name} ({v.lang}) {v.localService ? "[Offline]" : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Speed Controls Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Reading Speed</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0.75, 1, 1.25, 1.5].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setFreeSpeed(speed)}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                          freeSpeed === speed
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dynamic Chunk Highlighting Container */}
              <div className="bg-[#131316] border border-white/10 rounded-2xl p-6 flex flex-col max-h-[500px]">
                <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-emerald-400" /> Paragraphs ({currentFreeChunks.length})
                  </h3>
                  {currentFreeChunks.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Reading part {currentFreeIndex + 1} of {currentFreeChunks.length}
                    </span>
                  )}
                </div>

                {currentFreeChunks.length === 0 ? (
                  <div className="flex-grow flex flex-col items-center justify-center text-center p-8 text-slate-600 min-h-[250px]">
                    <FileText className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-xs">Paste an article to generate interactive highlights</p>
                  </div>
                ) : (
                  <div className="flex-grow overflow-y-auto space-y-3 pr-1 max-h-[350px]">
                    {currentFreeChunks.map((chunk, idx) => {
                      const isActive = idx === currentFreeIndex;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleChunkClick(idx)}
                          className={`p-3.5 rounded-xl border transition-all text-xs cursor-pointer select-none relative ${
                            isActive
                              ? "bg-emerald-500/10 border-emerald-500/40 text-slate-200 font-medium"
                              : "bg-white/5 border-white/5 hover:border-white/10 text-slate-400 hover:text-slate-300"
                          }`}
                        >
                          {isActive && (
                            <span className="absolute top-2 right-2 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          )}
                          <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px] text-slate-500">
                            <span className={isActive ? "text-emerald-400 font-bold" : ""}>Part {idx + 1}</span>
                            <span>•</span>
                            <span>{chunk.length} characters</span>
                          </div>
                          <p className="line-clamp-3 leading-relaxed">{chunk}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------------------------------
              TAB 2: HIGH QUALITY AI VOICE SIDE CONTROLS & PLAYLIST (RIGHT COLUMN)
              ------------------------------------------- */}
          {activeTab === "ai" && (
            <div className="flex flex-col gap-4">
              
              {/* Premium Voice Settings */}
              <div className="bg-[#131316] border border-white/10 rounded-2xl p-6">
                <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-4 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" /> Voice Style Selection
                </h3>

                {/* Voice Selection Cards */}
                <div className="flex flex-col gap-2 mb-4">
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Select Voice Style</label>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {VOICES.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVoice(v.id)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex justify-between items-center ${
                          selectedVoice === v.id
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                            : "bg-white/5 border-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div>
                          <span className="font-semibold block">{v.name}</span>
                          <span className="text-[10px] text-slate-500">{v.desc}</span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${selectedVoice === v.id ? "text-emerald-400 translate-x-0.5" : "text-slate-600"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed Selection Dropdown */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Reading Cadence</label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
                  >
                    {STYLES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} — {st.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Generated Audio Parts Workspace */}
              <div id="audio-playlist-workspace" className="bg-[#131316] border border-white/10 rounded-2xl p-6 flex flex-col">
                
                <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
                  <h3 className="text-xs uppercase tracking-widest text-slate-400 font-bold flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-emerald-400" /> Generated Playlist ({audioParts.length})
                  </h3>

                  {audioParts.some(p => p.blob) && (
                    <button
                      onClick={downloadAllPartsAsZip}
                      className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-[11px] font-mono"
                      title="Download all parts as a single ZIP archive"
                    >
                      <DownloadCloud className="w-4 h-4" /> Download ZIP
                    </button>
                  )}
                </div>

                {audioParts.length === 0 ? (
                  <div className="text-center py-12 text-slate-600 flex flex-col items-center justify-center min-h-[220px]">
                    <Headphones className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-xs">No narrated parts generated yet.</p>
                    <p className="text-[10px] text-slate-700 mt-1">Select voice and press "Generate AI Voice" above.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 mb-4">
                    {audioParts.map((part) => {
                      const isActive = part.partIndex === currentPlayingIndex;
                      
                      return (
                        <div
                          key={part.partIndex}
                          onClick={() => {
                            if (part.audioUrl) {
                              setCurrentPlayingIndex(part.partIndex);
                              setIsPlaying(true);
                            }
                          }}
                          className={`p-3 rounded-xl border text-xs transition-all flex items-center justify-between gap-3 ${
                            part.audioUrl ? "cursor-pointer" : "cursor-default"
                          } ${
                            isActive
                              ? "bg-emerald-500/10 border-emerald-500/40 text-slate-200"
                              : "bg-[#17171C]/50 border-white/5 hover:border-white/10 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Play status icon */}
                            {part.status === "generating" ? (
                              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                            ) : part.status === "failed" ? (
                              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            ) : part.status === "completed" ? (
                              isActive && isPlaying ? (
                                <Pause className="w-4 h-4 text-emerald-400 shrink-0 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 text-slate-400 shrink-0 fill-current" />
                              )
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-600 shrink-0" />
                            )}

                            <div className="min-w-0">
                              <span className={`font-semibold block ${isActive ? "text-emerald-400" : "text-white"}`}>
                                Part {part.partIndex + 1}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono truncate block">
                                {part.status === "completed" ? "Ready" : part.status === "generating" ? "Generating..." : part.status === "failed" ? "Failed" : "Pending"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {part.blob && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const link = document.createElement("a");
                                  link.href = part.audioUrl!;
                                  link.download = `narrated-article-part-${part.partIndex + 1}.wav`;
                                  link.click();
                                }}
                                className="p-1.5 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors"
                                title="Download WAV"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Built-in HTML Playback controller */}
                {audioParts.length > 0 && (
                  <div className="pt-4 border-t border-white/5 flex flex-col gap-3">
                    
                    {/* Audio Player object (hidden but hooked up to react) */}
                    <audio
                      ref={audioPlayerRef}
                      src={audioParts[currentPlayingIndex]?.audioUrl || undefined}
                      onEnded={handleAudioEnded}
                      controls
                      className="w-full h-9 accent-emerald-500 focus:outline-none"
                    />

                    {/* Rich custom player console controls */}
                    <div className="flex items-center justify-between px-2 text-slate-400">
                      <span className="text-[10px] font-mono uppercase text-slate-500">
                        Playing Part {currentPlayingIndex + 1} / {audioParts.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrev}
                          disabled={currentPlayingIndex === 0}
                          className="p-1.5 hover:bg-white/5 rounded transition-all disabled:opacity-20"
                        >
                          <SkipBack className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handlePlayPause}
                          className="p-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full transition-all"
                        >
                          {isPlaying ? <Pause className="w-4.5 h-4.5 fill-current" /> : <Play className="w-4.5 h-4.5 fill-current ml-0.5" />}
                        </button>
                        <button
                          onClick={handleNext}
                          disabled={currentPlayingIndex === audioParts.length - 1}
                          className="p-1.5 hover:bg-white/5 rounded transition-all disabled:opacity-20"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={downloadCurrentPart}
                        disabled={!audioParts[currentPlayingIndex]?.audioUrl}
                        className="p-1.5 hover:bg-white/5 rounded text-emerald-400 hover:text-emerald-300 disabled:opacity-30 transition-all"
                        title="Download active part"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/5 text-[11px] text-slate-600 font-mono mt-12 bg-[#0A0A0B]">
        Free mode has no cost. AI voice mode requires your own Gemini API key.
      </footer>
    </div>
  );
}
