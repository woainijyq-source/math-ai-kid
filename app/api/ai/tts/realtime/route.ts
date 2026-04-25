import { canUseQwenRealtimeTts, streamQwenRealtimeTts } from "@/lib/ai/qwen-tts-realtime";
import { canUseVolcengineTtsV3, streamVolcengineTtsV3 } from "@/lib/ai/volcengine-tts-v3";
import type { TtsRequestPayload } from "@/types";

export const runtime = "nodejs";

function encodeSseEvent(event: Record<string, unknown>) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  let payload: TtsRequestPayload;

  try {
    payload = (await request.json()) as TtsRequestPayload;
  } catch {
    return new Response("invalid realtime tts payload", {
      status: 400,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const trace: string[] = [];

      const send = (event: Record<string, unknown>) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        try {
          controller.close();
        } catch {
          // The client may have already aborted the stream.
        }
      };

      void (async () => {
        try {
          const commonHandlers = {
            signal: request.signal,
            onStart(meta: {
              model: string;
              sampleRate: number;
              responseFormat: "pcm";
              voice: string;
            }) {
              send({
                type: "start",
                ...meta,
              });
            },
            onAudioChunk(delta: string) {
              send({
                type: "audio",
                delta,
              });
            },
            onComplete() {
              send({
                type: "done",
              });
            },
          };

          if (canUseVolcengineTtsV3()) {
            await streamVolcengineTtsV3(payload, commonHandlers);
          } else if (canUseQwenRealtimeTts()) {
            await streamQwenRealtimeTts(payload, {
              ...commonHandlers,
              onDebugEvent(event) {
                trace.push(event.type);
                console.info("[ai.tts.realtime.event]", {
                  type: event.type,
                });
              },
            });
          } else {
            throw new Error("realtime tts is not configured");
          }
        } catch (error) {
          console.error("[ai.tts.realtime.error]", {
            message:
              error instanceof Error ? error.message : "realtime tts request failed",
            trace,
          });
          send({
            type: "error",
            message:
              error instanceof Error ? error.message : "realtime tts request failed",
          });
        } finally {
          close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
