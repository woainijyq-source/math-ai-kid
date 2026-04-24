import type { DailyQuestion } from "@/types/daily";

function stripNarratorLead(text: string) {
  const trimmed = text.trim();
  const colonIndex = trimmed.indexOf("：");
  if (colonIndex >= 0 && colonIndex < trimmed.length - 1) {
    return trimmed.slice(colonIndex + 1).trim();
  }
  return trimmed;
}

export function buildBrainySceneSetup(question: DailyQuestion) {
  return question.sceneSetup.trim();
}

export function buildBrainySceneVoice(question: DailyQuestion) {
  const spoken = stripNarratorLead(question.sceneDetail);
  return `脑脑轻轻说：${spoken}`;
}

export function buildBrainySceneReason(question: DailyQuestion) {
  const reason = stripNarratorLead(question.hook);
  return `脑脑心里想：${reason}`;
}
