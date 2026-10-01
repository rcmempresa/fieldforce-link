import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { ArrowLeft, FileDown, FilePenLine, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  generateInterventionReportPDF,
  type InterventionEquipment,
  type InterventionExecution,
  type InterventionMaterial,
} from "@/lib/generateInterventionReportPDF";
import { uploadMaintenanceReportPDF } from "@/lib/generateMaintenanceReportPDF";

interface Props {
  workOrderId: string;
  reportId: string | null;
  canEdit: boolean;
  onClose: () => void;
}

interface StoredInterventionData {
  client?: string;
  installation?: string;
  cc?: string;
  proposal?: string;
  contract?: string;
  equipments?: InterventionEquipment[];
  serviceDescription?: string;
  emmUsed?: boolean;
  emmCode?: string;
  executions?: InterventionExecution[];
  clientName?: string;
}

const emptyEquipment = (): InterventionEquipment => ({ model: "", serialNumber: "", location: "" });
const emptyMaterial = (): InterventionMaterial => ({ quantity: "", reference: "", designation: "" });
const emptyExecution = (): InterventionExecution => ({ date: "", start: "", end: "", duration: "", extraHours: "", executor: "", km: "", observations: "" });

export function InterventionReportForm({ workOrderId, reportId, canEdit, onClose }: Props) {
  const { toast } = useToast();
  const technicianSignatureRef = useRef<SignatureCanvas>(null);
  const clientSignatureRef = useRef<SignatureCanvas>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("draft");
  const [savedReportId, setSavedReportId] = useState(reportId);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [workOrderReference, setWorkOrderReference] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [client, setClient] = useState("");
  const [installation, setInstallation] = useState("");
  const [cc, setCc] = useState("");
  const [proposal, setProposal] = useState("");
  const [contract, setContract] = useState("");
  const [equipments, setEquipments] = useState<InterventionEquipment[]>([emptyEquipment()]);
  const [materials, setMaterials] = useState<InterventionMaterial[]>([emptyMaterial()]);
  const [serviceDescription, setServiceDescription] = useState("");
  const [emmUsed, setEmmUsed] = useState(false);
  const [emmCode, setEmmCode] = useState("");
  const [executions, setExecutions] = useState<InterventionExecution[]>([emptyExecution()]);
  const [clientName, setClientName] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [technicianSignature, setTechnicianSignature] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: workOrder, error: workOrderError } = await supabase
          .from("work_orders")
          .select("reference, address, description, scheduled_date, client_id")
          .eq("id", workOrderId)
          .single();
        if (workOrderError) throw workOrderError;

        setWorkOrderReference(workOrder.reference || "");
        setInstallation(workOrder.address || "");
        setServiceDescription(workOrder.description || "");
        if (workOrder.scheduled_date) setReportDate(workOrder.scheduled_date.slice(0, 10));

        const [{ data: clientProfile }, { data: equipmentRows }, { data: currentUser }] = await Promise.all([
          supabase.from("profiles").select("name, company_name").eq("id", workOrder.client_id).single(),
          supabase.from("work_order_equipments").select("equipments(model, serial_number, location)").eq("work_order_id", workOrderId),
          supabase.auth.getUser(),
        ]);
        if (clientProfile) setClient(clientProfile.company_name || clientProfile.name || "");
        if (equipmentRows?.length) {
          setEquipments(equipmentRows.map((row) => {
            const equipment = row.equipments as unknown as { model: string | null; serial_number: string | null; location: string | null } | null;
            return { model: equipment?.model || "", serialNumber: equipment?.serial_number || "", location: equipment?.location || "" };
          }));
        }
        const user = currentUser.user;
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
          if (profile) setTechnicianName(profile.name);
        }

        if (reportId) {
          const { data: report, error } = await supabase.from("maintenance_reports").select("*").eq("id", reportId).single();
          if (error) throw error;
          const stored = (report.checklist_items || {}) as unknown as StoredInterventionData;
          setReportDate(report.report_date || "");
          setClient(stored.client || clientProfile?.company_name || clientProfile?.name || "");
          setInstallation(stored.installation || report.specific_location || workOrder.address || "");
          setCc(stored.cc || "");
          setProposal(stored.proposal || "");
          setContract(stored.contract || "");
          setEquipments(stored.equipments?.length ? stored.equipments : [emptyEquipment()]);
          setMaterials(Array.isArray(report.materials) && report.materials.length ? report.materials as unknown as InterventionMaterial[] : [emptyMaterial()]);
          setServiceDescription(stored.serviceDescription || report.general_observations || "");
          setEmmUsed(Boolean(stored.emmUsed));
          setEmmCode(stored.emmCode || "");
          setExecutions(stored.executions?.length ? stored.executions : [emptyExecution()]);
          setClientName(stored.clientName || report.approved_by_name || "");
          setTechnicianName(report.technician_name || "");
          setClientSignature(report.supervisor_signature || null);
          setTechnicianSignature(report.technician_signature || null);
          setStatus(report.status || "draft");
          setPdfUrl(report.pdf_url || null);
        }
      } catch (error) {
        console.error("Error loading intervention report:", error);
        toast({ title: "Erro", description: "Não foi possível carregar o relatório.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [reportId, workOrderId, toast]);

  const getSignatures = () => ({
    technician: technicianSignature || (technicianSignatureRef.current && !technicianSignatureRef.current.isEmpty() ? technicianSignatureRef.current.toDataURL() : null),
    client: clientSignature || (clientSignatureRef.current && !clientSignatureRef.current.isEmpty() ? clientSignatureRef.current.toDataURL() : null),
  });

  const saveReport = async (newStatus = status) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const signatures = getSignatures();
    const payload = {
      work_order_id: workOrderId,
      report_type: "intervention",
      report_date: reportDate || null,
      technician_name: technicianName || null,
      specific_location: installation || null,
      general_observations: serviceDescription || null,
      approved_by_name: clientName || null,
      technician_signature: signatures.technician,
      supervisor_signature: signatures.client,
      materials,
      checklist_items: { client, installation, cc, proposal, contract, equipments, serviceDescription, emmUsed, emmCode, executions, clientName },
      status: newStatus,
      created_by: user.id,
    };

    if (savedReportId) {
      const { error } = await supabase.from("maintenance_reports").update(payload as never).eq("id", savedReportId);
      if (error) throw error;
      return savedReportId;
    }
    const { data, error } = await supabase.from("maintenance_reports").insert(payload as never).select("id").single();
    if (error) throw error;
    setSavedReportId(data.id);
    return data.id;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveReport("draft");
      setStatus("draft");
      toast({ title: "Relatório guardado", description: "Pode continuar a editá-lo mais tarde." });
    } catch (error) {
      console.error("Error saving intervention report:", error);
      toast({ title: "Erro", description: "Não foi possível guardar o relatório.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const id = await saveReport("completed");
      const signatures = getSignatures();
      const blob = generateInterventionReportPDF({
        workOrderReference,
        reportDate,
        client,
        installation,
        cc,
        proposal,
        contract,
        equipments,
        materials,
        serviceDescription,
        emmUsed,
        emmCode,
        executions,
        clientName,
        technicianName,
        clientSignature: signatures.client,
        technicianSignature: signatures.technician,
      });
      const path = await uploadMaintenanceReportPDF(workOrderId, blob, "intervention", workOrderReference, user.id);
      const { error } = await supabase.from("maintenance_reports").update({ pdf_url: path, status: "completed" }).eq("id", id);
      if (error) throw error;
      setPdfUrl(path);
      setStatus("completed");
      toast({ title: "PDF gerado", description: "O relatório foi anexado à ordem de trabalho." });
      onClose();
    } catch (error) {
      console.error("Error generating intervention PDF:", error);
      toast({ title: "Erro", description: "Não foi possível gerar o PDF.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateEquipment = (index: number, field: keyof InterventionEquipment, value: string) => setEquipments((items) => items.map((item, position) => position === index ? { ...item, [field]: value } : item));
  const updateMaterial = (index: number, field: keyof InterventionMaterial, value: string) => setMaterials((items) => items.map((item, position) => position === index ? { ...item, [field]: value } : item));
  const updateExecution = (index: number, field: keyof InterventionExecution, value: string) => setExecutions((items) => items.map((item, position) => position === index ? { ...item, [field]: value } : item));
  const isReadOnly = !canEdit;

  if (loading) return <Card><CardContent className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></CardContent></Card>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Voltar aos Relatórios</Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilePenLine className="h-5 w-5 text-primary" />Relatório de Intervenção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-semibold text-primary">Identificação</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="N.º da OT"><Input value={workOrderReference} disabled /></Field>
              <Field label="Data"><Input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Cliente"><Input value={client} onChange={(event) => setClient(event.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Instalação"><Input value={installation} onChange={(event) => setInstallation(event.target.value)} disabled={isReadOnly} /></Field>
              <Field label="CC"><Input value={cc} onChange={(event) => setCc(event.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Proposta"><Input value={proposal} onChange={(event) => setProposal(event.target.value)} disabled={isReadOnly} /></Field>
              <Field label="Contrato (se aplicável)"><Input value={contract} onChange={(event) => setContract(event.target.value)} disabled={isReadOnly} /></Field>
            </div>
          </section>

          <EditableRows title="Equipamento a intervencionar" onAdd={() => setEquipments((items) => [...items, emptyEquipment()])} disabled={isReadOnly}>
            {equipments.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_1.3fr_auto]">
                <Field label="Modelo"><Input value={item.model} onChange={(event) => updateEquipment(index, "model", event.target.value)} disabled={isReadOnly} /></Field>
                <Field label="N.º de série"><Input value={item.serialNumber} onChange={(event) => updateEquipment(index, "serialNumber", event.target.value)} disabled={isReadOnly} /></Field>
                <Field label="Localização"><Input value={item.location} onChange={(event) => updateEquipment(index, "location", event.target.value)} disabled={isReadOnly} /></Field>
                {!isReadOnly && equipments.length > 1 && <RemoveButton onClick={() => setEquipments((items) => items.filter((_, position) => position !== index))} />}
              </div>
            ))}
          </EditableRows>

          <EditableRows title="Materiais aplicados" onAdd={() => setMaterials((items) => [...items, emptyMaterial()])} disabled={isReadOnly}>
            {materials.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-md border p-3 md:grid-cols-[0.7fr_1fr_2fr_auto]">
                <Field label="Quantidade"><Input value={item.quantity} onChange={(event) => updateMaterial(index, "quantity", event.target.value)} disabled={isReadOnly} /></Field>
                <Field label="Referência"><Input value={item.reference} onChange={(event) => updateMaterial(index, "reference", event.target.value)} disabled={isReadOnly} /></Field>
                <Field label="Designação"><Input value={item.designation} onChange={(event) => updateMaterial(index, "designation", event.target.value)} disabled={isReadOnly} /></Field>
                {!isReadOnly && materials.length > 1 && <RemoveButton onClick={() => setMaterials((items) => items.filter((_, position) => position !== index))} />}
              </div>
            ))}
          </EditableRows>

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-semibold text-primary">Descrição do serviço efetuado</h3>
            <Textarea value={serviceDescription} onChange={(event) => setServiceDescription(event.target.value)} rows={7} disabled={isReadOnly} />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={emmUsed} onCheckedChange={(value) => setEmmUsed(value === true)} disabled={isReadOnly} />Utilização de EMM</label>
              {emmUsed && <div className="min-w-52 flex-1"><Input placeholder="Código EMM" value={emmCode} onChange={(event) => setEmmCode(event.target.value)} disabled={isReadOnly} /></div>}
            </div>
          </section>

          <EditableRows title="Execução da intervenção" onAdd={() => setExecutions((items) => [...items, emptyExecution()])} disabled={isReadOnly}>
            {executions.map((item, index) => (
              <div key={index} className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Data"><Input type="date" value={item.date} onChange={(event) => updateExecution(index, "date", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Início"><Input type="time" value={item.start} onChange={(event) => updateExecution(index, "start", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Termo"><Input type="time" value={item.end} onChange={(event) => updateExecution(index, "end", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Duração"><Input placeholder="Ex.: 2h 30min" value={item.duration} onChange={(event) => updateExecution(index, "duration", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Horas extras"><Input value={item.extraHours} onChange={(event) => updateExecution(index, "extraHours", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Executante"><Input value={item.executor} onChange={(event) => updateExecution(index, "executor", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Km"><Input inputMode="decimal" value={item.km} onChange={(event) => updateExecution(index, "km", event.target.value)} disabled={isReadOnly} /></Field>
                  <Field label="Observações"><Input value={item.observations} onChange={(event) => updateExecution(index, "observations", event.target.value)} disabled={isReadOnly} /></Field>
                </div>
                {!isReadOnly && executions.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setExecutions((items) => items.filter((_, position) => position !== index))}><Trash2 className="mr-2 h-4 w-4" />Remover linha</Button>}
              </div>
            ))}
          </EditableRows>

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-semibold text-primary">Validação e assinaturas</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <SignatureField label="Cliente" name={clientName} setName={setClientName} signature={clientSignature} setSignature={setClientSignature} canvasRef={clientSignatureRef} disabled={isReadOnly} />
              <SignatureField label="O Técnico" name={technicianName} setName={setTechnicianName} signature={technicianSignature} setSignature={setTechnicianSignature} canvasRef={technicianSignatureRef} disabled={isReadOnly} />
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
            {!isReadOnly && <Button variant="outline" onClick={handleSave} disabled={saving}><Save className="mr-2 h-4 w-4" />Guardar rascunho</Button>}
            {!isReadOnly && <Button onClick={handleGeneratePdf} disabled={saving}><FileDown className="mr-2 h-4 w-4" />Gerar PDF</Button>}
            {isReadOnly && pdfUrl && <p className="text-sm text-muted-foreground">O PDF está disponível na lista de relatórios.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function EditableRows({ title, children, onAdd, disabled }: { title: string; children: React.ReactNode; onAdd: () => void; disabled: boolean }) {
  return <section className="space-y-4"><div className="flex items-center justify-between border-b pb-2"><h3 className="text-sm font-semibold text-primary">{title}</h3>{!disabled && <Button type="button" size="sm" variant="outline" onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>}</div><div className="space-y-3">{children}</div></section>;
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <Button type="button" size="icon" variant="ghost" onClick={onClick} className="self-end" title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>;
}

function SignatureField({ label, name, setName, signature, setSignature, canvasRef, disabled }: { label: string; name: string; setName: (value: string) => void; signature: string | null; setSignature: (value: string | null) => void; canvasRef: React.RefObject<SignatureCanvas>; disabled: boolean }) {
  return <div className="space-y-3 rounded-md border p-3"><Field label={label}><Input value={name} onChange={(event) => setName(event.target.value)} disabled={disabled} /></Field>{signature ? <div className="flex h-32 items-center justify-center rounded-md border bg-background"><img src={signature} alt={`Assinatura: ${label}`} className="max-h-28 max-w-full" /></div> : <div className="overflow-hidden rounded-md border bg-background"><SignatureCanvas ref={canvasRef} canvasProps={{ className: "h-32 w-full" }} /></div>}{!disabled && <Button type="button" size="sm" variant="outline" onClick={() => { setSignature(null); canvasRef.current?.clear(); }}>Limpar assinatura</Button>}</div>;
}