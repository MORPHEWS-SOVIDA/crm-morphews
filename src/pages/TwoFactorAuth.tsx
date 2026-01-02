import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { generateAuthCode, getSecondsUntilCodeChange } from '@/lib/auth-2fa';

export default function TwoFactorAuth() {
  const { user } = useAuth();
  const [currentCode, setCurrentCode] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [progress, setProgress] = useState(100);

  // Generate and update code
  useEffect(() => {
    if (!user?.id) return;

    const updateCode = () => {
      setCurrentCode(generateAuthCode(user.id));
      setSecondsRemaining(getSecondsUntilCodeChange());
    };

    updateCode();

    // Update every second
    const interval = setInterval(() => {
      const seconds = getSecondsUntilCodeChange();
      setSecondsRemaining(seconds);
      setProgress((seconds / 60) * 100);

      // Regenerate code when it changes
      if (seconds === 60) {
        updateCode();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user?.id]);

  // Split code for display
  const codeChars = currentCode.split('');

  return (
    <Layout>
      <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Código 2FA</h1>
            <p className="text-muted-foreground">
              Autorização para vendas abaixo do preço mínimo
            </p>
          </div>
        </div>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg text-muted-foreground">
              Seu Código Atual
            </CardTitle>
            <CardDescription>
              Compartilhe este código verbalmente com o vendedor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Code Display */}
            <div className="flex justify-center gap-3">
              {codeChars.map((char, index) => (
                <div
                  key={index}
                  className="w-16 h-20 bg-background border-2 border-primary/30 rounded-xl flex items-center justify-center text-4xl font-bold text-primary shadow-lg"
                >
                  {char}
                </div>
              ))}
            </div>

            {/* Timer */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  Novo código em <strong>{secondsRemaining}s</strong>
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Instructions */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Como funciona
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• O código muda automaticamente a cada 1 minuto</li>
                <li>• Quando um vendedor tentar vender abaixo do mínimo, ele pedirá seu código</li>
                <li>• Forneça o código verbalmente para autorizar a venda</li>
                <li>• A autorização fica registrada para auditoria</li>
              </ul>
            </div>

            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge variant="outline" className="px-4 py-2 text-sm bg-green-500/10 text-green-600 border-green-500/30">
                <Shield className="w-4 h-4 mr-2" />
                Você pode autorizar descontos
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
