import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Database, Shield, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export function DataBackupManager() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Você precisa estar logado para exportar dados');
      }

      const response = await supabase.functions.invoke('tenant-data-backup', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao exportar dados');
      }

      // Create and download the file
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Backup exportado com sucesso!',
        description: `${response.data.summary?.total_leads || 0} leads, ${response.data.summary?.total_sales || 0} vendas exportados.`,
      });

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Erro ao exportar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Seus dados estão protegidos</AlertTitle>
        <AlertDescription>
          Todos os dados são armazenados com criptografia e isolamento por empresa (tenant).
          Backups automáticos são feitos diariamente na infraestrutura. 
          Recomendamos que você também faça backups manuais periodicamente.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-500">Responsabilidade compartilhada</AlertTitle>
        <AlertDescription className="text-amber-200/80">
          Ao utilizar o sistema, você concorda que é responsável por manter cópias de segurança 
          dos seus dados. Recomendamos exportar semanalmente ou após grandes atualizações.
        </AlertDescription>
      </Alert>

      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-sm">O que será exportado:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Todos os leads e endereços</li>
          <li>• Todas as vendas, itens e pagamentos</li>
          <li>• Produtos cadastrados</li>
          <li>• Membros da equipe</li>
          <li>• Conversas e mensagens do WhatsApp (últimas 10.000)</li>
          <li>• Pesquisas pós-venda</li>
          <li>• Tickets SAC</li>
          <li>• Histórico de etapas dos leads</li>
          <li>• Mensagens agendadas</li>
          <li>• Contatos</li>
        </ul>
      </div>

      <Button 
        onClick={handleExportData} 
        disabled={isExporting}
        className="w-full"
        size="lg"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Exportando dados...
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Baixar Backup Completo (JSON)
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        O arquivo será baixado em formato JSON, que pode ser aberto em editores de texto 
        ou importado em outras ferramentas.
      </p>
    </div>
  );
}
