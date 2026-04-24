const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

function readSseEvents(raw) {
  return raw
    .split("\n\n")
    .map((block) => {
      const eventLine = block
        .split("\n")
        .find((line) => line.startsWith("event: "));
      const dataLine = block
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!eventLine || !dataLine) {
        return null;
      }

      return {
        event: eventLine.slice(7).trim(),
        data: JSON.parse(dataLine.slice(6)),
      };
    })
    .filter(Boolean);
}

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

  return payload;
}

async function assertSse(path, init, validate) {
  const response = await ensureOk(path, init);
  const payload = readSseEvents(await response.text());
  validate(payload, response);
  console.log(`sse ok ${path}`);

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const pages = [
    "/",
    "/session",
    "/rewards",
    "/parent",
    "/parent/settings",
    "/playtest",
  ];

  for (const page of pages) {
    await assertPage(page);
  }

  const smokeProfile = {
    id: `smoke-profile-${Date.now()}`,
    nickname: "SmokeKid",
    birthday: "2018-01-01",
    goalPreferences: ["math-thinking"],
  };

  const startEvents = await assertSse(
    "/api/agent/start",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: smokeProfile.id,
        goalFocus: ["math-thinking"],
        profile: smokeProfile,
      }),
    },
    (events, response) => {
      assert(response.headers.get("content-type")?.includes("text/event-stream"), "agent start is not SSE");
      assert(events.some((event) => event?.event === "session_start"), "missing session_start event");
      assert(events.some((event) => event?.event === "tool_call"), "missing tool_call event");
      assert(events.some((event) => event?.event === "turn_end"), "missing turn_end event");
    },
  );

  const sessionStart = startEvents.find((event) => event.event === "session_start")?.data;
  const sessionId = sessionStart?.sessionId;
  assert(typeof sessionId === "string" && sessionId.length > 0, "missing sessionId from agent start");

  await assertSse(
    "/api/agent/turn",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        input: "我觉得是红色，因为前面是红黄红黄。",
        inputType: "text",
        turnIndex: 1,
        goalFocus: ["math-thinking"],
        profile: smokeProfile,
        conversation: [
          { role: "user", content: "你好，开始吧" },
          {
            role: "assistant",
            toolCalls: startEvents
              .filter((event) => event.event === "tool_call")
              .map((event) => event.data.toolCall),
          },
          { role: "user", content: "我觉得是红色，因为前面是红黄红黄。" },
        ],
      }),
    },
    (events, response) => {
      assert(response.headers.get("content-type")?.includes("text/event-stream"), "agent turn is not SSE");
      assert(events.some((event) => event?.event === "tool_call"), "missing turn tool_call event");
      assert(events.some((event) => event?.event === "turn_end"), "missing turn_end event");
    },
  );

  await assertJson(
    `/api/parent/report?profileId=${encodeURIComponent(smokeProfile.id)}`,
    { method: "GET" },
    (payload) => {
      assert(Array.isArray(payload.skills), "parent report skills missing");
      assert(Array.isArray(payload.recent), "parent report recent missing");
      assert(Array.isArray(payload.activitySessions), "parent report activitySessions missing");
      assert(Array.isArray(payload.experimentalActivitySessions), "parent report experimentalActivitySessions missing");
    },
  );

  await assertJson(
    "/api/parent/settings",
    { method: "GET" },
    (payload) => {
      assert(typeof payload.voice === "string" && payload.voice.length > 0, "parent settings voice missing");
    },
  );

  await assertJson(
    "/api/parent/settings",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice: "Moon" }),
    },
    (payload) => {
      assert(payload.ok === true, "parent settings update failed");
      assert(payload.voice === "Moon", "parent settings voice not updated");
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
      assert(typeof payload.transcript === "string", "stt transcript missing");
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
