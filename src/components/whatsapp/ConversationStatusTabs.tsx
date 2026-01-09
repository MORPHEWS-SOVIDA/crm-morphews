import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, UserCheck, CheckCircle } from "lucide-react";

type StatusTab = 'pending' | 'assigned' | 'closed';

interface ConversationStatusTabsProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  counts: {
    pending: number;
    assigned: number;
    closed: number;
  };
}

const tabs: { key: StatusTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'pending', label: 'Pendente', icon: Clock },
  { key: 'assigned', label: 'Atribuído', icon: UserCheck },
  { key: 'closed', label: 'Encerrado', icon: CheckCircle },
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

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-medium transition-colors relative",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            {count > 0 && (
              <Badge 
                variant={isActive ? "default" : "secondary"} 
                className={cn(
                  "h-5 min-w-[20px] px-1.5 text-[10px]",
                  tab.key === 'pending' && count > 0 && !isActive && "bg-yellow-100 text-yellow-800",
                  tab.key === 'pending' && count > 0 && isActive && "bg-yellow-500"
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
