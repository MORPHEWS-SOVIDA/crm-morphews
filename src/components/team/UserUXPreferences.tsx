import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, PanelLeftClose } from 'lucide-react';

interface UserUXPreferencesProps {
  defaultLandingPage: string;
  hideSidebar: boolean;
  onLandingPageChange: (value: string) => void;
  onHideSidebarChange: (value: boolean) => void;
}

// Opções de página inicial disponíveis
export const LANDING_PAGE_OPTIONS = [
  { value: '/dashboard', label: 'Dashboard', description: 'Painel geral com funil e leads' },
  { value: '/leads', label: 'Lista de Leads', description: 'Todos os leads da empresa' },
  { value: '/vendas', label: 'Vendas', description: 'Lista de vendas' },
  { value: '/dashboard-vendas', label: 'Dashboard de Vendas', description: 'Ranking e corrida de vendas' },
  { value: '/add-receptivo', label: 'Add Receptivo', description: 'Cadastro rápido de atendimento' },
  { value: '/expedicao', label: 'Expedição', description: 'Central de expedição' },
  { value: '/minhas-entregas', label: 'Minhas Entregas', description: 'Entregas atribuídas ao usuário' },
  { value: '/financeiro', label: 'Financeiro', description: 'Módulo financeiro' },
  { value: '/pos-venda', label: 'Pós-Venda', description: 'Kanban de pós-venda' },
  { value: '/whatsapp', label: 'WhatsApp', description: 'Chat WhatsApp' },
  { value: '/demandas', label: 'Demandas', description: 'Quadro de demandas/tarefas' },
];

export function UserUXPreferences({
  defaultLandingPage,
  hideSidebar,
  onLandingPageChange,
  onHideSidebarChange,
}: UserUXPreferencesProps) {
  return (
    <div className="border-t pt-4 space-y-4">
      <h4 className="font-medium mb-4 text-primary flex items-center gap-2">
        <Home className="w-4 h-4" />
        Experiência do Usuário
      </h4>
      
      {/* Página Inicial */}
      <div className="space-y-2">
        <Label>Página Inicial ao Fazer Login</Label>
        <Select value={defaultLandingPage || '/dashboard'} onValueChange={onLandingPageChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a página inicial" />
          </SelectTrigger>
          <SelectContent>
            {LANDING_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Ao fazer login, o usuário será redirecionado diretamente para esta página.
        </p>
      </div>

      {/* Esconder Menu */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-medium">
            <PanelLeftClose className="w-4 h-4" />
            Esconder Menu Lateral
          </div>
          <p className="text-xs text-muted-foreground">
            Remove o menu para maximizar espaço de trabalho. Ideal para expedição/motoboy.
          </p>
        </div>
        <Switch
          checked={hideSidebar}
          onCheckedChange={onHideSidebarChange}
        />
      </div>
    </div>
  );
}
