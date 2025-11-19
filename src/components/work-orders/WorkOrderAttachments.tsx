import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Image, Download, Trash2, Loader2 } from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  url: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface WorkOrderAttachmentsProps {
  workOrderId: string;
  isManager: boolean;
  currentUserId?: string;
}

export function WorkOrderAttachments({ workOrderId, isManager, currentUserId }: WorkOrderAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAttachments();
  }, [workOrderId]);

  const fetchAttachments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attachments")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching attachments:", error);
    } else {
      setAttachments(data || []);
    }
    setLoading(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${workOrderId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("work-order-attachments")
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("work-order-attachments")
          .getPublicUrl(fileName);

        // Insert attachment record
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const { error: dbError } = await supabase
          .from("attachments")
          .insert({
            work_order_id: workOrderId,
            filename: file.name,
            url: fileName,
            uploaded_by: userData.user.id,
          });

        if (dbError) {
          throw dbError;
        }
      }

      toast({
        title: "Sucesso",
        description: `${files.length} ficheiro(s) carregado(s) com sucesso`,
      });

      fetchAttachments();
      event.target.value = "";
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar ficheiros",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("work-order-attachments")
        .download(attachment.url);

      if (error) throw error;
      if (!data) throw new Error("Nenhum dado recebido");

      // Create blob URL and download
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading file:", error);
      toast({
        title: "Erro",
        description: "Erro ao descarregar ficheiro",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!confirm("Tem certeza que deseja eliminar este anexo?")) return;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("work-order-attachments")
        .remove([attachment.url]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      toast({
        title: "Sucesso",
        description: "Anexo eliminado com sucesso",
      });

      fetchAttachments();
    } catch (error: any) {
      console.error("Error deleting attachment:", error);
      toast({
        title: "Erro",
        description: "Erro ao eliminar anexo",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <Image className="h-5 w-5" />;
    }
    return <FileText className="h-5 w-5" />;
  };

  const canDelete = (attachment: Attachment) => {
    return isManager || attachment.uploaded_by === currentUserId;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Anexos
          </CardTitle>
          <div>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <Button
              size="sm"
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A carregar...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Adicionar Anexo
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhum anexo adicionado
          </p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-muted-foreground">
                    {getFileIcon(attachment.filename)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{attachment.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(attachment.uploaded_at).toLocaleDateString("pt-PT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDownload(attachment)}
                    title="Descarregar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete(attachment) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(attachment)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
