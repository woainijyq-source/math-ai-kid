const baseUrl = process.env.AI_GATEWAY_URL;
const token = process.env.AI_GATEWAY_TOKEN;

if (!baseUrl) {
  console.error("Missing AI_GATEWAY_URL");
  process.exit(1);
}

function buildHeaders(extra = {}) {
  const headers = {
    "X-BrainPlay-Source": "brainplay-web-prototype",
    ...extra,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateChat(value) {
  assert(isObject(value), "chat response must be an object");
  assert(Array.isArray(value.messages), "chat.messages must be an array");
  assert(isObject(value.sessionPatch), "chat.sessionPatch must be an object");
  assert(isObject(value.worldPatch), "chat.worldPatch must be an object");
  assert(Array.isArray(value.rewardSignals), "chat.rewardSignals must be an array");
}

function validateStt(value) {
  assert(isObject(value), "stt response must be an object");
  assert(typeof value.transcript === "string", "stt.transcript must be a string");
  assert(typeof value.confidence === "number", "stt.confidence must be a number");
}

function validateSummary(value) {
  assert(isObject(value), "summary response must be an object");
  assert(typeof value.dailySummary === "string", "summary.dailySummary must be a string");
  assert(isStringArray(value.strengthSignals), "summary.strengthSignals must be a string array");
  assert(isStringArray(value.stuckSignals), "summary.stuckSignals must be a string array");
  assert(typeof value.nextSuggestion === "string", "summary.nextSuggestion must be a string");
  assert(isStringArray(value.recentHighlights), "summary.recentHighlights must be a string array");
}

function validateTts(value) {
  assert(isObject(value), "tts response must be an object");
  assert(typeof value.text === "string", "tts.text must be a string");
  assert(typeof value.voiceRole === "string", "tts.voiceRole must be a string");
}

function validateVision(value) {
  assert(isObject(value), "vision response must be an object");
  assert(typeof value.description === "string", "vision.description must be a string");
}

async function postJson(path, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  assert(response.ok, `${path} failed with ${response.status}`);
  return response.json();
}

async function postForm(path, formData) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: buildHeaders(),
    body: formData,
  });

  assert(response.ok, `${path} failed with ${response.status}`);
  return response.json();
}

async function main() {
  const chatPayload = {
    mode: "opponent",
    taskId: "opponent",
    action: "take-1",
    message: "我先拿 1 颗。",
    session: {
      taskId: "opponent",
      mode: "opponent",
      stage: 0,
      status: "active",
      progress: 0,
      completion: "准备开始。",
      messages: [],
      meta: { remaining: 7, winner: "pending" },
    },
  };

  validateChat(await postJson("/chat", chatPayload));
  console.log("gateway ok /chat");

  const summaryPayload = {};
  validateSummary(await postJson("/summary", summaryPayload));
  console.log("gateway ok /summary");

  validateTts(
    await postJson("/tts", {
      text: "轮到你选了。",
      voiceRole: "guide",
      speakerName: "月石引导者",
    }),
  );
  console.log("gateway ok /tts");

  const sttForm = new FormData();
  sttForm.set("mode", "opponent");
  sttForm.set("audio", new Blob(["mock audio"], { type: "audio/webm" }), "sample.webm");
  validateStt(await postForm("/stt", sttForm));
  console.log("gateway ok /stt");

  const visionForm = new FormData();
  visionForm.set("mode", "story");
  visionForm.set("image", new Blob(["mock image"], { type: "image/png" }), "sample.png");
  validateVision(await postForm("/vision", visionForm));
  console.log("gateway ok /vision");

  console.log("gateway check passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
