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
  FileText,
  TrendingUp,
  Handshake,
  History,
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
  gradient: string;
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
    gradient: "from-blue-500 to-blue-600",
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
    gradient: "from-amber-500 to-orange-500",
    items: [
      { id: "billing", label: "Inadimplência", icon: AlertTriangle, description: "D+3, D+7, D+14" },
      { id: "coupons", label: "Cupons", icon: Tag, description: "Desconto" },
      { id: "plan-editor", label: "Planos", icon: Package, description: "Editor" },
      { id: "implementers", label: "Implementadores", icon: Handshake, description: "Parceiros revenda" },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: Store,
    color: "text-green-500",
    gradient: "from-green-500 to-emerald-500",
    items: [
      { id: "gateway-financial", label: "Receitas Gateway", icon: TrendingUp, description: "Custos e lucros" },
      { id: "gateways", label: "Gateways", icon: Wallet, description: "Pagarme, Stripe..." },
      { id: "tenant-fees", label: "Taxas Tenants", icon: Percent, description: "PIX, Cartão, Boleto" },
      { id: "landing-templates", label: "Templates LP", icon: FileText, description: "Landing Pages" },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-500",
    gradient: "from-emerald-500 to-teal-500",
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
    gradient: "from-purple-500 to-violet-500",
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
    gradient: "from-gray-500 to-gray-600",
    items: [
      { id: "communication-logs", label: "Comunicações", icon: History, description: "WhatsApp e Emails" },
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
    <div className="w-72 shrink-0">
      <div className="sticky top-24 bg-card/50 backdrop-blur-sm border rounded-2xl p-4 space-y-2 max-h-[calc(100vh-150px)] overflow-y-auto shadow-lg">
        {/* Navigation Title */}
        <div className="px-3 py-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navegação
          </h3>
        </div>

        {SUPER_ADMIN_CATEGORIES.map((category) => (
          <Collapsible
            key={category.id}
            open={expandedCategories.includes(category.id)}
            onOpenChange={() => toggleCategory(category.id)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-between px-3 py-2.5 h-auto rounded-xl transition-all duration-200",
                  expandedCategories.includes(category.id) && "bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-1.5 rounded-lg bg-gradient-to-br shadow-sm",
                    category.gradient
                  )}>
                    <category.icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-medium text-sm">{category.label}</span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    expandedCategories.includes(category.id) && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-0.5 mt-1">
              {category.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-sm transition-all duration-200 flex items-center gap-2.5 group",
                    activeTab === item.id
                      ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                      : "hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-3.5 w-3.5 transition-transform group-hover:scale-110",
                    activeTab === item.id ? "text-primary-foreground" : ""
                  )} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}

        {/* Quick Links */}
        <div className="border-t pt-4 mt-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
            Páginas Dedicadas
          </p>
          <Link
            to="/super-admin/feature-overrides"
            className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/70 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground group"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600">
              <Settings className="h-3 w-3 text-white" />
            </div>
            <span>Override de Features</span>
          </Link>
          <Link
            to="/super-admin/plan-editor"
            className="flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/70 rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground group"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500">
              <Package className="h-3 w-3 text-white" />
            </div>
            <span>Editor de Planos</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export { SUPER_ADMIN_CATEGORIES };
