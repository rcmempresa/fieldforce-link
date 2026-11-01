import { describe, it, expect } from "vitest";
import { equipmentModelKey, parseCauses } from "./equipmentModelKey";

describe("equipmentModelKey", () => {
  it("same model with different spacing/case shares the key", () => {
    expect(equipmentModelKey(" Daikin ", "FTXM  35R")).toEqual(equipmentModelKey("daikin", "ftxm 35r"));
  });
  it("no model means no shared knowledge", () => {
    expect(equipmentModelKey("Daikin", "  ")).toBeNull();
  });
  it("splits causes by line or semicolon", () => {
    expect(parseCauses("termostato de seguranca ativo;\nresistencia fundida")).toEqual([
      "termostato de seguranca ativo",
      "resistencia fundida",
    ]);
  });
});
