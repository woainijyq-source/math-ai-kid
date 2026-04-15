const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

async function ensureOk(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }

  return response;
}

async function assertPage(path) {
  await ensureOk(path);
  console.log(`page ok ${path}`);
}

async function assertJson(path, init, validate) {
  const response = await ensureOk(path, init);
  const payload = await response.json();
  validate(payload);
  console.log(`api ok ${path}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const pages = [
    "/",
    "/play/opponent",
    "/play/co-create",
    "/play/story",
    "/play/result",
    "/rewards",
    "/parent",
    "/parent/settings",
  ];

  for (const page of pages) {
    await assertPage(page);
  }

  await assertJson(
    "/api/ai/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "opponent",
        taskId: "opponent",
        action: "take-1",
        message: "我先拿 1 颗",
        session: {
          taskId: "opponent",
          mode: "opponent",
          stage: 0,
          status: "active",
          progress: 0,
          completion: "准备开始",
          messages: [
            {
              id: "seed-user",
              role: "user",
              content: "我先拿 1 颗",
              intent: "challenge",
              hints: [],
            },
          ],
          meta: { remaining: 7, winner: "pending" },
        },
      }),
    },
    (payload) => {
      assert(Array.isArray(payload.messages) && payload.messages.length > 0, "chat messages missing");
      assert(typeof payload.sessionPatch?.progress === "number", "chat sessionPatch missing progress");
      assert(Array.isArray(payload.rewardSignals), "chat rewardSignals missing");
    },
  );

  await assertJson(
    "/api/progress/log",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "opponent",
        taskId: "opponent",
        title: "烟雾测试记录",
        completion: "完成了一次烟雾测试对手试玩。",
        highlights: ["测试脚本成功写入了一条试玩记录。"],
        rewardSignals: [
          {
            type: "world",
            title: "测试路标亮起",
            detail: "说明 SQLite 记录链路可用。",
          },
        ],
      }),
    },
    (payload) => {
      assert(payload.ok === true, "progress log failed");
    },
  );

  await assertJson(
    "/api/ai/summary",
    { method: "POST" },
    (payload) => {
      assert(typeof payload.dailySummary === "string" && payload.dailySummary.length > 0, "summary missing dailySummary");
      assert(Array.isArray(payload.recentHighlights), "summary missing recentHighlights");
    },
  );

  const sttForm = new FormData();
  sttForm.set("mode", "opponent");
  sttForm.set("audio", new Blob(["mock audio"], { type: "audio/webm" }), "sample.webm");
  await assertJson(
    "/api/ai/stt",
    {
      method: "POST",
      body: sttForm,
    },
    (payload) => {
      assert(typeof payload.transcript === "string" && payload.transcript.length > 0, "stt transcript missing");
      assert(typeof payload.confidence === "number", "stt confidence missing");
    },
  );

  await assertJson(
    "/api/ai/tts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "这是一次测试播报。",
        voiceRole: "guide",
        speakerName: "测试引导者",
      }),
    },
    (payload) => {
      assert(typeof payload.text === "string" && payload.text.length > 0, "tts text missing");
      assert(typeof payload.voiceRole === "string", "tts voiceRole missing");
    },
  );

  const visionForm = new FormData();
  visionForm.set("mode", "story");
  visionForm.set("image", new Blob(["mock image"], { type: "image/png" }), "sample.png");
  await assertJson(
    "/api/ai/vision",
    {
      method: "POST",
      body: visionForm,
    },
    (payload) => {
      assert(typeof payload.description === "string" && payload.description.length > 0, "vision description missing");
    },
  );

  console.log("smoke test passed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
