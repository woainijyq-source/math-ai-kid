"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendStt } from "@/lib/ai/client";

type VoiceState = "idle" | "recording" | "processing";

const TARGET_SAMPLE_RATE = 16000;

export interface UseVoiceRecorderResult {
  voiceState: VoiceState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
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
  const resultRef = useRef(onResult);
  const errorRef = useRef(onError);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sinkRef = useRef<GainNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(TARGET_SAMPLE_RATE);

  useEffect(() => {
    resultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  const cleanup = useCallback(() => {
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

  const startRecording = useCallback(async () => {
    if (voiceState !== "idle") return;

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

      setVoiceState("recording");
    } catch {
      cleanup();
      errorRef.current?.();
    }
  }, [cleanup, voiceState]);

  const stopRecording = useCallback(() => {
    if (voiceState !== "recording") return;

    const finalize = async () => {
      setVoiceState("processing");
      const merged = mergeFloat32Chunks(chunksRef.current);
      const sampleRate = sampleRateRef.current;
      cleanup();

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
  }, [cleanup, voiceState]);

  useEffect(() => cleanup, [cleanup]);

  return { voiceState, startRecording, stopRecording };
}
