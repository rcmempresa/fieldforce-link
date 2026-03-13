import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@3.0.3";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDecimalHoursToTime(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
}

// mm to PDF points
const mm = (v: number) => v * 2.835;

function buildCorrectedPageWithJsPDF(wo: any, clientEmail: string, empList: { name: string; hours: number }[], totalHours: number, completedAt: string): { pdfBytes: Uint8Array; signatureLabelY: number } {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Folha de OT", 105, 20, { align: "center" });

  doc.setFontSize(14);
  doc.text(`Refer\u00EAncia: ${wo.reference}`, 20, 35);

  doc.setLineWidth(0.5);
  doc.line(20, 40, 190, 40);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Detalhes da Ordem:", 20, 50);

  doc.setFont("helvetica", "normal");
  doc.text(`T\u00EDtulo: ${wo.title}`, 20, 58);
  const descText = wo.description || "N/A";
  const splitDesc = doc.splitTextToSize(`Descri\u00E7\u00E3o: ${descText}`, 170);
  doc.text(splitDesc, 20, 66);
  const descEndY = 66 + splitDesc.length * 6;

  doc.text(`Tipo de Servi\u00E7o: ${wo.service_type}`, 20, descEndY + 2);
  doc.text(`Prioridade: ${wo.priority}`, 20, descEndY + 10);
  doc.text(`Status: Conclu\u00EDda`, 20, descEndY + 18);

  let sectionY = descEndY + 30;
  doc.setFont("helvetica", "bold");
  doc.text("Informa\u00E7\u00F5es do Cliente:", 20, sectionY);

  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${(wo.client as any)?.name || "N/A"}`, 20, sectionY + 8);
  doc.text(`Email: ${clientEmail}`, 20, sectionY + 16);

  doc.setFont("helvetica", "bold");
  doc.text("Detalhes da Conclus\u00E3o:", 20, sectionY + 28);

  doc.setFont("helvetica", "normal");
  let empY = sectionY + 36;
  for (const emp of empList) {
    doc.text(`\u2022 ${emp.name}: ${formatDecimalHoursToTime(emp.hours)}`, 25, empY);
    empY += 7;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatDecimalHoursToTime(totalHours)}`, 20, empY + 2);
  empY += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Data de conclus\u00E3o: ${new Date(completedAt).toLocaleString("pt-PT")}`, 20, empY);

  let currentY = empY + 12;

  if (wo.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Observa\u00E7\u00F5es:", 20, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    const splitNotes = doc.splitTextToSize(wo.notes, 170);
    doc.text(splitNotes, 20, currentY);
    currentY += splitNotes.length * 6 + 10;
  }

  // Signature will be overlaid from original PDF - no label needed here
  const sigLabelY = Math.max(currentY, 180);

  // Footer
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Documento gerado automaticamente em ${new Date().toLocaleString("pt-PT")}`,
    105, 280, { align: "center" }
  );

  return {
    pdfBytes: new Uint8Array(doc.output("arraybuffer")),
    signatureLabelY: sigLabelY,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { workOrderIds, mergeOriginal } = await req.json();
    if (!workOrderIds || !Array.isArray(workOrderIds)) {
      throw new Error("workOrderIds array is required");
    }

    const results = [];

    for (const workOrderId of workOrderIds) {
      try {
        const { data: wo } = await supabase
          .from("work_orders")
          .select(`*, client:profiles!work_orders_client_id_fkey(name, id), assignments:work_order_assignments(user:profiles!work_order_assignments_user_id_fkey(name))`)
          .eq("id", workOrderId)
          .single();

        if (!wo) { results.push({ workOrderId, error: "Not found" }); continue; }

        let clientEmail = "N/A";
        if (wo.client_id) {
          const { data: userData } = await supabase.auth.admin.getUserById(wo.client_id);
          clientEmail = userData?.user?.email || "N/A";
        }

        const { data: timeEntries } = await supabase
          .from("time_entries")
          .select("duration_hours, user_id, profiles!time_entries_user_id_fkey(name)")
          .eq("work_order_id", workOrderId);

        const empMap = new Map<string, { name: string; hours: number }>();
        for (const e of timeEntries || []) {
          const name = (e as any).profiles?.name || "N/A";
          const existing = empMap.get(e.user_id) || { name, hours: 0 };
          existing.hours += e.duration_hours || 0;
          empMap.set(e.user_id, existing);
        }
        const empList = Array.from(empMap.values());
        const totalHours = empList.reduce((s, e) => s + e.hours, 0);

        const { data: lastEntry } = await supabase
          .from("time_entries")
          .select("end_time")
          .eq("work_order_id", workOrderId)
          .not("end_time", "is", null)
          .order("end_time", { ascending: false })
          .limit(1)
          .single();

        const completedAt = lastEntry?.end_time || wo.updated_at;

        // Build corrected page with jsPDF
        const { pdfBytes: correctedPdfBytes, signatureLabelY } = buildCorrectedPageWithJsPDF(wo, clientEmail, empList, totalHours, completedAt);

        let finalPdfBytes: Uint8Array = correctedPdfBytes;

        if (mergeOriginal) {
          // Find original PDF with signature
          const { data: attachments } = await supabase
            .from("attachments")
            .select("url, filename")
            .eq("work_order_id", workOrderId)
            .order("uploaded_at", { ascending: true });

          const originalAttachment = attachments?.find(a =>
            a.filename.includes("_concluido_") && !a.filename.includes("_corrigido") && !a.filename.includes("_completo")
          );

          if (originalAttachment) {
            const { data: originalFile } = await supabase.storage
              .from("work-order-attachments")
              .download(originalAttachment.url);

            if (originalFile) {
              const originalPdfBytes = new Uint8Array(await originalFile.arrayBuffer());

              try {
                // Load both PDFs with pdf-lib
                const correctedDoc = await PDFDocument.load(correctedPdfBytes);
                const originalDoc = await PDFDocument.load(originalPdfBytes);

                const correctedPage = correctedDoc.getPages()[0];
                const originalPage = originalDoc.getPages()[0];
                const { width: origW, height: origH } = originalPage.getSize();

                // The signature in the original PDF is at approximately:
                // jsPDF y ~185mm from top → PDF y = (297-185)*2.835 ≈ 317pt from bottom
                // Signature image: x=20mm, y=185mm, w=80mm, h=30mm in jsPDF
                // In PDF coords: x=56.7pt, bottom=~232pt, top=~317pt from page bottom
                // We clip a generous area around the signature
                const clipBottom = mm(297 - 225); // 225mm from top in jsPDF
                const clipTop = mm(297 - 178);    // 178mm from top in jsPDF  
                const clipLeft = mm(15);
                const clipRight = mm(110);

                // Embed the original page, clipped to the signature area
                const embeddedPage = await correctedDoc.embedPage(originalPage, {
                  left: clipLeft,
                  bottom: clipBottom,
                  right: clipRight,
                  top: clipTop,
                });

                // Position the clipped signature on the corrected page
                // Place it right after the "Assinatura do Cliente:" label
                const drawY = mm(297 - (signatureLabelY + 5)); // convert jsPDF mm to PDF points
                const clipW = clipRight - clipLeft;
                const clipH = clipTop - clipBottom;

                correctedPage.drawPage(embeddedPage, {
                  x: mm(18),
                  y: drawY - clipH,
                  width: clipW,
                  height: clipH,
                });

                finalPdfBytes = new Uint8Array(await correctedDoc.save());
                console.log(`Merged signature onto single page. Clip area: ${clipW.toFixed(0)}x${clipH.toFixed(0)}pt, drawn at y=${(drawY - clipH).toFixed(0)}`);
              } catch (mergeErr) {
                console.error("Error merging signature:", mergeErr);
                // Fallback: just use the corrected page without signature
              }
            }
          }
        }

        const suffix = mergeOriginal ? "_completo" : "_corrigido";
        const fileName = `${wo.reference}_concluido${suffix}_${Date.now()}.pdf`;
        const filePath = `${workOrderId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("work-order-attachments")
          .upload(filePath, finalPdfBytes, { contentType: "application/pdf", upsert: false });

        if (uploadError) {
          results.push({ workOrderId, reference: wo.reference, error: uploadError.message });
          continue;
        }

        const { data: manager } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "manager")
          .eq("approved", true)
          .limit(1)
          .single();

        await supabase.from("attachments").insert({
          work_order_id: workOrderId,
          uploaded_by: manager?.user_id || wo.created_by,
          url: filePath,
          filename: fileName,
        });

        results.push({ workOrderId, reference: wo.reference, success: true, fileName });
      } catch (err) {
        results.push({ workOrderId, error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
