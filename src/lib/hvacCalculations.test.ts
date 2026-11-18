import { describe, it, expect } from "vitest";
import { HVAC_CALCS, computeHvacCalc } from "./hvacCalculations";
const c = (id: string) => HVAC_CALCS.find((x) => x.id === id)!;
describe("calculos AVAC", () => {
  it("sobreaquecimento util: evaporacao -2, saida 4 -> 6 K OK", () => {
    expect(computeHvacCalc(c("sh_util"), { t_saida_evap: "8", t_evap_util: "-2" })).toEqual({ value: 10, status: "ok" });
  });
  it("sobreaquecimento total: evaporacao 4, succao 14 -> 10 K OK", () => {
    expect(computeHvacCalc(c("sh_total"), { t_succao: "14", t_evap_total: "4" })).toEqual({ value: 10, status: "ok" });
  });
  it("evaporador: retorno 24, insuflacao 14 -> 10 K OK", () => {
    expect(computeHvacCalc(c("evap"), { t_retorno: "24", t_insuflacao: "14" })).toEqual({ value: 10, status: "ok" });
  });
  it("subarrefecimento 2 K e baixo, 9 K e alto", () => {
    expect(computeHvacCalc(c("subcool"), { t_descarga: "40", t_fim_cond: "38" })?.status).toBe("low");
    expect(computeHvacCalc(c("subcool"), { t_descarga: "49", t_fim_cond: "38" })?.status).toBe("high");
  });
  it("sem valores nao calcula", () => {
    expect(computeHvacCalc(c("cond"), { t_ar_saida_cond: "30" })).toBeNull();
  });
});
