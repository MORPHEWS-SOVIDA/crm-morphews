import { Link } from 'react-router-dom';
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getTemplateStyles } from './templateUtils';

interface TemplatedFooterProps {
  templateSlug?: string | null;
  storeName: string;
  storefrontSlug: string;
  primaryColor?: string;
  whatsappNumber?: string | null;
  email?: string;
  address?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  showNewsletter?: boolean;
}

export function TemplatedFooter({
  templateSlug,
  storeName,
  storefrontSlug,
  primaryColor,
  whatsappNumber,
  email,
  address,
  socialLinks,
  showNewsletter = true,
}: TemplatedFooterProps) {
  const styles = getTemplateStyles(templateSlug);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted/30 border-t">
      {/* Newsletter Section */}
      {showNewsletter && (
        <div 
          className="py-12"
          style={{ backgroundColor: primaryColor ? `${primaryColor}10` : undefined }}
        >
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-2xl font-bold mb-2">
              Receba ofertas exclusivas
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Cadastre-se para receber promoções, novidades e descontos especiais.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <Input 
                type="email" 
                placeholder="Seu melhor e-mail"
                className="flex-1"
              />
              <Button 
                type="submit"
                style={{ backgroundColor: primaryColor }}
              >
                Cadastrar
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h4 
              className="text-xl font-bold"
              style={{ color: primaryColor }}
            >
              {storeName}
            </h4>
            <p className="text-sm text-muted-foreground">
              Produtos de qualidade para transformar sua vida.
            </p>
            
            {/* Social Links */}
            <div className="flex gap-4">
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
                  <Instagram className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
              {socialLinks?.facebook && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                  <Facebook className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
              {socialLinks?.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer">
                  <Youtube className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold">Navegação</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to={`/loja/${storefrontSlug}`} className="hover:text-foreground transition-colors">
                  Início
                </Link>
              </li>
              <li>
                <Link to={`/loja/${storefrontSlug}/produtos`} className="hover:text-foreground transition-colors">
                  Produtos
                </Link>
              </li>
              <li>
                <Link to={`/loja/${storefrontSlug}/sobre`} className="hover:text-foreground transition-colors">
                  Sobre Nós
                </Link>
              </li>
              <li>
                <Link to={`/loja/${storefrontSlug}/contato`} className="hover:text-foreground transition-colors">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          {/* Help */}
          <div className="space-y-4">
            <h4 className="font-semibold">Ajuda</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link to={`/loja/${storefrontSlug}/faq`} className="hover:text-foreground transition-colors">
                  Perguntas Frequentes
                </Link>
              </li>
              <li>
                <Link to={`/loja/${storefrontSlug}/envio`} className="hover:text-foreground transition-colors">
                  Política de Envio
                </Link>
              </li>
              <li>
                <Link to={`/loja/${storefrontSlug}/trocas`} className="hover:text-foreground transition-colors">
                  Trocas e Devoluções
                </Link>
              </li>
              <li>
                <Link to={`/loja/${storefrontSlug}/privacidade`} className="hover:text-foreground transition-colors">
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold">Contato</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {whatsappNumber && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <a 
                    href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    WhatsApp
                  </a>
                </li>
              )}
              {email && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a 
                    href={`mailto:${email}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {email}
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>{address}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Copyright */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {currentYear} {storeName}. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <Link to="/legal" className="hover:text-foreground transition-colors">
              Termos de Uso
            </Link>
            <Link to="/legal" className="hover:text-foreground transition-colors">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
