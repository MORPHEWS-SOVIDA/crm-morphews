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
  Phone,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
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
  path: string;
}

// URL mapping for tabs to paths
const TAB_TO_PATH: Record<string, string> = {
  "organizations": "/super-admin/organizacoes",
  "interested": "/super-admin/quiz",
  "all-users": "/super-admin/usuarios",
  "billing": "/super-admin/billing/inadimplencia",
  "coupons": "/super-admin/billing/cupons",
  "plan-editor": "/super-admin/billing/planos",
  "implementers": "/super-admin/billing/implementadores",
  "gateway-financial": "/super-admin/ecommerce/receitas-gateway",
  "gateways": "/super-admin/ecommerce/gateways",
  "tenant-fees": "/super-admin/ecommerce/taxas-tenants",
  "landing-templates": "/super-admin/ecommerce/templates-lp",
  "whatsapp": "/super-admin/whatsapp/creditos",
  "providers": "/super-admin/whatsapp/provedores",
  "admin-whatsapp": "/super-admin/whatsapp/admin-instance",
  "sms": "/super-admin/sms",
  "energy": "/super-admin/ia/energia-ia",
  "ai-costs": "/super-admin/ia/custos-modelos",
  "secretary-messages": "/super-admin/ia/secretaria",
  "helper-donna": "/super-admin/ia/donna",
  "voice-ai": "/super-admin/ia/voice-ai",
  "communication-logs": "/super-admin/sistema/comunicacoes",
  "org-overrides": "/super-admin/sistema/overrides",
  "error-logs": "/super-admin/sistema/logs",
  "onboarding-emails": "/super-admin/sistema/emails",
  "cloud-costs": "/super-admin/sistema/custos-cloud",
};

// Reverse mapping from path to tab ID
const PATH_TO_TAB: Record<string, string> = Object.entries(TAB_TO_PATH).reduce(
  (acc, [tab, path]) => ({ ...acc, [path]: tab }),
  {}
);

