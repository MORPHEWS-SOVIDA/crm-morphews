import { Instagram, Lock } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InstagramDMs() {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Instagram DMs</h1>
          <p className="text-muted-foreground mt-1">
            Veja e responda mensagens do Instagram diretamente do CRM
          </p>
        </div>

        {/* Coming Soon Card */}
        <div className="bg-card rounded-xl p-8 shadow-card text-center max-w-2xl mx-auto">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
            <Instagram className="w-10 h-10 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Integração Instagram em Desenvolvimento
          </h2>
          
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Em breve você poderá conectar sua conta do Instagram e ver todas as suas DMs 
            diretamente aqui no CRM, sem precisar trocar de aplicativo.
          </p>

          <div className="bg-muted/50 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Lock className="w-4 h-4" />
              <span>Prévia da funcionalidade</span>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ig-user">Usuário do Instagram</Label>
                <Input
                  id="ig-user"
                  placeholder="@seu_perfil"
                  disabled
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="ig-pass">Senha</Label>
                <Input
                  id="ig-pass"
                  type="password"
                  placeholder="••••••••"
                  disabled
                />
              </div>
            </div>
          </div>

          <Button disabled size="lg" className="w-full max-w-xs">
            Conectar Instagram
          </Button>

          <p className="text-xs text-muted-foreground mt-4">
            Suas credenciais serão criptografadas e armazenadas com segurança.
          </p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { title: 'Ver todas as DMs', desc: 'Acesse suas conversas em um só lugar' },
            { title: 'Responder rapidamente', desc: 'Responda sem sair do CRM' },
            { title: 'Vincular a leads', desc: 'Associe conversas aos seus leads' },
          ].map((feature, i) => (
            <div key={i} className="bg-card rounded-lg p-4 shadow-card text-center">
              <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
