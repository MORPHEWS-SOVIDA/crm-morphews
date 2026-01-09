import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, UserCheck, CheckCircle, Zap } from "lucide-react";

type StatusTab = 'pending' | 'autodistributed' | 'assigned' | 'closed';

interface ConversationStatusTabsProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  counts: {
    pending: number;
    autodistributed: number;
    assigned: number;
    closed: number;
  };
}

const tabs: { key: StatusTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
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
    <div className="flex border-b border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const count = counts[tab.key];
        const isActive = activeTab === tab.key;
        // Mostrar badge apenas para Pendente e Autodistribuído
        const showBadge = (tab.key === 'pending' || tab.key === 'autodistributed') && count > 0;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-2 px-1 text-xs font-medium transition-colors relative",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline truncate">{tab.label}</span>
            <span className="sm:hidden truncate">{tab.shortLabel}</span>
            {showBadge && (
              <Badge 
                variant={isActive ? "default" : "secondary"} 
                className={cn(
                  "h-5 min-w-[20px] px-1.5 text-[10px]",
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
  );
}
