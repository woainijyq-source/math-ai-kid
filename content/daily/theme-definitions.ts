import type { DailyThemeDefinition, DailyThemeId } from "@/types/daily";

export const DAILY_THEME_DEFINITIONS: DailyThemeDefinition[] = [
  {
    id: "math",
    label: "数学思维",
    shortLabel: "数学",
    icon: "/illustrations/icons/math-thinking.png",
    summary: "分一分、比一比、猜下一步。",
    accentClass: "border-emerald-300 bg-emerald-50 text-emerald-800",
    softClass: "from-emerald-100 to-teal-50",
  },
  {
    id: "pattern",
    label: "观察规律",
    shortLabel: "规律",
    icon: "/illustrations/icons/observation-induction.png",
    summary: "看看什么在变，什么在重复。",
    accentClass: "border-sky-300 bg-sky-50 text-sky-800",
    softClass: "from-sky-100 to-cyan-50",
  },
  {
    id: "why",
    label: "为什么与解释",
    shortLabel: "为什么",
    icon: "/illustrations/icons/language-thinking.png",
    summary: "把“为什么”说清楚一点点。",
    accentClass: "border-violet-300 bg-violet-50 text-violet-800",
    softClass: "from-violet-100 to-fuchsia-50",
  },
  {
    id: "fairness",
    label: "公平与选择",
    shortLabel: "公平",
    icon: "/illustrations/icons/creative-thinking.png",
    summary: "想想怎样更公平、更合理。",
    accentClass: "border-amber-300 bg-amber-50 text-amber-800",
    softClass: "from-amber-100 to-orange-50",
  },
  {
    id: "what-if",
    label: "假设与预测",
    shortLabel: "如果",
    icon: "/illustrations/icons/strategy-thinking.png",
    summary: "如果换一下，会发生什么？",
    accentClass: "border-rose-300 bg-rose-50 text-rose-800",
    softClass: "from-rose-100 to-pink-50",
  },
];

export const DAILY_THEME_MAP = new Map<DailyThemeId, DailyThemeDefinition>(
  DAILY_THEME_DEFINITIONS.map((theme) => [theme.id, theme]),
);

export function getDailyThemeDefinition(themeId: DailyThemeId | undefined) {
  return themeId ? DAILY_THEME_MAP.get(themeId) : undefined;
}
