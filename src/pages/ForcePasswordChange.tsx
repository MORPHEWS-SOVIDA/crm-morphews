import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from "lucide-react";
import logo from "@/assets/logo-morphews.png";

export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password validation rules
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecial;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      toast({
        title: "Senha inválida",
        description: "Sua senha não atende aos requisitos de segurança.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Senhas não coincidem",
        description: "A confirmação da senha deve ser igual à senha.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      // Clear the temp password flag from localStorage
      localStorage.removeItem("requirePasswordChange");

      // Mark the temp password as used
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        await supabase
          .from("temp_password_resets")
          .update({ used_at: new Date().toISOString() })
          .eq("email", user.email.toLowerCase())
          .is("used_at", null);
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Você será redirecionado para o dashboard.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const ValidationItem = ({ valid, text }: { valid: boolean; text: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {valid ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={valid ? "text-green-600" : "text-muted-foreground"}>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logo} alt="Morphews CRM" className="h-12" />
          </div>
          <div>
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Lock className="h-6 w-6 text-primary" />
              Criar Nova Senha
            </CardTitle>
            <CardDescription className="mt-2">
              Por segurança, você precisa criar uma nova senha antes de continuar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Password requirements */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium mb-2">Requisitos da senha:</p>
              <ValidationItem valid={hasMinLength} text="Mínimo 8 caracteres" />
              <ValidationItem valid={hasUppercase} text="Pelo menos uma letra maiúscula" />
              <ValidationItem valid={hasLowercase} text="Pelo menos uma letra minúscula" />
              <ValidationItem valid={hasNumber} text="Pelo menos um número" />
              <ValidationItem valid={hasSpecial} text="Pelo menos um caractere especial (!@#$%^&*)" />
              <ValidationItem valid={passwordsMatch} text="Senhas coincidem" />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
            >
              {isLoading ? "Salvando..." : "Salvar Nova Senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
