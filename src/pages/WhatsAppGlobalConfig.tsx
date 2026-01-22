import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WhatsAppAISettingsManager } from "@/components/settings/WhatsAppAISettingsManager";

export default function WhatsAppGlobalConfig() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary" />
              Configurações Globais
            </h1>
            <p className="text-muted-foreground">
              IA e Automação do WhatsApp
            </p>
          </div>
        </div>

        {/* Settings Content */}
        <div className="bg-card border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">IA do WhatsApp (Global)</h2>
              <p className="text-sm text-muted-foreground">
                Configurações de IA e automação aplicadas a todas as instâncias
              </p>
            </div>
          </div>
          
          <WhatsAppAISettingsManager />
        </div>
      </div>
    </Layout>
  );
}
