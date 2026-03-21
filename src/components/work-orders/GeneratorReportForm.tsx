import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, FileDown, Plus, Trash2, Cog } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import {
  ChecklistItem,
  Measurement,
  Material,
  GeneratorData,
  defaultGeneratorData,
  generatorMotorChecklist,
  generatorMotorMeasurements,
  generatorElectricalChecklist,
  generatorElectricalMeasurements,
} from "@/lib/maintenanceReportDefaults";
import {
  generateGeneratorReportPDF,
  uploadMaintenanceReportPDF,
} from "@/lib/generateMaintenanceReportPDF";

interface Props {
  workOrderId: string;
  reportId: string | null;
  canEdit: boolean;
  onClose: () => void;
}

export function GeneratorReportForm({ workOrderId, reportId, canEdit, onClose }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const techSigRef = useRef<SignatureCanvas>(null);
  const supSigRef = useRef<SignatureCanvas>(null);

  // Form state
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [technicianName, setTechnicianName] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [building, setBuilding] = useState("");
  const [floorNumber, setFloorNumber] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");

  // Generator-specific fields
  const [generatorData, setGeneratorData] = useState<GeneratorData>({ ...defaultGeneratorData });

  // Two checklists
  const [motorChecklist, setMotorChecklist] = useState<ChecklistItem[]>([]);
  const [electricalChecklist, setElectricalChecklist] = useState<ChecklistItem[]>([]);

  // Two measurement tables
  const [motorMeasurements, setMotorMeasurements] = useState<Measurement[]>([]);
  const [electricalMeasurements, setElectricalMeasurements] = useState<Measurement[]>([]);

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

  useEffect(() => {
    fetchWoReference();
    if (reportId) {
      loadReport();
    } else {
      initDefaults();
      loadCurrentUser();
    }
  }, [reportId]);

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
    setMotorChecklist([...generatorMotorChecklist]);
    setElectricalChecklist([...generatorElectricalChecklist]);
    setMotorMeasurements([...generatorMotorMeasurements]);
    setElectricalMeasurements([...generatorElectricalMeasurements]);
  };

  const loadReport = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("maintenance_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error || !data) {
      toast({ title: "Erro", description: "Erro ao carregar relatorio", variant: "destructive" });
      onClose();
      return;
    }

    setReportDate(data.report_date || "");
    setTechnicianName(data.technician_name || "");
    setTechnicianId(data.technician_id || "");
    setSupervisorName(data.supervisor_name || "");
    setStartTime(data.start_time || "");
    setEndTime(data.end_time || "");
    setBuilding(data.building || "");
    setFloorNumber(data.floor_number || "");
    setSpecificLocation(data.specific_location || "");

    // Generator data is stored in checklist_items JSON alongside checklists
    const storedData = data.checklist_items as any;
    if (storedData?.generatorData) {
      setGeneratorData(storedData.generatorData);
    }
    if (storedData?.motorChecklist) {
      setMotorChecklist(storedData.motorChecklist);
    } else {
      setMotorChecklist([...generatorMotorChecklist]);
    }
    if (storedData?.electricalChecklist) {
      setElectricalChecklist(storedData.electricalChecklist);
    } else {
      setElectricalChecklist([...generatorElectricalChecklist]);
    }

    const storedMeasurements = data.measurements as any;
    if (storedMeasurements?.motorMeasurements) {
      setMotorMeasurements(storedMeasurements.motorMeasurements);
    } else {
      setMotorMeasurements([...generatorMotorMeasurements]);
    }
    if (storedMeasurements?.electricalMeasurements) {
      setElectricalMeasurements(storedMeasurements.electricalMeasurements);
    } else {
      setElectricalMeasurements([...generatorElectricalMeasurements]);
    }

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
    report_type: "generator",
    report_date: reportDate || null,
    technician_name: technicianName || null,
    technician_id: technicianId || null,
    supervisor_name: supervisorName || null,
    start_time: startTime || null,
    end_time: endTime || null,
    building: building || null,
    floor_number: floorNumber || null,
    specific_location: specificLocation || null,
    equipment_name: generatorData.brand || null,
    equipment_serial: generatorData.serial_number || null,
    designation: null,
    designation_serial: null,
    checklist_items: {
      generatorData,
      motorChecklist,
      electricalChecklist,
    },
    measurements: {
      motorMeasurements,
      electricalMeasurements,
    },
    materials: materials,
    general_observations: generalObservations || null,
    recommendations: recommendations || null,
    next_maintenance: nextMaintenance || null,
    approved_by_name: approvedByName || null,
    approval_date: approvalDate || null,
    technician_signature: techSignature || (techSigRef.current && !techSigRef.current.isEmpty() ? techSigRef.current.toDataURL() : null),
    supervisor_signature: supSignature || (supSigRef.current && !supSigRef.current.isEmpty() ? supSigRef.current.toDataURL() : null),
  });

  const handleSave = async (newStatus?: string) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const formData = getFormData();
      const saveData = { ...formData, status: newStatus || status, created_by: user.id };

      if (reportId) {
        const { error } = await supabase.from("maintenance_reports").update(saveData as any).eq("id", reportId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("maintenance_reports").insert(saveData as any);
        if (error) throw error;
      }

      toast({ title: "Sucesso", description: "Relatorio guardado" });
      if (newStatus === "completed") onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      await handleSave("completed");

      const formData = getFormData();
      const pdfBlob = generateGeneratorReportPDF({
        ...formData,
        work_order_reference: woReference,
        generatorData,
        motorChecklist,
        electricalChecklist,
        motorMeasurements,
        electricalMeasurements,
        materials,
      } as any);

      const pdfPath = await uploadMaintenanceReportPDF(
        workOrderId, pdfBlob, "generator", woReference, user.id
      );

      if (reportId) {
        await supabase.from("maintenance_reports")
          .update({ pdf_url: pdfPath, status: "completed" } as any)
          .eq("id", reportId);
      }

      toast({ title: "Sucesso", description: "PDF gerado e anexado!" });
      onClose();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateGeneratorField = (field: keyof GeneratorData, value: string) => {
    setGeneratorData(prev => ({ ...prev, [field]: value }));
  };

  const updateChecklist = (list: ChecklistItem[], setList: (v: ChecklistItem[]) => void, index: number, field: keyof ChecklistItem, value: any) => {
    const updated = [...list];
    (updated[index] as any)[field] = value;
    setList(updated);
  };

  const updateMeasurement = (list: Measurement[], setList: (v: Measurement[]) => void, index: number, value: string) => {
    const updated = [...list];
    updated[index].value = value;
    setList(updated);
  };

  const addMaterial = () => setMaterials([...materials, { description: "", quantity: "", unit: "" }]);
  const removeMaterial = (index: number) => setMaterials(materials.filter((_, i) => i !== index));
  const updateMaterial = (index: number, field: keyof Material, value: string) => {
    const updated = [...materials];
    updated[index][field] = value;
    setMaterials(updated);
  };

  if (loading) {
    return (
      <Card><CardContent className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </CardContent></Card>
    );
  }

  const isReadOnly = !canEdit || status === "completed";

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onClose}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar aos Relatorios
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5 text-emerald-600" />
            Ficha de Manutencao - Grupo Gerador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Identification */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Identificacao do Relatorio</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>N. Relatorio / OT</Label>
                <Input value={woReference} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Generator Data */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Dados do Grupo Gerador</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Marca/Fabricante</Label>
                <Input value={generatorData.brand} onChange={(e) => updateGeneratorField("brand", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input value={generatorData.model} onChange={(e) => updateGeneratorField("model", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>N. Serie</Label>
                <Input value={generatorData.serial_number} onChange={(e) => updateGeneratorField("serial_number", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Potencia (kVA)</Label>
                <Input value={generatorData.kva_power} onChange={(e) => updateGeneratorField("kva_power", e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de Combustivel</Label>
                <Input value={generatorData.fuel_type} onChange={(e) => updateGeneratorField("fuel_type", e.target.value)} disabled={isReadOnly} placeholder="Diesel, Gasolina..." />
              </div>
              <div className="space-y-1.5">
                <Label>Contador de Horas</Label>
                <Input value={generatorData.hours_counter} onChange={(e) => updateGeneratorField("hours_counter", e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Technician & Location */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Dados do Tecnico & Localizacao</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tecnico</Label>
                <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>ID / N. Funcionario</Label>
                <Input value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Supervisor</Label>
                <Input value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Edificio</Label>
                <Input value={building} onChange={(e) => setBuilding(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Piso / Zona</Label>
                <Input value={floorNumber} onChange={(e) => setFloorNumber(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Localizacao Especifica</Label>
                <Input value={specificLocation} onChange={(e) => setSpecificLocation(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Hora de Inicio</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Hora de Fim</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Motor Checklist */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Checklist do Motor & Sistema Mecanico</h3>
            <div className="space-y-3">
              {motorChecklist.map((item, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={item.checked} onCheckedChange={(v) => updateChecklist(motorChecklist, setMotorChecklist, idx, "checked", !!v)} disabled={isReadOnly} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Input placeholder="Observacao..." value={item.observation} onChange={(e) => updateChecklist(motorChecklist, setMotorChecklist, idx, "observation", e.target.value)} disabled={isReadOnly} className="text-sm" />
                </div>
              ))}
            </div>
          </section>

          {/* Motor Measurements */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Medicoes do Motor</h3>
            <div className="space-y-2">
              {motorMeasurements.map((m, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-sm">{m.parameter}</Label>
                  <Input type="text" value={m.value} onChange={(e) => updateMeasurement(motorMeasurements, setMotorMeasurements, idx, e.target.value)} disabled={isReadOnly} className="text-sm" />
                  <span className="text-sm text-muted-foreground">{m.unit}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Electrical Checklist */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Checklist Eletrica & Sistema de Controlo</h3>
            <div className="space-y-3">
              {electricalChecklist.map((item, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={item.checked} onCheckedChange={(v) => updateChecklist(electricalChecklist, setElectricalChecklist, idx, "checked", !!v)} disabled={isReadOnly} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Input placeholder="Observacao..." value={item.observation} onChange={(e) => updateChecklist(electricalChecklist, setElectricalChecklist, idx, "observation", e.target.value)} disabled={isReadOnly} className="text-sm" />
                </div>
              ))}
            </div>
          </section>

          {/* Electrical Measurements */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Medicoes Eletricas (Painel do Gerador)</h3>
            <div className="space-y-2">
              {electricalMeasurements.map((m, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                  <Label className="text-sm">{m.parameter}</Label>
                  <Input type="text" value={m.value} onChange={(e) => updateMeasurement(electricalMeasurements, setElectricalMeasurements, idx, e.target.value)} disabled={isReadOnly} className="text-sm" />
                  <span className="text-sm text-muted-foreground">{m.unit}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Materials */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary border-b pb-2">Materiais Utilizados</h3>
              {!isReadOnly && (
                <Button type="button" variant="outline" size="sm" onClick={addMaterial}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              )}
            </div>
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3">Nenhum material registado.</p>
            ) : (
              <div className="space-y-2">
                {materials.map((mat, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_80px_40px] gap-2 items-center">
                    <Input placeholder="Descricao" value={mat.description} onChange={(e) => updateMaterial(idx, "description", e.target.value)} disabled={isReadOnly} className="text-sm" />
                    <Input placeholder="Qtd" value={mat.quantity} onChange={(e) => updateMaterial(idx, "quantity", e.target.value)} disabled={isReadOnly} className="text-sm" />
                    <Input placeholder="Unid." value={mat.unit} onChange={(e) => updateMaterial(idx, "unit", e.target.value)} disabled={isReadOnly} className="text-sm" />
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
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Observacoes & Recomendacoes</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Observacoes Gerais</Label>
                <Textarea value={generalObservations} onChange={(e) => setGeneralObservations(e.target.value)} disabled={isReadOnly} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Recomendacoes</Label>
                <Textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} disabled={isReadOnly} rows={3} />
              </div>
            </div>
          </section>

          {/* Approval */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Aprovacao & Seguimento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Proxima Manutencao</Label>
                <Input value={nextMaintenance} onChange={(e) => setNextMaintenance(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Aprovado por</Label>
                <Input value={approvedByName} onChange={(e) => setApprovedByName(e.target.value)} disabled={isReadOnly} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de Aprovacao</Label>
                <Input type="date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} disabled={isReadOnly} />
              </div>
            </div>
          </section>

          {/* Signatures */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-primary border-b pb-2">Assinaturas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Assinatura do Tecnico</Label>
                {techSignature && isReadOnly ? (
                  <img src={techSignature} alt="Assinatura Tecnico" className="border rounded h-32 w-full object-contain bg-background" />
                ) : (
                  <>
                    <div className="border-2 border-border rounded-md bg-background">
                      <SignatureCanvas ref={techSigRef} canvasProps={{ className: "w-full h-32 cursor-crosshair" }} />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => techSigRef.current?.clear()}>Limpar</Button>
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
                      <SignatureCanvas ref={supSigRef} canvasProps={{ className: "w-full h-32 cursor-crosshair" }} />
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => supSigRef.current?.clear()}>Limpar</Button>
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
