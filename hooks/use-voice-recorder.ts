"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendStt } from "@/lib/ai/client";

export type VoiceState = "idle" | "recording" | "processing";

const TARGET_SAMPLE_RATE = 16000;

interface BrowserSpeechRecognitionAlternative {
  transcript?: string;
}

interface BrowserSpeechRecognitionResult {
  length: number;
  isFinal?: boolean;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent extends Event {
  results: ArrayLike<BrowserSpeechRecognitionResult>;
  resultIndex?: number;
}

interface BrowserSpeechRecognitionErrorEvent extends Event {
  error?: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export interface UseVoiceRecorderResult {
  voiceState: VoiceState;
  liveTranscript: string;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

function getBrowserSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const recognition = (
    window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    }
  ).SpeechRecognition ?? (
    window as typeof window & {
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    }
  ).webkitSpeechRecognition;

  return recognition ?? null;
}

function readRecognitionTranscript(event: BrowserSpeechRecognitionEvent) {
  let finalTranscript = "";
  let interimTranscript = "";

  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (!result || result.length === 0) continue;
    const transcript = result[0]?.transcript ?? "";
    if (result.isFinal) {
      finalTranscript += transcript;
    } else {
      interimTranscript += transcript;
    }
  }

  return {
    finalTranscript: finalTranscript.trim(),
    interimTranscript: interimTranscript.trim(),
    combinedTranscript: `${finalTranscript}${interimTranscript}`.trim(),
  };
}

function mergeFloat32Chunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function resampleLinear(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, input.length - 1);
    const weight = position - leftIndex;
    output[i] = input[leftIndex] * (1 - weight) + input[rightIndex] * weight;
  }

  return output;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function useVoiceRecorder(
  onResult: (transcript: string) => void,
  onError?: () => void,
): UseVoiceRecorderResult {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const resultRef = useRef(onResult);
  const errorRef = useRef(onError);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sinkRef = useRef<GainNode | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const usingBrowserRecognitionRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const transcriptDeliveredRef = useRef(false);
  const finalTranscriptRef = useRef("");
  const liveTranscriptRef = useRef("");
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(TARGET_SAMPLE_RATE);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  const cleanupAudioCapture = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    sinkRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch(() => undefined);

    processorRef.current = null;
    sourceRef.current = null;
    sinkRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    chunksRef.current = [];
  }, []);

  const cleanupBrowserRecognition = useCallback((abort = false) => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    usingBrowserRecognitionRef.current = false;
    stopRequestedRef.current = false;
    transcriptDeliveredRef.current = false;
    finalTranscriptRef.current = "";
    liveTranscriptRef.current = "";

    if (!recognition) {
      return;
    }

    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    if (abort) {
      try {
        recognition.abort?.();
      } catch {
        // Ignore browser recognition abort failures.
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    cleanupAudioCapture();
    cleanupBrowserRecognition(true);
  }, [cleanupAudioCapture, cleanupBrowserRecognition]);

  const startRecording = useCallback(async () => {
    if (voiceState !== "idle") return;
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    liveTranscriptRef.current = "";

    const BrowserRecognition = getBrowserSpeechRecognitionConstructor();
    if (BrowserRecognition) {
      try {
        const recognition = new BrowserRecognition();
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        usingBrowserRecognitionRef.current = true;
        stopRequestedRef.current = false;
        transcriptDeliveredRef.current = false;
        recognitionRef.current = recognition;

        recognition.onstart = () => {
          setVoiceState("recording");
        };

        recognition.onresult = (event) => {
          const transcript = readRecognitionTranscript(event);
          if (!transcript.combinedTranscript) {
            return;
          }

          finalTranscriptRef.current = transcript.finalTranscript || finalTranscriptRef.current;
          liveTranscriptRef.current = transcript.combinedTranscript;
          setLiveTranscript(transcript.combinedTranscript);
        };

        recognition.onerror = () => {
          cleanupBrowserRecognition();
          errorRef.current?.();
          setVoiceState("idle");
        };

        recognition.onend = () => {
          const transcript = (liveTranscriptRef.current || finalTranscriptRef.current).trim();
          if (transcript) {
            transcriptDeliveredRef.current = true;
            resultRef.current(transcript);
          }
          const delivered = transcriptDeliveredRef.current;
          const manuallyStopped = stopRequestedRef.current;
          cleanupBrowserRecognition();

          if (!delivered && manuallyStopped) {
            errorRef.current?.();
          }

          setVoiceState("idle");
        };

        recognition.start();
        return;
      } catch {
        cleanupBrowserRecognition();
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const sink = audioContext.createGain();
      sink.gain.value = 0;

      chunksRef.current = [];
      sampleRateRef.current = audioContext.sampleRate;

      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(channel));
      };

      source.connect(processor);
      processor.connect(sink);
      sink.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      sinkRef.current = sink;
      usingBrowserRecognitionRef.current = false;

      setVoiceState("recording");
    } catch {
      cleanup();
      errorRef.current?.();
    }
  }, [cleanup, cleanupBrowserRecognition, voiceState]);

  const stopRecording = useCallback(() => {
    if (voiceState !== "recording") return;

    if (usingBrowserRecognitionRef.current) {
      stopRequestedRef.current = true;
      setVoiceState("processing");
      recognitionRef.current?.stop();
      return;
    }

    const finalize = async () => {
      setVoiceState("processing");
      const merged = mergeFloat32Chunks(chunksRef.current);
      const sampleRate = sampleRateRef.current;
      cleanupAudioCapture();

      if (merged.length === 0) {
        errorRef.current?.();
        setVoiceState("idle");
        return;
      }

      try {
        const resampled = resampleLinear(merged, sampleRate, TARGET_SAMPLE_RATE);
        const wavBlob = encodeWav(resampled, TARGET_SAMPLE_RATE);
        const result = await sendStt(wavBlob, "agent");
        if (result.transcript) {
          resultRef.current(result.transcript);
        } else {
          errorRef.current?.();
        }
      } catch {
        errorRef.current?.();
      }

      setVoiceState("idle");
    };

    void finalize();
  }, [cleanupAudioCapture, voiceState]);

  useEffect(() => cleanup, [cleanup]);

  return { voiceState, liveTranscript, startRecording, stopRecording };
}
