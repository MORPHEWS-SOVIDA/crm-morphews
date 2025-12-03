import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Home, ArrowLeft } from "lucide-react";
import logoMorphews from "@/assets/logo-morphews.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleWhatsAppSupport = () => {
    const message = encodeURIComponent("Estou com um problema na MORPHEWS CRM, pode me ajudar?");
    window.open(`https://wa.me/5551999984646?text=${message}`, "_blank");
  };

  // Check if this might be an auth error
  const isAuthError = location.search.includes('error=') || 
                      location.pathname.includes('auth') ||
                      location.hash.includes('error');

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

        {/* Error Content */}
        <div className="space-y-4">
          <div className="text-8xl font-bold text-primary/20">
            {isAuthError ? "!" : "404"}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isAuthError ? "Ops! Algo deu errado" : "Página não encontrada"}
          </h1>
          <p className="text-muted-foreground">
            {isAuthError 
              ? "O link pode ter expirado ou já foi utilizado. Por favor, solicite um novo link ou entre em contato com o suporte."
              : "A página que você está procurando não existe ou foi movida."
            }
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button 
            onClick={() => window.location.href = "/"}
            className="w-full"
            size="lg"
          >
            <Home className="mr-2 h-4 w-4" />
            Ir para o Início
          </Button>
          
          {isAuthError && (
            <Button 
              onClick={() => window.location.href = "/forgot-password"}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Solicitar novo link
            </Button>
          )}

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

export default NotFound;
