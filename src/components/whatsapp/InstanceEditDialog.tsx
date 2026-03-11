import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface InstanceEditDialogProps {
  instanceId: string;
  instanceName: string;
  instancePhoneNumber: string | null;
  instanceEvolutionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstanceEditDialog({
  instanceId,
  instanceName,
  instancePhoneNumber,
  instanceEvolutionId,
  open,
  onOpenChange,
}: InstanceEditDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(instanceName);
  const [phoneNumber, setPhoneNumber] = useState(instancePhoneNumber || "");
  const [evolutionId, setEvolutionId] = useState(instanceEvolutionId || "");

  useEffect(() => {
    if (open) {
      setName(instanceName);
      setPhoneNumber(instancePhoneNumber || "");
      setEvolutionId(instanceEvolutionId || "");
    }
  }, [open, instanceName, instancePhoneNumber, instanceEvolutionId]);

  const updateInstance = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({
          name: name.trim(),
          phone_number: phoneNumber.trim() || null,
          evolution_instance_id: evolutionId.trim() || null,
        } as any)
        .eq("id", instanceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast.success("Instância atualizada com sucesso!");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar instância");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Instância
          </DialogTitle>
          <DialogDescription>
            Edite as informações básicas da instância
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da Instância</Label>
            <Input
              placeholder="Ex: Vendas, Suporte..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Número de Telefone</Label>
            <Input
              placeholder="Ex: 5511999999999"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Número com código do país (ex: 5511999999999)
            </p>
          </div>

          <div className="space-y-2">
            <Label>ID da Instância (Evolution)</Label>
            <Input
              placeholder="ID na Evolution API"
              value={evolutionId}
              onChange={(e) => setEvolutionId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Identificador usado na Evolution API
            </p>
          </div>

          <Button
            onClick={() => updateInstance.mutate()}
            disabled={updateInstance.isPending || !name.trim()}
            className="w-full"
          >
            {updateInstance.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Alterações"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
