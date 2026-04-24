/**
 * T3.12 — /session 页面（支持 goal / theme / question 参数）
 * Next.js 15+ server component，searchParams 是 Promise。
 */
import { SessionPage } from "@/components/agent/session-page";
import { getDailyQuestion } from "@/lib/daily/select-daily-question";
import { getThemeGoalMapping } from "@/lib/daily/theme-goal-mapping";
import type { DailyThemeId } from "@/types/daily";

export default async function SessionRoute({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string; theme?: string; question?: string }>;
}) {
  const params = await searchParams;
  const question = getDailyQuestion(params.question);
  const requestedTheme = params.theme as DailyThemeId | undefined;
  const fallbackMapping = getThemeGoalMapping(question?.themeId ?? requestedTheme, {
    progressionStageId: question?.progressionStageId,
  });
  const initialGoal = params.goal ?? question?.goalId ?? fallbackMapping?.goalId;
  const initialThemeId = question?.themeId ?? requestedTheme;
  const initialQuestionId = question?.id;

  return (
    <SessionPage
      initialGoal={initialGoal}
      initialThemeId={initialThemeId}
      initialQuestionId={initialQuestionId}
    />
  );
}
