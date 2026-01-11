import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, UserCheck, CheckCircle, Zap, Bot } from "lucide-react";

type StatusTab = 'with_bot' | 'pending' | 'autodistributed' | 'assigned' | 'closed';

interface ConversationStatusTabsProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  counts: {
    with_bot: number;
    pending: number;
    autodistributed: number;
    assigned: number;
    closed: number;
  };
}

const tabs: { key: StatusTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'with_bot', label: 'Com Robô', shortLabel: 'Robô', icon: Bot },
  { key: 'pending', label: 'Pendente', shortLabel: 'Pend', icon: Clock },
  { key: 'autodistributed', label: 'Pra você', shortLabel: 'P/ você', icon: Zap },
  { key: 'assigned', label: 'Atribuído', shortLabel: 'Atrib', icon: UserCheck },
  { key: 'closed', label: 'Encerrado', shortLabel: 'Enc', icon: CheckCircle },
];

export function ConversationStatusTabs({ 
  activeTab, 
  onTabChange,
  counts 
}: ConversationStatusTabsProps) {
  return (
    <div className="border-b border-border">
      <div className="grid grid-cols-3 sm:grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = counts[tab.key];
          const isActive = activeTab === tab.key;
          // Mostrar badge para Com Robô, Pendente e Autodistribuído
          const showBadge = (tab.key === 'with_bot' || tab.key === 'pending' || tab.key === 'autodistributed') && count > 0;

          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "flex items-center justify-center gap-1 py-2.5 px-2 text-xs font-medium transition-colors relative",
                isActive 
                  ? "text-primary bg-muted/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{tab.label}</span>
              {showBadge && (
                <Badge 
                  variant={isActive ? "default" : "secondary"} 
                  className={cn(
                    "h-5 min-w-[20px] px-1.5 text-[10px]",
                    tab.key === 'with_bot' && !isActive && "bg-purple-100 text-purple-800",
                    tab.key === 'with_bot' && isActive && "bg-purple-500",
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
        })}
      </div>
    </div>
  );
}
