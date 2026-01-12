import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, UserCheck, CheckCircle, Zap, Bot, Users } from "lucide-react";

type StatusTab = 'with_bot' | 'pending' | 'groups' | 'autodistributed' | 'assigned' | 'closed';

interface ConversationStatusTabsProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  counts: {
    with_bot: number;
    pending: number;
    groups: number;
    autodistributed: number;
    assigned: number;
    closed: number;
  };
}

const tabs: { key: StatusTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'with_bot', label: 'Com Robô', icon: Bot },
  { key: 'pending', label: 'Pendente', icon: Clock },
  { key: 'groups', label: 'Grupos', icon: Users },
  { key: 'autodistributed', label: 'Pra você', icon: Zap },
  { key: 'assigned', label: 'Atribuído', icon: UserCheck },
  { key: 'closed', label: 'Encerrado', icon: CheckCircle },
];

export function ConversationStatusTabs({ 
  activeTab, 
  onTabChange,
  counts 
}: ConversationStatusTabsProps) {
  // Dividir em 2 linhas de 3: Com Robô/Pendente/Grupos e Pra você/Atribuído/Encerrado
  const firstRow = tabs.slice(0, 3);
  const secondRow = tabs.slice(3);

  const renderTab = (tab: typeof tabs[0]) => {
    const Icon = tab.icon;
    const count = counts[tab.key];
    const isActive = activeTab === tab.key;
    const showBadge = (tab.key === 'with_bot' || tab.key === 'pending' || tab.key === 'groups' || tab.key === 'autodistributed') && count > 0;

    return (
      <button
        key={tab.key}
        onClick={() => onTabChange(tab.key)}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium transition-colors relative min-w-0",
          isActive 
            ? "text-primary bg-muted/50" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{tab.label}</span>
        {showBadge && (
          <Badge 
            variant={isActive ? "default" : "secondary"} 
            className={cn(
              "h-5 min-w-[20px] px-1.5 text-[10px] flex-shrink-0",
              tab.key === 'with_bot' && !isActive && "bg-purple-100 text-purple-800",
              tab.key === 'with_bot' && isActive && "bg-purple-500",
              tab.key === 'groups' && !isActive && "bg-emerald-100 text-emerald-800",
              tab.key === 'groups' && isActive && "bg-emerald-500",
              tab.key === 'autodistributed' && !isActive && "bg-blue-100 text-blue-800",
              tab.key === 'autodistributed' && isActive && "bg-blue-500",
              tab.key === 'pending' && !isActive && "bg-yellow-100 text-yellow-800",
              tab.key === 'pending' && isActive && "bg-yellow-500"
            )}
          >
            {count}
          </Badge>
        )}
        {isActive && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
        )}
      </button>
    );
  };

  return (
    <div className="border-b border-border">
      {/* Primeira linha: Com Robô, Pendente, Grupos */}
      <div className="flex border-b border-border/50">
        {firstRow.map(renderTab)}
      </div>
      {/* Segunda linha: Pra você, Atribuído, Encerrado */}
      <div className="flex">
        {secondRow.map(renderTab)}
      </div>
    </div>
  );
}
