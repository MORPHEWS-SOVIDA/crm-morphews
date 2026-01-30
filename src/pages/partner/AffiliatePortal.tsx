import { useState } from 'react';
import { 
  Link2, 
  Copy, 
  ExternalLink, 
  Check, 
  ShoppingBag, 
  FileText,
  Wallet,
  Clock,
  Share2,
  TrendingUp,
  ChevronRight,
  BarChart3,
  LogOut,
  User,
  Store
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useAffiliateAvailableOffers, useMyAffiliateCode, type AvailableOffer } from '@/hooks/ecommerce/useAffiliateLinks';
import { useMyPartnerAssociations } from '@/hooks/ecommerce/usePartners';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function QuickCopyCard({ offer }: { offer: AvailableOffer }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!offer.affiliate_link) return;
    await navigator.clipboard.writeText(offer.affiliate_link);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!offer.affiliate_link) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: offer.name,
          text: `Confira: ${offer.product_name || offer.name}`,
          url: offer.affiliate_link,
        });
      } catch (e) {
        // User cancelled or error
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Product Image */}
          {offer.product_image ? (
            <img
              src={offer.product_image}
              alt={offer.product_name || offer.name}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
              {offer.type === 'storefront' ? (
                <Store className="h-7 w-7 text-primary/60" />
              ) : offer.type === 'checkout' ? (
                <ShoppingBag className="h-7 w-7 text-primary/60" />
              ) : (
                <FileText className="h-7 w-7 text-primary/60" />
              )}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{offer.name}</h3>
              <Badge variant="secondary" className="text-xs flex-shrink-0 capitalize">
                {offer.type === 'storefront' ? 'Loja' : offer.type === 'checkout' ? 'Checkout' : 'Landing'}
              </Badge>
            </div>
            
            {offer.product_name && (
              <p className="text-sm text-muted-foreground truncate mb-2">
                {offer.product_name}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 h-9"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copiar
                  </>
                )}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-9"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                className="h-9"
                onClick={() => window.open(offer.affiliate_link, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NavItem({ 
  icon: Icon, 
  label, 
  onClick, 
  active = false,
  badge
}: { 
  icon: any; 
  label: string; 
  onClick: () => void;
  active?: boolean;
  badge?: string | number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all",
        active 
          ? "bg-primary text-primary-foreground" 
          : "bg-card hover:bg-accent"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && (
          <Badge variant={active ? "secondary" : "outline"} className="text-xs">
            {badge}
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 opacity-50" />
      </div>
    </button>
  );
}

export default function AffiliatePortal() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: offers, isLoading: offersLoading } = useAffiliateAvailableOffers();
  const { data: associations, isLoading: associationsLoading } = useMyPartnerAssociations();
  const { data: affiliateCodeData, isLoading: codeLoading } = useMyAffiliateCode();

  const isLoading = offersLoading || associationsLoading || codeLoading;

  const enrolledOffers = offers?.filter(o => o.is_enrolled && o.affiliate_link) || [];
  
  // Calculate totals from associations
  const totalBalance = associations?.reduce(
    (sum, a) => sum + (a.virtual_account?.balance_cents || 0),
    0
  ) || 0;
  
  const totalPending = associations?.reduce(
    (sum, a) => sum + (a.virtual_account?.pending_balance_cents || 0),
    0
  ) || 0;
  const affiliateCode = affiliateCodeData?.code || associations?.find(a => a.affiliate_code)?.affiliate_code;
  const userName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : affiliateCodeData?.name || 'Afiliado';
  const userInitials = userName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-bold text-lg">Olá, {userName.split(' ')[0]}! 👋</h1>
              {affiliateCode && (
                <p className="text-sm text-muted-foreground font-mono">
                  Código: {affiliateCode}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-gradient-to-br from-green-500/15 to-green-500/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground">Disponível</span>
              </div>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalBalance)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-muted-foreground">Pendente</span>
              </div>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Seus Links de Divulgação
            </h2>
            <Badge variant="outline">{enrolledOffers.length} links</Badge>
          </div>

          {enrolledOffers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">Nenhum link disponível</h3>
                <p className="text-sm text-muted-foreground">
                  Entre em contato com o administrador para ser vinculado a produtos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {enrolledOffers.map((offer) => (
                <QuickCopyCard key={offer.id} offer={offer} />
              ))}
            </div>
          )}
        </div>

        {/* How it works - Compact */}
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Como Funciona
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
              <div className="flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-1">1</div>
                <span>Copie o link</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-30" />
              <div className="flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-1">2</div>
                <span>Divulgue</span>
              </div>
              <ChevronRight className="h-4 w-4 opacity-30" />
              <div className="flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold mb-1">3</div>
                <span>Ganhe!</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="space-y-2">
          <NavItem 
            icon={BarChart3} 
            label="Minhas Vendas" 
            onClick={() => navigate('/ecommerce/vendas')}
          />
          <NavItem 
            icon={ShoppingBag} 
            label="Carrinhos Abandonados" 
            onClick={() => navigate('/ecommerce/carrinhos')}
          />
          <NavItem 
            icon={Wallet} 
            label="Minha Carteira" 
            badge={totalBalance > 0 ? formatCurrency(totalBalance) : undefined}
            onClick={() => navigate('/ecommerce/carteira')}
          />
          <NavItem 
            icon={User} 
            label="Meu Perfil" 
            onClick={() => navigate('/perfil')}
          />
        </div>

      </div>
    </div>
  );
}
