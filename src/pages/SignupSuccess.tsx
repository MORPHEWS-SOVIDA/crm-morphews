import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, ArrowRight, MessageCircle } from "lucide-react";

export default function SignupSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

  useEffect(() => {
    // Auto redirect to login after 30 seconds
    const timer = setTimeout(() => {
      navigate("/login");
    }, 30000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500/10 via-background to-emerald-500/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Conta Criada com Sucesso! 🎉</CardTitle>
          <CardDescription className="text-base">
            Bem-vindo ao Atomic Sales
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Mail className="h-5 w-5" />
              <span className="font-medium">Verifique seu e-mail</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Enviamos suas credenciais de acesso para:
            </p>
            {email && (
              <p className="font-medium text-foreground">{email}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Você receberá uma <strong>senha temporária</strong> para fazer seu primeiro login.
            </p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              ⚠️ <strong>Importante:</strong> No primeiro acesso, você será solicitado a criar uma nova senha.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={() => navigate("/login")} 
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              Ir para Login <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Não recebeu o e-mail? Verifique a pasta de spam ou entre em contato conosco.
            </p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Próximos passos:
            </p>
            <div className="flex items-center gap-3 text-left text-sm">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <span>Acesse seu e-mail e copie a senha temporária</span>
            </div>
            <div className="flex items-center gap-3 text-left text-sm mt-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <span>Faça login com seu e-mail e senha temporária</span>
            </div>
            <div className="flex items-center gap-3 text-left text-sm mt-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <span>Crie sua nova senha e comece a usar!</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
