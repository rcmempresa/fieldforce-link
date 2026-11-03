import { supabase } from "@/integrations/supabase/client";

// Uploads files to a work order's attachments (storage + attachments table).
export async function uploadWorkOrderAttachments(workOrderId: string, files: File[]): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user || !files.length) return 0;
  let ok = 0;
  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `${workOrderId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("work-order-attachments").upload(path, file);
    if (upErr) { console.error(upErr); continue; }
    const { data: { publicUrl } } = supabase.storage.from("work-order-attachments").getPublicUrl(path);
    const { error } = await supabase.from("attachments").insert({
      work_order_id: workOrderId, filename: file.name, url: publicUrl, uploaded_by: userData.user.id,
    });
    if (!error) ok++; else console.error(error);
  }
  return ok;
}
