import { describe, expect, it } from "vitest";
import { calculateEventCharge, findEventPricingRule, validateChildAgeRanges, type EventPricingRuleInput } from "@/lib/event-pricing";

const childRules: EventPricingRuleInput[] = [
  { attendeeType: "child", label: "Até 5 anos", ageMin: 0, ageMax: 5, chargeMode: "free", amount: 0 },
  { attendeeType: "child", label: "De 6 a 11 anos", ageMin: 6, ageMax: 11, chargeMode: "half", amount: 0 },
];

describe("Cobrança por evento", () => {
  it("considera os limites etários inclusivos", () => {
    expect(findEventPricingRule(childRules, "child", 5)?.label).toBe("Até 5 anos");
    expect(findEventPricingRule(childRules, "child", 6)?.label).toBe("De 6 a 11 anos");
    expect(findEventPricingRule(childRules, "child", 11)?.label).toBe("De 6 a 11 anos");
  });
  it("não seleciona faixa infantil para idade ausente ou fora das regras", () => {
    expect(findEventPricingRule(childRules, "child", null)).toBeNull();
    expect(findEventPricingRule(childRules, "child", 12)).toBeNull();
  });
  it("calcula gratuidade, meia cota, valor fixo e cota padrão", () => {
    expect(calculateEventCharge({ attendeeType: "child", label: "free", chargeMode: "free", amount: 0 }, 100)).toBe(0);
    expect(calculateEventCharge({ attendeeType: "child", label: "half", chargeMode: "half", amount: 0 }, 101)).toBe(50.5);
    expect(calculateEventCharge({ attendeeType: "individual", label: "fixed", chargeMode: "fixed", amount: 37.5 }, 100)).toBe(37.5);
    expect(calculateEventCharge({ attendeeType: "couple", label: "standard", chargeMode: "standard", amount: 0 }, 100)).toBe(100);
  });
  it("detecta faixas infantis sobrepostas", () => {
    expect(validateChildAgeRanges([...childRules, { ...childRules[1], label: "Outra faixa", ageMin: 5, ageMax: 8 }])).toHaveLength(1);
  });
  it("aceita faixas contíguas sem sobreposição", () => {
    expect(validateChildAgeRanges(childRules)).toEqual([]);
  });
  it("ignora regras desativadas na busca e na validação", () => {
    const disabled = { ...childRules[0], active: false };
    expect(findEventPricingRule([disabled], "child", 3)).toBeNull();
    expect(validateChildAgeRanges([disabled, ...childRules.slice(1)])).toEqual([]);
  });
});
