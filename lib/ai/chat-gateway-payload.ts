import { getCoCreateScene, getOpponentScene } from "@/content/scenes";
import { getStoryEpisode, getStoryEpisodeKernel } from "@/content/story-episodes";
import { buildPromptPack } from "@/prompts/chat";
import type { ChatRequestPayload, StoryOptionSeed } from "@/types";

function readStoryChoices(payload: ChatRequestPayload, fallback: StoryOptionSeed[]) {
  const raw = payload.session.meta.currentChoices;
  if (!Array.isArray(raw)) {
    return fallback;
  }

  const choices = raw.filter(
    (item): item is StoryOptionSeed =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      "label" in item &&
      "description" in item &&
      "mathMove" in item,
  );

  return choices.length > 0 ? choices : fallback;
}

export function buildChatGatewayPayload(payload: ChatRequestPayload) {
  if (payload.mode === "opponent") {
    const sceneId = String(payload.session.meta.sceneId ?? "");
    const scene = getOpponentScene(sceneId);
    const remaining = Number(payload.session.meta.remaining ?? 7);

    return {
      ...payload,
      runtimeContext: {
        promptPack: buildPromptPack(payload.mode),
        productIntent:
          "This is a math-thinking training game wrapped in a light duel. The AI must coach strategy through play, not just roleplay.",
        scene: {
          id: scene.id,
          title: scene.title,
          intro: scene.introSpeakable,
          hint: scene.hint,
        },
        mathKernel: {
          publicTitle: scene.learning.stageId,
          mathGoal: scene.learning.childGoal,
          skillFocus: scene.learning.skills,
          aiDirectorPrompt: scene.learning.aiExpansionPrompt,
          aiEvaluationFocus: [scene.learning.adultNote],
        },
        gameState: {
          remaining,
          allowedMoves: [
            {
              id: "take-1",
              label: scene.actionLabels.takeOne.label,
              description: scene.actionLabels.takeOne.description,
              userLine: scene.actionLabels.takeOne.userLine,
              mathMove: "observe the next remainder",
            },
            {
              id: "take-2",
              label: scene.actionLabels.takeTwo.label,
              description: scene.actionLabels.takeTwo.description,
              userLine: scene.actionLabels.takeTwo.userLine,
              mathMove: "push the count toward a favorable state",
            },
          ],
        },
        childState: {
          progress: payload.session.progress,
          stage: payload.session.stage,
          latestUserInput: payload.message,
          latestAction: payload.action ?? null,
          recentUserMessages: payload.session.messages
            .filter((message) => message.role === "user")
            .slice(-3)
            .map((message) => message.content),
        },
        responseRules: [
          "Respond like a short live challenge round, not a long explanation.",
          "Keep focus on count change, remainders, and strategy.",
          "Use 1 assistant message unless the round ends.",
          "If the player wins or loses, complete the round clearly.",
        ],
      },
    };
  }

  if (payload.mode === "co-create") {
    const sceneId = String(payload.session.meta.sceneId ?? "");
    const scene = getCoCreateScene(sceneId);
    const createdRule =
      typeof payload.session.meta.createdRule === "string"
        ? payload.session.meta.createdRule
        : "";

    return {
      ...payload,
      runtimeContext: {
        promptPack: buildPromptPack(payload.mode),
        productIntent:
          "This is a math-thinking co-creation game. The AI must help turn vague ideas into clear rules with conditions and consequences.",
        scene: {
          id: scene.id,
          title: scene.title,
          intro: scene.introSpeakable,
          hint: scene.hint,
        },
        mathKernel: {
          publicTitle: scene.learning.stageId,
          mathGoal: scene.learning.childGoal,
          skillFocus: scene.learning.skills,
          aiDirectorPrompt: scene.learning.aiExpansionPrompt,
          aiEvaluationFocus: [scene.learning.adultNote],
        },
        creationState: {
          starterRules: scene.starterRules,
          fragments: scene.fragments,
          submitLabel: scene.submitLabel,
          createdRule,
        },
        childState: {
          progress: payload.session.progress,
          stage: payload.session.stage,
          latestUserInput: payload.message,
          recentUserMessages: payload.session.messages
            .filter((message) => message.role === "user")
            .slice(-3)
            .map((message) => message.content),
        },
        responseRules: [
          "Treat the child input as a draft rule and refine it into a playable rule.",
          "Ask one useful follow-up or edge case question.",
          "Keep the tone playful, short, and concrete.",
          "Push for conditions, order, fairness, or consequences.",
        ],
      },
    };
  }

  const sceneId = String(payload.session.meta.sceneId ?? "");
  const episode = getStoryEpisode(sceneId);
  const kernel = getStoryEpisodeKernel(sceneId);
  const frameIndex = Number(payload.session.meta.frameIndex ?? 0);
  const frame = kernel.frames[Math.min(frameIndex, kernel.frames.length - 1)];
  const currentChoices = readStoryChoices(payload, frame.optionSeeds);
  const recentUserMessages = payload.session.messages
    .filter((message) => message.role === "user")
    .slice(-3)
    .map((message) => message.content);
  const carryover =
    typeof payload.session.meta.carryover === "string"
      ? payload.session.meta.carryover
      : "";

  return {
    ...payload,
    runtimeContext: {
      promptPack: buildPromptPack(payload.mode),
      productIntent:
        "This is a math-thinking training game wrapped in story form. The AI must push reasoning, not just narrate plot.",
      scene: {
        id: episode.id,
        title: episode.title,
        narratorName: episode.narratorName,
        sceneBackdrop: episode.sceneBackdrop,
        openingBeat: episode.openingBeat,
        worldLineLabel: episode.worldLineLabel,
        worldLineSummary: episode.worldLineSummary,
      },
      mathKernel: {
        id: kernel.id,
        title: kernel.title,
        publicTitle: kernel.publicTitle,
        mathGoal: kernel.mathGoal,
        childFacingHook: kernel.childFacingHook,
        skillFocus: kernel.skillFocus,
        successSignal: kernel.successSignal,
        aiDirectorPrompt: kernel.aiDirectorPrompt,
        aiEvaluationFocus: kernel.aiEvaluationFocus,
      },
      currentFrame: {
        index: frameIndex,
        id: frame.id,
        childPrompt: frame.childPrompt,
        directorNote: frame.directorNote,
        followUpQuestion: frame.followUpQuestion,
      },
      allowedChoices: currentChoices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        description: choice.description,
        mathMove: choice.mathMove,
      })),
      childState: {
        progress: payload.session.progress,
        stage: payload.session.stage,
        carryover,
        recentUserMessages,
        latestUserInput: payload.message,
      },
      responseRules: [
        "Stay inside the story shell, but keep the math-thinking task explicit in your reasoning.",
        "Do not turn the experience into a textbook explanation or quiz worksheet.",
        "Challenge the child to explain why, compare options, or predict consequences.",
        "Prefer short spoken lines suitable for TTS and a 7-year-old listener.",
        "Keep world changes tied to the child's reasoning move, not arbitrary plot twists.",
      ],
    },
  };
}
