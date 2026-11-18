export interface ChecklistItem {
  label: string;
  checked: boolean;
  observation: string;
}

export interface Measurement {
  parameter: string;
  value: string;
  unit: string;
  /** Equipment group for per-equipment measurements (e.g. "eq1", "eq2") */
  group?: string;
  /** User-added row: parameter and unit are editable */
  custom?: boolean;
  /** Stable id used by automatic calculations (HVAC) */
  key?: string;
  /** Block title the row belongs to (HVAC) */
  section?: string;
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
  { section: "Gerais", key: "t_exterior", parameter: "Temperatura exterior", value: "", unit: "°C" },
  { section: "Gerais", key: "caudal_ar", parameter: "Caudal de ar (evaporador)", value: "", unit: "m³/h" },
  { section: "Gerais", key: "tensao_nominal", parameter: "Tensão nominal (placa)", value: "", unit: "V" },
  { section: "Gerais", key: "potencia_nominal", parameter: "Potência nominal", value: "", unit: "kW" },
  { section: "Gerais", key: "refrigerante", parameter: "Refrigerante", value: "", unit: "" },
  { section: "Gerais", key: "carga_refrigerante", parameter: "Carga de refrigerante", value: "", unit: "kg" },
  { section: "Subarrefecimento", key: "p_alta", parameter: "Pressão de alta", value: "", unit: "bar" },
  { section: "Subarrefecimento", key: "t_descarga", parameter: "Temperatura de saturação (condensação, pela pressão de alta)", value: "", unit: "°C" },
  { section: "Subarrefecimento", key: "t_fim_cond", parameter: "Temperatura real da linha de líquido", value: "", unit: "°C" },
  { section: "Rendimento do condensador", key: "t_ar_entrada_cond", parameter: "Temperatura ar à entrada do condensador", value: "", unit: "°C" },
  { section: "Rendimento do condensador", key: "t_ar_saida_cond", parameter: "Temperatura ar à saída do condensador", value: "", unit: "°C" },
  { section: "Sobreaquecimento util", key: "p_baixa_util", parameter: "Pressão de baixa", value: "", unit: "bar" },
  { section: "Sobreaquecimento util", key: "t_evap_util", parameter: "Temperatura de evaporação", value: "", unit: "°C" },
  { section: "Sobreaquecimento util", key: "t_saida_evap", parameter: "Temperatura à saída do evaporador", value: "", unit: "°C" },
  { section: "Sobreaquecimento total", key: "p_baixa_total", parameter: "Pressão de baixa", value: "", unit: "bar" },
  { section: "Sobreaquecimento total", key: "t_evap_total", parameter: "Temperatura de evaporação", value: "", unit: "°C" },
  { section: "Sobreaquecimento total", key: "t_succao", parameter: "Temperatura linha de sucção (10 cm antes)", value: "", unit: "°C" },
  { section: "Rendimento do evaporador", key: "t_retorno", parameter: "Temperatura de retorno", value: "", unit: "°C" },
  { section: "Rendimento do evaporador", key: "t_insuflacao", parameter: "Temperatura de insuflação", value: "", unit: "°C" },
  { section: "Eletricas", key: "tensao", parameter: "Tensão de alimentação", value: "", unit: "V" },
  { section: "Eletricas", key: "i_compressor", parameter: "Corrente do compressor", value: "", unit: "A" },
  { section: "Eletricas", key: "i_ventilador", parameter: "Corrente do ventilador", value: "", unit: "A" },
  { section: "Eletricas", key: "consumo", parameter: "Consumo energético", value: "", unit: "kW" },
];

export const HVAC_GROUPS = ["eq1", "eq2"] as const;

export const buildHvacGroupedMeasurements = (): Measurement[] =>
  HVAC_GROUPS.flatMap((g) => hvacMeasurements.map((m) => ({ ...m, group: g })));

// === CCTV ===

export const cctvChecklist: ChecklistItem[] = [
  { label: "Verificacao do estado geral das camaras", checked: false, observation: "" },
  { label: "Inspecao de lentes e limpeza", checked: false, observation: "" },
  { label: "Verificacao do posicionamento e angulo das camaras", checked: false, observation: "" },
  { label: "Teste de qualidade de imagem (diurna e noturna)", checked: false, observation: "" },
  { label: "Verificacao do DVR/NVR (funcionamento e espaco em disco)", checked: false, observation: "" },
  { label: "Teste de gravacao e reproducao de imagens", checked: false, observation: "" },
  { label: "Verificacao de cabos e conexoes (coaxial/rede)", checked: false, observation: "" },
  { label: "Teste de alimentacao e fontes de energia", checked: false, observation: "" },
  { label: "Verificacao de conetividade de rede e acesso remoto", checked: false, observation: "" },
  { label: "Teste de detecao de movimento e alarmes", checked: false, observation: "" },
  { label: "Verificacao do software de gestao de video (VMS)", checked: false, observation: "" },
  { label: "Inspecao de caixas de protecao e suportes", checked: false, observation: "" },
];