const SUPER_ADMIN_CATEGORIES: NavCategory[] = [
  {
    id: "clientes",
    label: "Clientes",
    icon: Building2,
    color: "text-blue-500",
    gradient: "from-blue-500 to-blue-600",
    items: [
      { id: "organizations", label: "Organizações", icon: Building2, description: "Gerenciar tenants", path: "/super-admin/organizacoes" },
      { id: "interested", label: "Quiz / Leads", icon: Users, description: "Interessados", path: "/super-admin/quiz" },
      { id: "all-users", label: "Usuários", icon: Users, description: "Todos os usuários", path: "/super-admin/usuarios" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    color: "text-amber-500",
    gradient: "from-amber-500 to-orange-500",
    items: [
      { id: "billing", label: "Inadimplência", icon: AlertTriangle, description: "D+3, D+7, D+14", path: "/super-admin/billing/inadimplencia" },
      { id: "coupons", label: "Cupons", icon: Tag, description: "Desconto", path: "/super-admin/billing/cupons" },
      { id: "plan-editor", label: "Planos", icon: Package, description: "Editor", path: "/super-admin/billing/planos" },
      { id: "implementers", label: "Implementadores", icon: Handshake, description: "Parceiros revenda", path: "/super-admin/billing/implementadores" },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: Store,
    color: "text-green-500",
    gradient: "from-green-500 to-emerald-500",
    items: [
      { id: "gateway-financial", label: "Receitas Gateway", icon: TrendingUp, description: "Custos e lucros", path: "/super-admin/ecommerce/receitas-gateway" },
      { id: "gateways", label: "Gateways", icon: Wallet, description: "Pagarme, Stripe...", path: "/super-admin/ecommerce/gateways" },
      { id: "tenant-fees", label: "Taxas Tenants", icon: Percent, description: "PIX, Cartão, Boleto", path: "/super-admin/ecommerce/taxas-tenants" },
      { id: "landing-templates", label: "Templates LP", icon: FileText, description: "Landing Pages", path: "/super-admin/ecommerce/templates-lp" },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageSquare,
    color: "text-emerald-500",
    gradient: "from-emerald-500 to-teal-500",
    items: [
      { id: "whatsapp", label: "Créditos", icon: MessageSquare, description: "Instâncias grátis", path: "/super-admin/whatsapp/creditos" },
      { id: "providers", label: "Provedores", icon: Globe, description: "WaSender API", path: "/super-admin/whatsapp/provedores" },
      { id: "admin-whatsapp", label: "Admin Instance", icon: Smartphone, description: "Instância master", path: "/super-admin/whatsapp/admin-instance" },
    ],
  },
  {
    id: "sms",
    label: "SMS",
    icon: Smartphone,
    color: "text-cyan-500",
    gradient: "from-cyan-500 to-blue-500",
    items: [
      { id: "sms", label: "Gestão SMS", icon: MessageSquare, description: "Vendas e saldos", path: "/super-admin/sms" },
    ],
  },
  {
    id: "ia",
    label: "IA",
    icon: Cpu,
    color: "text-purple-500",
    gradient: "from-purple-500 to-violet-500",
    items: [
      { id: "energy", label: "Energia IA", icon: Zap, description: "Consumo por org", path: "/super-admin/ia/energia-ia" },
      { id: "ai-costs", label: "Custos Modelos", icon: Cpu, description: "Preços por token", path: "/super-admin/ia/custos-modelos" },
      { id: "secretary-messages", label: "Secretária", icon: MessageSquare, description: "Msgs automáticas", path: "/super-admin/ia/secretaria" },
      { id: "helper-donna", label: "Donna", icon: HelpCircle, description: "Conversas", path: "/super-admin/ia/donna" },
      { id: "voice-ai", label: "Voice AI", icon: Phone, description: "Ligações IA", path: "/super-admin/ia/voice-ai" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    color: "text-gray-500",
    gradient: "from-gray-500 to-gray-600",
    items: [
      { id: "communication-logs", label: "Comunicações", icon: History, description: "WhatsApp e Emails", path: "/super-admin/sistema/comunicacoes" },
      { id: "org-overrides", label: "Overrides", icon: Settings, description: "Features por org", path: "/super-admin/sistema/overrides" },
      { id: "error-logs", label: "Logs", icon: AlertTriangle, description: "Erros do sistema", path: "/super-admin/sistema/logs" },
      { id: "onboarding-emails", label: "Emails", icon: MailOpen, description: "Onboarding", path: "/super-admin/sistema/emails" },
      { id: "cloud-costs", label: "Custos Cloud", icon: AlertTriangle, description: "Gastos e otimização", path: "/super-admin/sistema/custos-cloud" },
    ],
  },
];

interface SuperAdminNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SuperAdminNavigation({ activeTab, onTabChange }: SuperAdminNavigationProps) {
  const location = useLocation();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["clientes", "billing"]);

  // Determine which category should be expanded based on current path
  useEffect(() => {
    const currentPath = location.pathname;
    for (const category of SUPER_ADMIN_CATEGORIES) {
      for (const item of category.items) {
        if (item.path === currentPath) {
          if (!expandedCategories.includes(category.id)) {
            setExpandedCategories(prev => [...prev, category.id]);
          }
          break;
        }
      }
    }
  }, [location.pathname]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const isItemActive = (item: NavItem) => {
    return location.pathname === item.path || activeTab === item.id;
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
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-sm transition-all duration-200 flex items-center gap-2.5 group block",
                    isItemActive(item)
                      ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20"
                      : "hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-3.5 w-3.5 transition-transform group-hover:scale-110",
                    isItemActive(item) ? "text-primary-foreground" : ""
                  )} />
                  <span className="truncate">{item.label}</span>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}

export { SUPER_ADMIN_CATEGORIES, TAB_TO_PATH, PATH_TO_TAB };
