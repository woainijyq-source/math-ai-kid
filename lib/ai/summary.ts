import { postGatewayJson } from "@/lib/ai/gateway";
import { isSummaryResponsePayload } from "@/lib/ai/validators";
import type { SummaryResponsePayload } from "@/types";

export async function runSummary(): Promise<SummaryResponsePayload> {
  const response = await postGatewayJson<SummaryResponsePayload>("summary", {});

  if (response && isSummaryResponsePayload(response)) {
    return response;
  }

  return {
    dailySummary: "今天完成了一次互动，孩子表现积极。",
    strengthSignals: ["愿意先观察再行动"],
    stuckSignals: ["长文本输入耐心有限"],
    nextSuggestion: "继续短回合互动，观察参与度。",
    recentHighlights: ["孩子在关键选择前有短暂思考。"],
  };
}
