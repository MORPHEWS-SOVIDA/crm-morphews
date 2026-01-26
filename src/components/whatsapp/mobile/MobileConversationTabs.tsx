import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock, UserCheck, CheckCircle, Zap, Bot, Users } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type StatusTab = 'all' | 'with_bot' | 'pending' | 'groups' | 'autodistributed' | 'assigned' | 'closed';

interface MobileConversationTabsProps {
  activeTab: StatusTab;
  onTabChange: (tab: StatusTab) => void;
  counts: {
    all: number;
    with_bot: number;
    pending: number;
    groups: number;
    autodistributed: number;
    assigned: number;
    closed: number;
  };
}

const tabs: { key: StatusTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> | null; color: string }[] = [
  { key: 'all', label: 'Todas', shortLabel: 'Todas', icon: null, color: 'bg-gray-500' },
  { key: 'with_bot', label: 'Com Robô', shortLabel: '🤖', icon: Bot, color: 'bg-purple-500' },
  { key: 'pending', label: 'Pendente', shortLabel: '⏳', icon: Clock, color: 'bg-yellow-500' },
  { key: 'autodistributed', label: 'Pra você', shortLabel: '⚡', icon: Zap, color: 'bg-blue-500' },
  { key: 'assigned', label: 'Atribuído', shortLabel: '✓', icon: UserCheck, color: 'bg-green-500' },
  { key: 'groups', label: 'Grupos', shortLabel: '👥', icon: Users, color: 'bg-emerald-500' },
  { key: 'closed', label: 'Encerrado', shortLabel: '✔️', icon: CheckCircle, color: 'bg-gray-400' },
];

export function MobileConversationTabs({ 
  activeTab, 
  onTabChange,
  counts 
}: MobileConversationTabsProps) {
  return (
    <div className="border-b border-border bg-background">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-1 p-2">
          {tabs.map((tab) => {
            const count = counts[tab.key];
            const isActive = activeTab === tab.key;
            const showBadge = count > 0 && tab.key !== 'all';
            const hasUrgentNotification = (tab.key === 'pending' || tab.key === 'autodistributed' || tab.key === 'with_bot') && count > 0;

            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                {tab.icon && (
                  <tab.icon className={cn(
                    "h-3.5 w-3.5",
                    isActive && tab.key === 'with_bot' && "text-purple-200",
                    isActive && tab.key === 'pending' && "text-yellow-200",
                    isActive && tab.key === 'autodistributed' && "text-blue-200",
                    isActive && tab.key === 'assigned' && "text-green-200",
                    isActive && tab.key === 'groups' && "text-emerald-200",
                  )} />
                )}
                <span>{tab.label}</span>
                {showBadge && (
                  <Badge 
                    variant="secondary"
                    className={cn(
                      "h-5 min-w-[20px] px-1.5 text-[10px] font-bold",
                      isActive 
                        ? "bg-white/20 text-primary-foreground" 
                        : hasUrgentNotification 
                          ? cn(tab.color, "text-white animate-pulse")
                          : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {count > 99 ? '99+' : count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
}
