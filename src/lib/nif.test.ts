import { describe, it, expect } from "vitest";
import { isValidNif, normalizeNif } from "./nif";

describe("NIF", () => {
  it("aceita 9 digitos, com espacos", () => {
    expect(isValidNif("123 456 789")).toBe(true);
    expect(normalizeNif("123 456 789")).toBe("123456789");
  });
  it("rejeita tamanho errado ou letras", () => {
    expect(isValidNif("12345678")).toBe(false);
    expect(isValidNif("12345678A")).toBe(false);
  });
  it("vazio e opcional", () => {
    expect(isValidNif("")).toBe(true);
    expect(normalizeNif("  ")).toBeNull();
  });
});
