import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  onError: (message: string) => void;
}

export function ReportLogoPicker({ value, onChange, disabled, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseFile = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      onError('Escolha uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError('A imagem deve ter até 5 MB.');
      return;
    }
    try {
      const source = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = source;
        await image.decode();
        const scale = Math.min(1, 640 / image.width, 240 / image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas');
        if (file.type !== 'image/png') {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        onChange(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.82));
      } finally {
        URL.revokeObjectURL(source);
      }
    } catch {
      onError('Não foi possível ler esta imagem. Escolha outra.');
    }
  };

  return (
    <section className="space-y-3 border-b pb-5">
      <Label htmlFor="report-logo">Logótipo do relatório</Label>
      <div className="flex flex-wrap items-center gap-3">
        {value && <img src={value} alt="Logótipo escolhido" className="h-16 max-w-40 object-contain" />}
        {!disabled && <>
          <Input id="report-logo" ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ''; }} />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />{value ? 'Trocar logótipo' : 'Adicionar logótipo'}</Button>
          {value && <Button type="button" variant="ghost" onClick={() => onChange(null)}><Trash2 className="mr-2 h-4 w-4" />Remover</Button>}
        </>}
        {!value && disabled && <span className="text-sm text-muted-foreground">Sem logótipo</span>}
      </div>
    </section>
  );
}