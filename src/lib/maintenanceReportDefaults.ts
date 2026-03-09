export interface ChecklistItem {
  label: string;
  checked: boolean;
  observation: string;
}

export interface Measurement {
  parameter: string;
  value: string;
  unit: string;
}

export interface Material {
  description: string;
  quantity: string;
  unit: string;
}

export const electricityChecklist: ChecklistItem[] = [
  { label: "Verificação do quadro elétrico geral", checked: false, observation: "" },
  { label: "Inspeção de cabos e ligações", checked: false, observation: "" },
  { label: "Teste de disjuntores e fusíveis", checked: false, observation: "" },
  { label: "Verificação de terra e proteção diferencial", checked: false, observation: "" },
  { label: "Medição do isolamento de cabos", checked: false, observation: "" },
  { label: "Inspeção de tomadas e interruptores", checked: false, observation: "" },
  { label: "Verificação de iluminação de emergência", checked: false, observation: "" },
  { label: "Teste de UPS / nobreak", checked: false, observation: "" },
  { label: "Verificação de contactores e relés", checked: false, observation: "" },
  { label: "Termografia de pontos quentes", checked: false, observation: "" },
];

export const electricityMeasurements: Measurement[] = [
  { parameter: "Tensão L1-N", value: "", unit: "V" },
  { parameter: "Tensão L2-N", value: "", unit: "V" },
  { parameter: "Tensão L3-N", value: "", unit: "V" },
  { parameter: "Corrente L1", value: "", unit: "A" },
  { parameter: "Corrente L2", value: "", unit: "A" },
  { parameter: "Corrente L3", value: "", unit: "A" },
  { parameter: "Resistência de terra", value: "", unit: "Ω" },
  { parameter: "Isolamento de cabos", value: "", unit: "MΩ" },
  { parameter: "Fator de potência", value: "", unit: "" },
  { parameter: "Potência ativa total", value: "", unit: "kW" },
];

export const hvacChecklist: ChecklistItem[] = [
  { label: "Verificação do compressor", checked: false, observation: "" },
  { label: "Inspeção de filtros de ar", checked: false, observation: "" },
  { label: "Verificação de nível de refrigerante", checked: false, observation: "" },
  { label: "Teste de termóstato", checked: false, observation: "" },
  { label: "Inspeção de condutas de ar", checked: false, observation: "" },
  { label: "Verificação de ventiladores", checked: false, observation: "" },
  { label: "Teste de drenagem de condensados", checked: false, observation: "" },
  { label: "Inspeção de válvulas de expansão", checked: false, observation: "" },
  { label: "Verificação de pressões do sistema", checked: false, observation: "" },
  { label: "Teste de controlo de temperatura", checked: false, observation: "" },
];

export const hvacMeasurements: Measurement[] = [
  { parameter: "Temperatura de insuflação", value: "", unit: "°C" },
  { parameter: "Temperatura de retorno", value: "", unit: "°C" },
  { parameter: "Pressão alta", value: "", unit: "bar" },
  { parameter: "Pressão baixa", value: "", unit: "bar" },
  { parameter: "Temperatura exterior", value: "", unit: "°C" },
  { parameter: "Humidade relativa", value: "", unit: "%" },
  { parameter: "Caudal de ar", value: "", unit: "m³/h" },
  { parameter: "Consumo energético", value: "", unit: "kW" },
];
