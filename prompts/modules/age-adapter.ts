/**
 * age-adapter.ts
 */

/**
 * Calculate current age in years from birthday string.
 */
export function calcAge(birthday: string): number {
  return calcAgeDetailed(birthday).years;
}

/**
 * Calculate current age with year and month precision.
 */
export function calcAgeDetailed(birthday: string): { years: number; months: number } {
  const birth = new Date(birthday);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months) };
}

export type AgeInteractionBand =
  | "early_child"
  | "younger_kid"
  | "middle_kid"
  | "older_kid";

export function getAgeInteractionBandFromAge(age: number): AgeInteractionBand {
  if (age <= 6) return "early_child";
  if (age <= 8) return "younger_kid";
  if (age <= 10) return "middle_kid";
  return "older_kid";
}

export function getAgeInteractionBand(birthday: string): AgeInteractionBand {
  return getAgeInteractionBandFromAge(calcAge(birthday));
}

export function getAgeInteractionRules(birthday: string): string[] {
  switch (getAgeInteractionBand(birthday)) {
    case "early_child":
      return [
        "Keep prompts warm, concrete, and one-step at a time.",
        "Use obvious visual change words like bigger, smaller, turn, repeat.",
        "Do not overload the child with multiple repair questions at once.",
      ];
    case "younger_kid":
      return [
        "Stay playful, but keep the repair goal explicit.",
        "Use simple rule words such as repeat, add, minus, turn.",
        "A short sentence frame is acceptable when the child gets stuck.",
      ];
    case "middle_kid":
      return [
        "Use more direct language and less nursery-style reassurance.",
        "It is acceptable to name the rule type clearly and ask for one precise reason.",
        "Prefer concise follow-up over excessive praise or roleplay.",
      ];
    case "older_kid":
    default:
      return [
        "Use concise, respectful wording and avoid babyish praise.",
        "Ask for a clean reason, pattern rule, or rebuttal without pretending confusion.",
        "Keep scaffolds lean: one pointed hint or one pointed repair question at a time.",
      ];
  }
}

export function ageAdapterModule(birthday: string): string {
  const { years, months } = calcAgeDetailed(birthday);

  let rules: string;
  if (years <= 6) {
    rules = `- Speak in very short sentences.
- Use concrete objects and visible changes.
- Keep choices to 2-3 options.
- Keep arithmetic within 10 and keep patterns very short.
- Encourage more than challenge.`;
  } else if (years <= 8) {
    rules = `- Language can stay playful, but the task should no longer stay in beginner-only arithmetic.
- Use short number patterns, color or shape alternation, and simple compare-and-explain prompts.
- It is acceptable to use values beyond 10 when the rule is still clear.
- Ask for one short why-sentence after the answer.`;
  } else if (years <= 10) {
    rules = `- Use longer sequences, mixed repetition, and simple spatial turns.
- Do not default to only +2 or -2 patterns.
- Allow multi-step pattern noticing and short defense of why another answer is wrong.
- Accept short child phrasing as valid reasoning evidence.`;
  } else {
    rules = `- Use more abstract and less repetitive pattern tasks.
- It is acceptable to use L3-L4 style pattern variation, transfer, and contrastive reasoning.
- Ask for explanation or rebuttal, not just answer selection.`;
  }

  const ageDisplay = months > 0 ? `${years}岁${months}个月` : `${years}岁`;
  return `## Age Adaptation Rules (child age: ${ageDisplay})
${rules}`;
}
