import { Calendar, Link2, Unlink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { toast } from '@/hooks/use-toast';

export function GoogleCalendarConnect() {
  const { isConnected, isLoading, connect, disconnect } = useGoogleCalendar();

  const handleConnect = async () => {
    try {
      await connect();
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível conectar ao Google Calendar',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: 'Desconectado',
        description: 'Google Calendar desconectado com sucesso',
      });
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível desconectar',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Verificando conexão...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <span className="font-medium">Google Calendar</span>
      </div>
      
      {isConnected ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Conectado
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="gap-2"
          >
            <Unlink className="w-4 h-4" />
            Desconectar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={handleConnect}
          className="gap-2"
        >
          <Link2 className="w-4 h-4" />
          Conectar
        </Button>
      )}
    </div>
  );
}
