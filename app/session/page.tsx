/**
 * T3.12 — /session 页面（TA.5 — 支持 URL goal 参数）
 * Next.js 15+ server component，searchParams 是 Promise。
 */
import { SessionPage } from "@/components/agent/session-page";

export default async function SessionRoute({
  searchParams,
}: {
  searchParams: Promise<{ goal?: string }>;
}) {
  const params = await searchParams;
  return <SessionPage initialGoal={params.goal} />;
}
