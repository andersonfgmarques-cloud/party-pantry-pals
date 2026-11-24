export type EventAttendeeType = "couple" | "individual" | "child" | "extra_guest";
export type EventChargeMode = "free" | "half" | "fixed" | "standard";
export type EventPricingRuleInput = {
  attendeeType: EventAttendeeType;
  label: string;
  ageMin?: number | null;
  ageMax?: number | null;
  chargeMode: EventChargeMode;
  amount: number;
  active?: boolean;
  sortOrder?: number;
};

export function findEventPricingRule(rules: EventPricingRuleInput[], attendeeType: EventAttendeeType, age?: number | null) {
  const eligible = rules
    .filter(rule => rule.active !== false && rule.attendeeType === attendeeType)
    .filter(rule => attendeeType !== "child" || (Number.isInteger(age) && age! >= (rule.ageMin ?? 0) && age! <= (rule.ageMax ?? 120)))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return eligible[0] ?? null;
}

export function calculateEventCharge(rule: EventPricingRuleInput, standardQuota: number): number {
  if (!Number.isFinite(standardQuota) || standardQuota < 0) throw new Error("A cota padrão deve ser um valor válido e não negativo.");
  if (!Number.isFinite(rule.amount) || rule.amount < 0) throw new Error("O valor da regra deve ser válido e não negativo.");
  switch (rule.chargeMode) {
    case "free": return 0;
    case "half": return Math.round((standardQuota / 2 + Number.EPSILON) * 100) / 100;
    case "fixed": return Math.round((rule.amount + Number.EPSILON) * 100) / 100;
    case "standard": return Math.round((standardQuota + Number.EPSILON) * 100) / 100;
  }
}

export function validateChildAgeRanges(rules: EventPricingRuleInput[]): string[] {
  const children = rules.filter(rule => rule.active !== false && rule.attendeeType === "child")
    .slice().sort((a, b) => (a.ageMin ?? -1) - (b.ageMin ?? -1));
  const errors: string[] = [];
  for (const rule of children) {
    if (!Number.isInteger(rule.ageMin) || !Number.isInteger(rule.ageMax) || rule.ageMin! < 0 || rule.ageMax! > 120 || rule.ageMax! < rule.ageMin!) {
      errors.push(`Faixa etária inválida: ${rule.label}.`);
    }
  }
  for (let i = 1; i < children.length; i++) {
    const current = children[i];
    const previous = children[i - 1];
    if (!current || !previous) continue;
    if ((current.ageMin ?? -1) <= (previous.ageMax ?? -1)) {
      errors.push(`As faixas infantis "${previous.label}" e "${current.label}" se sobrepõem.`);
    }
  }
  return errors;
}
