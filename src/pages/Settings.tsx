import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Instagram, Bell, Users } from 'lucide-react';

export default function Settings() {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas integrações e preferências
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Google Calendar Integration */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Calendar className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Google Calendar</h2>
                <p className="text-sm text-muted-foreground">Sincronize suas calls e reuniões</p>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-primary/10 border border-blue-500/20 mb-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Em desenvolvimento:</span> A integração com Google Calendar estará disponível em breve. Você poderá ver e criar eventos diretamente do CRM.
              </p>
            </div>

            <Button disabled className="w-full">
              Conectar Google Calendar
            </Button>
          </div>

          {/* Instagram Integration */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-pink-500/10">
                <Instagram className="w-6 h-6 text-pink-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Instagram DMs</h2>
                <p className="text-sm text-muted-foreground">Veja suas mensagens no CRM</p>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 mb-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">Em desenvolvimento:</span> A integração com Instagram permitirá ver e responder DMs diretamente do CRM, sem precisar trocar de aplicativo.
              </p>
            </div>

            <Button disabled className="w-full">
              Conectar Instagram
            </Button>
          </div>

          {/* Notifications */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-funnel-convincing/20">
                <Bell className="w-6 h-6 text-funnel-convincing-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Notificações</h2>
                <p className="text-sm text-muted-foreground">Configure seus alertas</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novos leads</p>
                  <p className="text-sm text-muted-foreground">Receber alerta de novos leads</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Calls agendadas</p>
                  <p className="text-sm text-muted-foreground">Lembrete antes das calls</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Pagamentos recebidos</p>
                  <p className="text-sm text-muted-foreground">Alerta de pagamentos</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Equipe</h2>
                <p className="text-sm text-muted-foreground">Gerencie os membros</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Adicionar membro</Label>
                <div className="flex gap-2">
                  <Input placeholder="email@exemplo.com" />
                  <Button>Convidar</Button>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-sm font-medium text-foreground mb-3">Membros atuais</p>
                <div className="space-y-2">
                  {['Maria', 'João', 'Pedro'].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                          {name[0]}
                        </div>
                        <span className="font-medium">{name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Vendedor</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
