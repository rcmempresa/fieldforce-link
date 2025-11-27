import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Upload, Download, Trash2, Image, File } from "lucide-react";

interface Attachment {
  id: string;
  filename: string;
  url: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface EquipmentAttachmentsProps {
  equipmentId: string;
  currentUserId: string;
  isManager: boolean;
}

export function EquipmentAttachments({ equipmentId, currentUserId, isManager }: EquipmentAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAttachments();
  }, [equipmentId]);

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from("equipment_attachments")
        .select("*")
        .eq("equipment_id", equipmentId)
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar anexos",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${currentUserId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("equipment-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("equipment-attachments")
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase
          .from("equipment_attachments")
          .insert({
            equipment_id: equipmentId,
            filename: file.name,
            url: filePath,
            uploaded_by: currentUserId,
          });

        if (dbError) throw dbError;
      }

      toast({
        title: "Anexos enviados",
        description: "Os arquivos foram anexados com sucesso.",
      });

      fetchAttachments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao enviar anexo",
        description: error.message,
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("equipment-attachments")
        .download(attachment.url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao baixar anexo",
        description: error.message,
      });
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!window.confirm("Tem certeza que deseja excluir este anexo?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("equipment-attachments")
        .remove([attachment.url]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("equipment_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      toast({
        title: "Anexo excluído",
        description: "O anexo foi removido com sucesso.",
      });

      fetchAttachments();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir anexo",
        description: error.message,
      });
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <Image className="h-4 w-4" />;
    }
    if (["pdf"].includes(ext || "")) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const canDelete = (attachment: Attachment) => {
    return isManager || attachment.uploaded_by === currentUserId;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Anexos do Equipamento</span>
          <Button
            size="sm"
            onClick={() => document.getElementById("equipment-file-upload")?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? "Enviando..." : "Adicionar Anexo"}
          </Button>
          <input
            id="equipment-file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando anexos...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo encontrado.</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getFileIcon(attachment.filename)}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {attachment.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(attachment.uploaded_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete(attachment) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
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