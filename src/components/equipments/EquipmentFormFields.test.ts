import { describe, expect, it } from "vitest";
import {
  emptyEquipmentForm,
  equipmentPayload,
  parseManufactureYear,
  type EquipmentFormData,
} from "./EquipmentFormFields";

const form = (over: Partial<EquipmentFormData>): EquipmentFormData => ({
  ...emptyEquipmentForm,
  name: "Maquina de lavar copos",
  ...over,
});

describe("ano de fabrico do equipamento", () => {
  it("guarda o ano escrito como número", () => {
    expect(parseManufactureYear("2019")).toBe(2019);
    expect(equipmentPayload(form({ manufacture_year: "2019" })).manufacture_year).toBe(2019);
  });

  it("deixa o ano vazio quando não é escrito", () => {
    expect(parseManufactureYear("")).toBeNull();
    expect(equipmentPayload(form({ manufacture_year: "" })).manufacture_year).toBeNull();
  });

  it("recusa anos fora do intervalo válido", () => {
    expect(parseManufactureYear("1899")).toBeNull();
    expect(parseManufactureYear("2101")).toBeNull();
    expect(parseManufactureYear("abc")).toBeNull();
  });
});
