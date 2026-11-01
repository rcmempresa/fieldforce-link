import { describe, it, expect } from "vitest";
import { daysOpen, daysOpenLabel, isOpenStatus, daysOpenBadgeClass } from "./daysOpenWorkOrder";

const NOW = new Date(2026, 10, 1, 14, 0); // 1 Nov 2026, 14:00 local

describe("daysOpen", () => {
  it("conta 0 dias para uma OT criada hoje, mesmo de manhã", () => {
    expect(daysOpen(new Date(2026, 10, 1, 8, 30).toISOString(), NOW)).toBe(0);
  });

  it("conta dias de calendário completos desde a criação", () => {
    expect(daysOpen(new Date(2026, 9, 25, 23, 59).toISOString(), NOW)).toBe(7);
    expect(daysOpen(new Date(2026, 9, 1, 10, 0).toISOString(), NOW)).toBe(31);
  });

  it("nunca devolve valores negativos e tolera datas inválidas", () => {
    expect(daysOpen(new Date(2026, 10, 5).toISOString(), NOW)).toBe(0);
    expect(daysOpen("lixo", NOW)).toBe(0);
    expect(daysOpen(null, NOW)).toBe(0);
  });
});

describe("daysOpenLabel", () => {
  it("usa 'Aberta hoje', 'Há 1 dia' e 'Há X dias'", () => {
    expect(daysOpenLabel(new Date(2026, 10, 1, 9, 0).toISOString(), NOW)).toBe("Aberta hoje");
    expect(daysOpenLabel(new Date(2026, 9, 31, 18, 0).toISOString(), NOW)).toBe("Há 1 dia");
    expect(daysOpenLabel(new Date(2026, 9, 20).toISOString(), NOW)).toBe("Há 12 dias");
  });
});

describe("isOpenStatus", () => {
  it("esconde o contador em OTs concluídas, canceladas e faturadas", () => {
    expect(isOpenStatus("completed")).toBe(false);
    expect(isOpenStatus("cancelled")).toBe(false);
    expect(isOpenStatus("invoiced")).toBe(false);
    expect(isOpenStatus("pending")).toBe(true);
    expect(isOpenStatus("in_progress")).toBe(true);
    expect(isOpenStatus("awaiting_approval")).toBe(true);
  });
});

describe("daysOpenBadgeClass", () => {
  it("fica âmbar a partir de 7 dias e vermelho a partir de 14", () => {
    expect(daysOpenBadgeClass(new Date(2026, 9, 20).toISOString(), NOW)).toContain("amber"); // 12 dias
    expect(daysOpenBadgeClass(new Date(2026, 9, 10).toISOString(), NOW)).toContain("destructive"); // 22 dias
    expect(daysOpenBadgeClass(new Date(2026, 9, 30).toISOString(), NOW)).toContain("muted"); // 2 dias
  });
});
