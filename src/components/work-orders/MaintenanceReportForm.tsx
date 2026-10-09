import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportLogoPicker } from "./ReportLogoPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, FileDown, Plus, Trash2, Zap, Wind, Camera } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { equipmentLinkLabel, categoryForReport, matchesReportCategory, EQUIPMENT_CATEGORY_LABEL } from "@/lib/equipmentLabel";
import {
  ChecklistItem,
  Measurement,
  Material,
  electricityChecklist,
  electricityMeasurements,
  hvacChecklist,
  hvacMeasurements,
  cctvChecklist,
  cctvMeasurements,
  buildHvacGroupedMeasurements,
  HVAC_GROUPS,
} from "@/lib/maintenanceReportDefaults";
import {
  generateMaintenanceReportPDF,
  uploadMaintenanceReportPDF,
} from "@/lib/generateMaintenanceReportPDF";

interface Props {
  workOrderId: string;
  reportId: string | null;
  reportType: "electricity" | "hvac" | "cctv" | null;
  canEdit: boolean;
  onClose: () => void;
}

export function MaintenanceReportForm({ workOrderId, reportId, reportType, canEdit, onClose }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const techSigRef = useRef<SignatureCanvas>(null);
  const supSigRef = useRef<SignatureCanvas>(null);

  // Form state
  const [type, setType] = useState<"electricity" | "hvac" | "cctv">(reportType || "electricity");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [technicianName, setTechnicianName] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [building, setBuilding] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentSerial, setEquipmentSerial] = useState("");
  const [designation, setDesignation] = useState("");
  const [designationSerial, setDesignationSerial] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [generalObservations, setGeneralObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [nextMaintenance, setNextMaintenance] = useState("");
  const [approvedByName, setApprovedByName] = useState("");
  const [approvalDate, setApprovalDate] = useState("");
  const [techSignature, setTechSignature] = useState<string | null>(null);
  const [supSignature, setSupSignature] = useState<string | null>(null);
  const [status, setStatus] = useState("draft");
  const [woReference, setWoReference] = useState("");
  const [savedReportId, setSavedReportId] = useState(reportId);
  const [logo, setLogo] = useState<string | null>(null);
  const [woEquipments, setWoEquipments] = useState<Array<{ eq: any; part: string | null }>>([]);

  useEffect(() => {
    fetchWoReference();
    if (reportId) {
      loadReport();
    } else {
      initDefaults();
      loadCurrentUser();
    }
  }, [reportId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("work_order_equipments")
        .select("unit_part, equipments ( id, name, brand, model, serial_number, location, equipment_type, outdoor_model, outdoor_serial_number, category )")
        .eq("work_order_id", workOrderId);
      const list = (data || []).filter((r: any) => r.equipments).map((r: any) => ({ eq: r.equipments, part: r.unit_part }));
      setWoEquipments(list);
      // Auto-fill new report with equipment of the report's category
      const wanted = categoryForReport(reportType);
      const match = list.filter((l: any) => matchesReportCategory(l.eq.category, wanted));
      if (!reportId && match.length >= 1) applyEquipment(match[0], 1);
      if (!reportId && match.length === 2) applyEquipment(match[1], 2);
    })();
  }, [workOrderId]);

  const applyEquipment = ({ eq, part }: { eq: any; part: string | null }, slot: 1 | 2 = 1) => {
    const brandModel = (m: string | null) => [eq.brand, m].filter(Boolean).join(" ");
    const isAc = eq.equipment_type === "ac";
    const indoor = { n: `${eq.name}${isAc ? " - Unid. Interior" : ""} ${brandModel(eq.model)}`.trim(), s: eq.serial_number || "" };
    const outdoor = { n: `${eq.name} - Unid. Exterior ${brandModel(eq.outdoor_model)}`.trim(), s: eq.outdoor_serial_number || "" };
    const set1 = (v: { n: string; s: string }) => { setEquipmentName(v.n); setEquipmentSerial(v.s); };
    const set2 = (v: { n: string; s: string }) => { setDesignation(v.n); setDesignationSerial(v.s); };
    if (isAc && part !== "indoor" && part !== "outdoor") {
      // AC both units: indoor -> Equipamento 1, outdoor -> Equipamento 2
      set1(indoor); set2(outdoor);
    } else {
      const v = isAc && part === "outdoor" ? outdoor : indoor;
      slot === 1 ? set1(v) : set2(v);
    }
    if (eq.location && slot === 1) setSpecificLocation(eq.location);
  };

  const fetchWoReference = async () => {
    const { data } = await supabase
      .from("work_orders")
      .select("reference")
      .eq("id", workOrderId)
      .single();
    if (data) setWoReference(data.reference || "");
  };

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();
      if (profile) setTechnicianName(profile.name);
    }
  };

  const initDefaults = () => {
    const t = reportType || "electricity";
    setType(t);
    const checklistMap = { electricity: electricityChecklist, hvac: hvacChecklist, cctv: cctvChecklist };
    const measurementMap = { electricity: electricityMeasurements, hvac: hvacMeasurements, cctv: cctvMeasurements };
    setChecklist([...(checklistMap[t] || electricityChecklist)]);
    setMeasurements(t === "hvac" ? buildHvacGroupedMeasurements() : (measurementMap[t] || electricityMeasurements).map((m) => ({ ...m })));
  };

  const loadReport = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenance_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error || !data) {
      toast({ title: "Erro", description: "Erro ao carregar relatório", variant: "destructive" });
      onClose();
      return;
    }

    setType(data.report_type as any);
    setReportDate(data.report_date || "");
    setTechnicianName(data.technician_name || "");
    setTechnicianId(data.technician_id || "");
    setSupervisorName(data.supervisor_name || "");
    setStartTime(data.start_time || "");
    setEndTime(data.end_time || "");
    setBuilding(data.building || "");
    setFloorNumber(data.floor_number || "");
    setSpecificLocation(data.specific_location || "");
    setEquipmentName(data.equipment_name || "");
    setEquipmentSerial(data.equipment_serial || "");
    setDesignation(data.designation || "");
    setDesignationSerial(data.designation_serial || "");
    const storedChecklist = data.checklist_items as any;
    setChecklist(Array.isArray(storedChecklist) ? storedChecklist : storedChecklist?.items || []);
    setLogo(Array.isArray(storedChecklist) ? null : storedChecklist?.logo || null);
    setMeasurements((data.measurements as any) || []);
    setMaterials((data.materials as any) || []);
    setGeneralObservations(data.general_observations || "");
    setRecommendations(data.recommendations || "");
    setNextMaintenance(data.next_maintenance || "");
    setApprovedByName(data.approved_by_name || "");
    setApprovalDate(data.approval_date || "");
    setTechSignature(data.technician_signature || null);
    setSupSignature(data.supervisor_signature || null);
    setStatus(data.status || "draft");
    setLoading(false);
  };

  const getFormData = () => ({
    work_order_id: workOrderId,
    report_type: type,
    report_date: reportDate || null,
    technician_name: technicianName || null,
    technician_id: technicianId || null,
    supervisor_name: supervisorName || null,
    start_time: startTime || null,
    end_time: endTime || null,
    building: building || null,
    floor_number: floorNumber || null,
    specific_location: specificLocation || null,
    equipment_name: equipmentName || null,
    equipment_serial: equipmentSerial || null,
    designation: designation || null,
    designation_serial: designationSerial || null,
    checklist_items: { items: checklist, logo },
    measurements: measurements,
    materials: materials,
    general_observations: generalObservations || null,
    recommendations: recommendations || null,
    next_maintenance: nextMaintenance || null,
    approved_by_name: approvedByName || null,
    approval_date: approvalDate || null,
    technician_signature: techSignature || (techSigRef.current && !techSigRef.current.isEmpty() ? techSigRef.current.toDataURL() : null),
    supervisor_signature: supSignature || (supSigRef.current && !supSigRef.current.isEmpty() ? supSigRef.current.toDataURL() : null),
  });

  const handleSave = async (newStatus?: string): Promise<string | null> => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const formData = getFormData();
      const saveData = {
        ...formData,
        status: newStatus || status,
        created_by: user.id,
      };

      let id = savedReportId;
      if (id) {
        const { error } = await supabase
          .from("maintenance_reports")
          .update(saveData as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("maintenance_reports")
          .insert(saveData as any).select("id").single();
        if (error) throw error;
        id = data.id;
        setSavedReportId(id);
      }

      if (!newStatus) toast({ title: "Sucesso", description: "Relatório guardado" });
      return id;
    } catch (error: any) {
      console.error("Save error:", error);
      toast({ title: "Erro", description: error.message || "Erro ao guardar", variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Save first
      const id = await handleSave("completed");
      if (!id) return;

      const formData = getFormData();
      const pdfBlob = generateMaintenanceReportPDF({
        ...formData,
        work_order_reference: woReference,
        checklist_items: checklist,
        measurements: measurements,
        materials: materials,
        logo,
      } as any);

      const pdfPath = await uploadMaintenanceReportPDF(
        workOrderId,
        pdfBlob,
        type,
        woReference,
        user.id
      );

      // Update report with PDF URL
      {
        const { error } = await supabase
          .from("maintenance_reports")
          .update({ pdf_url: pdfPath, status: "completed" } as any)
          .eq("id", id);
        if (error) throw error;
      }

      toast({ title: "Sucesso", description: "PDF gerado e anexado à ordem de trabalho!" });
      onClose();
    } catch (error: any) {
      console.error("PDF error:", error);
      toast({ title: "Erro", description: error.message || "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateChecklist = (index: number, field: keyof ChecklistItem, value: any) => {
    const updated = [...checklist];
    (updated[index] as any)[field] = value;
    setChecklist(updated);
  };

  const updateMeasurement = (index: number, value: string, field: "value" | "parameter" | "unit" = "value") => {
    setMeasurements((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };
  const addMeasurement = (group?: string) => {
    setMeasurements((prev) => [...prev, { parameter: "", value: "", unit: "", group, custom: true }]);
  };
  const removeMeasurement = (index: number) => {
    setMeasurements((prev) => prev.filter((_, i) => i !== index));
  };
  const enableHvacGroups = () => {
    setMeasurements((prev) => [
      ...prev.map((m) => ({ ...m, group: m.group || "eq1" })),
      ...buildHvacGroupedMeasurements().filter((m) => m.group === "eq2"),
    ]);
  };
  const groupTitle = (g: string) =>
    g === "eq1" ? `Equipamento 1${equipmentName ? ` - ${equipmentName}` : ""}` : `Equipamento 2${designation ? ` - ${designation}` : ""}`;
  const renderMeasurementRow = (m: Measurement, idx: number) => (
    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-3 gap-2 items-center">
      {m.custom && !isReadOnly ? (
        <Input value={m.parameter} placeholder="Parâmetro" onChange={(e) => updateMeasurement(idx, e.target.value, "parameter")} className="text-sm" />
      ) : (
        <Label className="text-sm">{m.parameter}</Label>
      )}
      <Input type="text" value={m.value} onChange={(e) => updateMeasurement(idx, e.target.value)} disabled={isReadOnly} className="text-sm" />
      <div className="flex items-center gap-1">
        {m.custom && !isReadOnly ? (
          <Input value={m.unit} placeholder="Unid." onChange={(e) => updateMeasurement(idx, e.target.value, "unit")} className="text-sm w-20" />
        ) : (
          <span className="text-sm text-muted-foreground">{m.unit}</span>
        )}
        {m.custom && !isReadOnly && (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMeasurement(idx)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );

  const addMaterial = () => {
    setMaterials([...materials, { description: "", quantity: "", unit: "" }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: keyof Material, value: string) => {
    const updated = [...materials];
    updated[index][field] = value;
    setMaterials(updated);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const isReadOnly = !canEdit || status === "completed";
  const TypeIcon = type === "electricity" ? Zap : type === "cctv" ? Camera : Wind;
  const typeLabel = type === "electricity" ? "Eletricidade" : type === "cctv" ? "CCTV" : "Climatizacao";
  const typeColor = type === "electricity" ? "text-yellow-500" : type === "cctv" ? "text-purple-500" : "text-blue-500";

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onClose}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar aos Relatórios
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TypeIcon className={`h-5 w-5 ${typeColor}`} />
            Relatório de {typeLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <ReportLogoPicker value={logo} onChange={setLogo} disabled={isReadOnly} onError={(message) => toast({ title: "Imagem inválida", description: message, variant: "destructive" })} />
          {/* Identification */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">📋 Identificação do Relatório</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nº Relatório</Label>
                <Input value={woReference} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Technician */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">👤 Dados do Técnico</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do Técnico</Label>
                <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>ID / Nº Funcionário</Label>
                <Input value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Supervisor</Label>
                <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hora de Início</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora de Fim</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Location */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">📍 Localização & Equipamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Edifício</Label>
                <Input value={building} onChange={(e) => setBuilding(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Piso / Zona</Label>
                <Input value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} disabled={isReadOnly} placeholder="Ex: Piso 2, Ala E" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Localização Específica</Label>
                <Input value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)} disabled={isReadOnly} placeholder="Sala, corredor, etc." />
              </div>
              {!isReadOnly && woEquipments.length > 0 && (() => { const wanted = categoryForReport(type); const shown = woEquipments.filter((l) => matchesReportCategory(l.eq.category, wanted)); return (
                <div className="space-y-1.5 md:col-span-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <Label>Preencher com equipamento da OT</Label>
                  <div className="space-y-2">
                    {shown.length === 0 && <p className="text-xs text-muted-foreground">Esta OT não tem equipamentos de {wanted ? EQUIPMENT_CATEGORY_LABEL[wanted] : ""}. Adiciona-os nos "Equipamentos Associados" da OT.</p>}
                    {shown.map((l, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium flex-1 min-w-0">{equipmentLinkLabel(l.eq, l.part)}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyEquipment(l, 1)}>Equipamento 1</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => applyEquipment(l, 2)}>Equipamento 2</Button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Até 2 equipamentos por relatório; para mais, cria outro relatório na mesma OT.</p>
                </div>
              ); })()}
              <div className="space-y-1.5">
                <Label>Equipamento 1</Label>
                <Input value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Nº Série</Label>
                <Input value={equipmentSerial} onChange={(e) => setEquipmentSerial(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Equipamento 2</Label>
                <Input value={designation} onChange={(e) => setDesignation(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Nº Série</Label>
                <Input value={designationSerial} onChange={(e) => setDesignationSerial(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Checklist */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">
              ✅ Checklist de Inspeção {type === "electricity" ? "Elétrica" : type === "cctv" ? "CCTV" : "AVAC"}
            </h3>
            <div className="space-y-3">
              {checklist.map((item, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(v) => updateChecklist(idx, "checked", !!v)}
                      disabled={isReadOnly}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Input
                    placeholder="Observação..."
                    value={item.observation}
                    onChange={(e) => updateChecklist(idx, "observation", e.target.value)}
                    disabled={isReadOnly}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Measurements */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">
              📏 Medições {type === "electricity" ? "Elétricas" : type === "cctv" ? "CCTV" : "AVAC"}
            </h3>
            {type === "hvac" && measurements.some((m) => m.group) ? (
              <div className="space-y-6">
                {HVAC_GROUPS.map((g) => (
                  <div key={g} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">{groupTitle(g)}</h4>
                      {!isReadOnly && (
                        <Button type="button" variant="outline" size="sm" onClick={() => addMeasurement(g)}>
                          <Plus className="h-3 w-3 mr-1" /> Medição
                        </Button>
                      )}
                    </div>
                    {measurements.map((m, idx) => (m.group === g ? renderMeasurementRow(m, idx) : null))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {measurements.map((m, idx) => renderMeasurementRow(m, idx))}
                {!isReadOnly && (
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => addMeasurement()}>
                      <Plus className="h-3 w-3 mr-1" /> Medição
                    </Button>
                    {type === "hvac" && (
                      <Button type="button" variant="outline" size="sm" onClick={enableHvacGroups}>
                        Medições por equipamento
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Materials */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary border-b pb-2">🔧 Materiais Utilizados</h3>
              {!isReadOnly && (
                <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              )}
            </div>
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">
                Nenhum material registado. Clique em "Adicionar" para começar.
              </p>
            ) : (
              <div className="space-y-2">
                {materials.map((mat, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_80px_40px] gap-2 items-center">
                    <Input
                      placeholder="Descrição"
                      value={mat.description}
                      onChange={(e) => updateMaterial(idx, "description", e.target.value)}
                      disabled={isReadOnly}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Qtd"
                      value={mat.quantity}
                      onChange={(e) => updateMaterial(idx, "quantity", e.target.value)}
                      disabled={isReadOnly}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Unid."
                      value={mat.unit}
                      onChange={(e) => updateMaterial(idx, "unit", e.target.value)}
                      disabled={isReadOnly}
                      className="text-sm"
                    />
                    {!isReadOnly && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeMaterial(idx)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Observations */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">📝 Observações & Recomendações</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Observações Gerais</Label>
                <Textarea
                  value={generalObservations}
                  onChange={(e) => setGeneralObservations(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Descreva as observações relevantes..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Recomendações</Label>
                <Textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Recomendações para próximas intervenções..."
                  rows={3}
                />
              </div>
            </div>
          </section>

          {/* Approval */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">✔️ Aprovação & Seguimento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Próxima Manutenção</Label>
                <Input value={nextMaintenance} onChange={(e) => setNextMaintenance(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Aprovado por</Label>
                <Input value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Aprovação</Label>
                <Input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Signatures */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">✍️ Assinaturas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Assinatura do Técnico</Label>
                {techSignature && isReadOnly ? (
                  <img src={techSignature} alt="Assinatura Técnico" className="border rounded h-32 w-full object-contain bg-background" />
                ) : (
                  <>
                    <div className="border-2 border-border rounded-md bg-background">
                      <SignatureCanvas
                        ref={techSigRef}
                        canvasProps={{ className: "w-full h-32 cursor-crosshair" }}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => techSigRef.current?.clear()}>
                      Limpar
                    </Button>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Assinatura do Supervisor</Label>
                {supSignature && isReadOnly ? (
                  <img src={supSignature} alt="Assinatura Supervisor" className="border rounded h-32 w-full object-contain bg-background" />
                ) : (
                  <>
                    <div className="border-2 border-border rounded-md bg-background">
                      <SignatureCanvas
                        ref={supSigRef}
                        canvasProps={{ className: "w-full h-32 cursor-crosshair" }}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => supSigRef.current?.clear()}>
                      Limpar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Actions */}
          {!isReadOnly && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => handleSave()} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "A guardar..." : "Guardar Rascunho"}
              </Button>
              <Button onClick={handleGeneratePDF} disabled={saving} className="flex-1">
                <FileDown className="h-4 w-4 mr-2" />
                {saving ? "A gerar..." : "Concluir & Gerar PDF"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
