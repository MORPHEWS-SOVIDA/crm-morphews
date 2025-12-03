import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageCircle, Home, RefreshCw, Mail } from "lucide-react";
import logoMorphews from "@/assets/logo-morphews.png";

const AuthError = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const getErrorMessage = () => {
    if (error === 'access_denied' || errorDescription?.includes('expired')) {
      return {
        title: "Link Expirado",
        description: "Este link já foi utilizado ou expirou. Links de recuperação de senha são válidos por apenas 24 horas e podem ser usados uma única vez."
      };
    }
    if (errorDescription?.includes('invalid')) {
      return {
        title: "Link Inválido",
        description: "O link que você clicou não é válido. Isso pode acontecer se o link foi copiado incorretamente."
      };
    }
    return {
      title: "Erro de Autenticação",
      description: "Ocorreu um erro durante o processo de autenticação. Por favor, tente novamente ou entre em contato com o suporte."
    };
  };

  const { title, description } = getErrorMessage();

  const handleWhatsAppSupport = () => {
    const message = encodeURIComponent("Estou com um problema na MORPHEWS CRM, pode me ajudar?");
    window.open(`https://wa.me/5551999984646?text=${message}`, "_blank");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={logoMorphews} 
            alt="Morphews CRM" 
            className="h-16 w-auto"
          />
        </div>

        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <Mail className="h-10 w-10 text-destructive" />
          </div>
        </div>

        {/* Error Content */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => window.location.href = "/forgot-password"}
            className="w-full"
            size="lg"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Solicitar Novo Link
          </Button>
          
          <Button 
            onClick={() => window.location.href = "/"}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Home className="mr-2 h-4 w-4" />
            Ir para o Início
          </Button>

          <Button 
            onClick={handleWhatsAppSupport}
            variant="secondary"
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Preciso de Ajuda via WhatsApp
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground pt-4">
          © {new Date().getFullYear()} Morphews CRM. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default AuthError;
