import { describe, it, expect } from "vitest";
import { normalizeSearch, matchesSearch } from "./searchText";

describe("normalizeSearch", () => {
  it("tira acentos e passa a minúsculas", () => {
    expect(normalizeSearch("Filtro de Ar")).toBe("filtro de ar");
    expect(normalizeSearch("Refrigeração & Congelação")).toBe(
      "refrigeracao & congelacao",
    );
    expect(normalizeSearch(null)).toBe("");
  });
});

describe("matchesSearch", () => {
  const fields = ["Filtro de Ar", "12345", "Unidade(s)"];

  it("aceita a pesquisa sem acentos", () => {
    expect(matchesSearch(["Refrigeração", null], "refrigeracao")).toBe(true);
  });

  it("encontra pelo número de referência", () => {
    expect(matchesSearch(fields, "1234")).toBe(true);
    expect(matchesSearch(fields, "9999")).toBe(false);
  });

  it("exige todas as palavras, sem depender da ordem", () => {
    expect(matchesSearch(fields, "filt ar")).toBe(true);
    expect(matchesSearch(fields, "ar filt")).toBe(true);
    expect(matchesSearch(fields, "filtro parafuso")).toBe(false);
  });

  it("lista tudo quando a pesquisa está vazia", () => {
    expect(matchesSearch(fields, "   ")).toBe(true);
    expect(matchesSearch([], "qualquer coisa")).toBe(false);
  });
});
