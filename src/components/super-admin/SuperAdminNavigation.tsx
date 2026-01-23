import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  CreditCard,
  Tag,
  Package,
  Wallet,
  Percent,
  MessageSquare,
  Globe,
  Smartphone,
  Zap,
  Cpu,
  Settings,
  AlertTriangle,
  MailOpen,
  HelpCircle,
  Store,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  description?: string;
}

const SUPER_ADMIN_CATEGORIES: NavCategory[] = [
  {
    id: "clientes",
    label: "Clientes",
    icon: Building2,
    color: "text-blue-500",
    items: [
      { id: "organizations", label: "Organizações", icon: Building2, description: "Gerenciar tenants" },
      { id: "interested", label: "Quiz / Leads", icon: Users, description: "Interessados" },
      { id: "all-users", label: "Usuários", icon: Users, description: "Todos os usuários" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    color: "text-amber-500",
    items: [
      { id: "billing", label: "Inadimplência", icon: AlertTriangle, description: "D+3, D+7, D+14" },
      { id: "coupons", label: "Cupons", icon: Tag, description: "Desconto" },
      { id: "plan-editor", label: "Planos", icon: Package, description: "Editor" },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: Store,
    color: "text-green-500",
    items: [
      { id: "gateways", label: "Gateways", icon: Wallet, description: "Pagarme, Stripe..." },
      { id: "tenant-fees", label: "Taxas Tenants", icon: Percent, description: "PIX, Cartão, Boleto" },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-500",
    items: [
      { id: "whatsapp", label: "Créditos", icon: MessageSquare, description: "Instâncias grátis" },
      { id: "providers", label: "Provedores", icon: Globe, description: "WaSender API" },
      { id: "admin-whatsapp", label: "Admin Instance", icon: Smartphone, description: "Instância master" },
    ],
  },
  {
    id: "ia",
    label: "IA",
    icon: Cpu,
    color: "text-purple-500",
    items: [
      { id: "energy", label: "Energia IA", icon: Zap, description: "Consumo por org" },
      { id: "ai-costs", label: "Custos Modelos", icon: Cpu, description: "Preços por token" },
      { id: "secretary-messages", label: "Secretária", icon: MessageSquare, description: "Msgs automáticas" },
      { id: "helper-donna", label: "Donna", icon: HelpCircle, description: "Conversas" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    color: "text-gray-500",
    items: [
      { id: "org-overrides", label: "Overrides", icon: Settings, description: "Features por org" },
      { id: "error-logs", label: "Logs", icon: AlertTriangle, description: "Erros do sistema" },
      { id: "onboarding-emails", label: "Emails", icon: MailOpen, description: "Onboarding" },
    ],
  },
];

interface SuperAdminNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SuperAdminNavigation({ activeTab, onTabChange }: SuperAdminNavigationProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["clientes", "billing"]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <div className="w-64 border-r bg-card/50 p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
      {SUPER_ADMIN_CATEGORIES.map((category) => (
        <Collapsible
          key={category.id}
          open={expandedCategories.includes(category.id)}
          onOpenChange={() => toggleCategory(category.id)}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-3 py-2 h-auto"
            >
              <div className="flex items-center gap-2">
                <category.icon className={cn("h-4 w-4", category.color)} />
                <span className="font-medium text-sm">{category.label}</span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expandedCategories.includes(category.id) && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pl-6 space-y-1 mt-1">
            {category.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* Quick Links */}
      <div className="border-t pt-4 mt-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground px-3 uppercase">
          Páginas Dedicadas
        </p>
        <Link
          to="/super-admin/feature-overrides"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Override de Features
        </Link>
        <Link
          to="/super-admin/plan-editor"
          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
        >
          <Package className="h-3.5 w-3.5" />
          Editor de Planos
        </Link>
      </div>
    </div>
  );
}

export { SUPER_ADMIN_CATEGORIES };