export const cctvMeasurements: Measurement[] = [
  { parameter: "Numero total de camaras", value: "", unit: "" },
  { parameter: "Camaras operacionais", value: "", unit: "" },
  { parameter: "Camaras inoperacionais", value: "", unit: "" },
  { parameter: "Capacidade de disco do DVR/NVR", value: "", unit: "TB" },
  { parameter: "Espaco utilizado", value: "", unit: "%" },
  { parameter: "Dias de gravacao disponiveis", value: "", unit: "dias" },
  { parameter: "Resolucao de gravacao", value: "", unit: "MP" },
  { parameter: "Taxa de frames", value: "", unit: "fps" },
  { parameter: "Tensao de alimentacao", value: "", unit: "V" },
  { parameter: "Largura de banda utilizada", value: "", unit: "Mbps" },
];

// === GENERATOR (Grupo Gerador) ===

export interface GeneratorData {
  brand: string;
  model: string;
  serial_number: string;
  kva_power: string;
  fuel_type: string;
  hours_counter: string;
}

export const defaultGeneratorData: GeneratorData = {
  brand: "",
  model: "",
  serial_number: "",
  kva_power: "",
  fuel_type: "",
  hours_counter: "",
};

export const generatorMotorChecklist: ChecklistItem[] = [
  { label: "Verificacao do nivel e estado do oleo do motor", checked: false, observation: "" },
  { label: "Verificacao do nivel do liquido de refrigeracao", checked: false, observation: "" },
  { label: "Inspecao de correias", checked: false, observation: "" },
  { label: "Verificacao dos tubos e filtros/verificadores de refrigerante", checked: false, observation: "" },
  { label: "Inspecao/limpeza mangueiras e conexoes", checked: false, observation: "" },
  { label: "Verificacao de filtros de ar (limpeza/substituicao)", checked: false, observation: "" },
  { label: "Verificacao do filtro de combustivel", checked: false, observation: "" },
  { label: "Verificacao do sistema de escape", checked: false, observation: "" },
  { label: "Inspecao/verificacao de arranque (ligacao, fusiveis)", checked: false, observation: "" },
  { label: "Verificacao das valvulas e vedantes do refrigerante", checked: false, observation: "" },
  { label: "Inspecao/verificacao anti-vibradores (se aplicavel)", checked: false, observation: "" },
  { label: "Verificacao do nivel de combustivel no deposito", checked: false, observation: "" },
];

export const generatorMotorMeasurements: Measurement[] = [
  { parameter: "Pressao do oleo", value: "", unit: "bar" },
  { parameter: "Tensao da bateria", value: "", unit: "V" },
  { parameter: "Temperatura do motor", value: "", unit: "°C" },
  { parameter: "Temperatura do liquido de refrigeracao", value: "", unit: "°C" },
  { parameter: "RPM em vazio", value: "", unit: "RPM" },
  { parameter: "RPM em carga", value: "", unit: "RPM" },
  { parameter: "Temperatura dos gases de escape", value: "", unit: "°C" },
  { parameter: "Analise de fumos/emissoes", value: "", unit: "" },
  { parameter: "Consumo de combustivel (estimado)", value: "", unit: "l/h" },
  { parameter: "Horas de funcionamento", value: "", unit: "h" },
];

export const generatorElectricalChecklist: ChecklistItem[] = [
  { label: "Verificacao do painel de controlo das baterias de arranque", checked: false, observation: "" },
  { label: "Verificacao das ligacoes eletricas do painel", checked: false, observation: "" },
  { label: "Verificacao dos switches e modo de operacao", checked: false, observation: "" },
  { label: "Teste de carregador de bateria", checked: false, observation: "" },
  { label: "Verificacao de proteccoes e configuracao da tensao", checked: false, observation: "" },
  { label: "Inspecao quadro/interruptor automatico corrente (QTA)", checked: false, observation: "" },
  { label: "Verificacao das proteccoes eletricas (disjuntores, fusiveis)", checked: false, observation: "" },
  { label: "Inspecao cablagem / quadro(s) pratica", checked: false, observation: "" },
  { label: "Verificacao de envolturas de ligacao/terra", checked: false, observation: "" },
  { label: "Teste de programas de emergencia", checked: false, observation: "" },
  { label: "Verificacao do controlador automatico (se aplicavel)", checked: false, observation: "" },
];

export const generatorElectricalMeasurements: Measurement[] = [
  { parameter: "Tensao L1-N", value: "", unit: "V" },
  { parameter: "Tensao L1-L2", value: "", unit: "V" },
  { parameter: "Tensao L2-L3", value: "", unit: "V" },
  { parameter: "Corrente L1", value: "", unit: "A" },
  { parameter: "Corrente L2", value: "", unit: "A" },
  { parameter: "Corrente L3", value: "", unit: "A" },
  { parameter: "Frequencia", value: "", unit: "Hz" },
  { parameter: "Potencia aparente", value: "", unit: "kVA" },
  { parameter: "Fator de potencia", value: "", unit: "" },
  { parameter: "Resistencia de isolamento", value: "", unit: "MΩ" },
  { parameter: "Resistencia de terra", value: "", unit: "Ω" },
  { parameter: "Temperatura do alternador", value: "", unit: "°C" },
];
