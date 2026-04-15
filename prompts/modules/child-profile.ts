/**
 * child-profile.ts — 孩子信息模块（~150 tokens）
 */

import type { ChildProfile } from "../../types/goals";
import { calcAgeDetailed } from "./age-adapter";

export function childProfileModule(profile: ChildProfile): string {
  const { years, months } = calcAgeDetailed(profile.birthday);
  const ageText = months > 0 ? `${years}岁${months}个月` : `${years}岁`;
  const recentObs = profile.recentObservations ?? [];

  let obsSection = "";
  if (recentObs.length > 0) {
    const top3 = recentObs.slice(0, 3);
    const lines = top3.map(
      (o) => `  - ${o.skill}：${o.observation}（置信度 ${Math.round(o.confidence * 100)}%）`,
    );
    obsSection = `\n\n近期观察记录：\n${lines.join("\n")}`;
  }

  return `## 孩子档案
- 昵称：${profile.nickname}
- 年龄：${ageText}
- 偏好方向：${profile.goalPreferences.length > 0 ? profile.goalPreferences.join("、") : "暂无偏好"}${obsSection}`;
}
