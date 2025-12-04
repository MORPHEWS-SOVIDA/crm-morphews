import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Instagram, Bell, Users, Tag, Package, Plus, X, Loader2, Lock, Eye, EyeOff, User, Phone, Save } from 'lucide-react';
import { useLeadSources, useLeadProducts, useCreateLeadSource, useCreateLeadProduct, useDeleteLeadSource, useDeleteLeadProduct } from '@/hooks/useConfigOptions';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { profile, updatePassword, user } = useAuth();
  const { data: leadSources = [], isLoading: loadingSources } = useLeadSources();
  const { data: leadProducts = [], isLoading: loadingProducts } = useLeadProducts();
  const createSource = useCreateLeadSource();
  const createProduct = useCreateLeadProduct();
  const deleteSource = useDeleteLeadSource();
  const deleteProduct = useDeleteLeadProduct();

  const [newSource, setNewSource] = useState('');
  const [newProduct, setNewProduct] = useState('');
  
  // Profile edit state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    whatsapp: '',
    instagram: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load profile data
  useEffect(() => {
    if (profile) {
      setProfileData({
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        whatsapp: profile.whatsapp || '',
        instagram: profile.instagram || '',
      });
    }
  }, [profile]);

  const handleAddSource = async () => {
    if (!newSource.trim()) return;
    try {
      await createSource.mutateAsync(newSource.trim());
      setNewSource('');
      toast({ title: 'Origem adicionada com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.trim()) return;
    try {
      await createProduct.mutateAsync(newProduct.trim());
      setNewProduct('');
      toast({ title: 'Produto adicionado com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    
    const cleanWhatsapp = profileData.whatsapp.replace(/\D/g, '');
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          whatsapp: cleanWhatsapp || null,
          instagram: profileData.instagram || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Perfil atualizado!',
        description: 'Suas informações foram salvas.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar perfil',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteSource.mutateAsync(id);
      toast({ title: 'Origem removida!' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast({ title: 'Produto removido!' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A nova senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      
      toast({
        title: 'Senha alterada!',
        description: 'Sua senha foi atualizada com sucesso.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

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

        {/* My Profile */}
        <div className="bg-card rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Meu Perfil</h2>
              <p className="text-sm text-muted-foreground">Edite suas informações pessoais</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-whatsapp" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                WhatsApp *
              </Label>
              <Input
                id="profile-whatsapp"
                type="tel"
                placeholder="5511999999999"
                value={profileData.whatsapp}
                onChange={(e) => setProfileData({ ...profileData, whatsapp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-instagram" className="flex items-center gap-2">
                <Instagram className="w-4 h-4" />
                Instagram
              </Label>
              <Input
                id="profile-instagram"
                placeholder="seu_usuario"
                value={profileData.instagram}
                onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value })}
              />
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            * WhatsApp obrigatório para usar o assistente via WhatsApp (formato: 5511999999999)
          </p>

          <Button 
            onClick={handleSaveProfile} 
            disabled={isSavingProfile}
            className="mt-4"
          >
            {isSavingProfile ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Perfil
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Sources Configuration */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Tag className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Origens de Lead</h2>
                <p className="text-sm text-muted-foreground">Canais de aquisição</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nova origem..."
                  value={newSource}
                  onChange={(e) => setNewSource(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                />
                <Button onClick={handleAddSource} disabled={createSource.isPending}>
                  {createSource.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-auto">
                {loadingSources ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  leadSources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium">{source.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteSource(source.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Lead Products Configuration */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-funnel-success/20">
                <Package className="w-6 h-6 text-funnel-success-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Produtos</h2>
                <p className="text-sm text-muted-foreground">Produtos negociados</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Novo produto..."
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                />
                <Button onClick={handleAddProduct} disabled={createProduct.isPending}>
                  {createProduct.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-auto">
                {loadingProducts ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  leadProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium">{product.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
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

          {/* Change Password */}
          <div className="bg-card rounded-xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <Lock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Alterar Senha</h2>
                <p className="text-sm text-muted-foreground">Mantenha sua conta segura</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleChangePassword} 
                disabled={isChangingPassword || !newPassword || !confirmPassword}
                className="w-full"
              >
                {isChangingPassword ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Alterar Senha
              </Button>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
