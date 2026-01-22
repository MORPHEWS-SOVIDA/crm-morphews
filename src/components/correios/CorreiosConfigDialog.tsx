import { useState, useEffect } from 'react';
import { Loader2, Save, TestTube, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  useCorreiosConfig,
  useSaveCorreiosConfig,
  useTestCorreiosConnection,
  useCorreiosServices,
} from '@/hooks/useCorreiosIntegration';
import { ShippingServicesConfig } from '@/components/shipping/ShippingServicesConfig';

interface CorreiosConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CorreiosConfigDialog({ open, onOpenChange }: CorreiosConfigDialogProps) {
  const { data: config, isLoading } = useCorreiosConfig();
  const { data: services } = useCorreiosServices();
  const saveConfig = useSaveCorreiosConfig();
  const testConnection = useTestCorreiosConnection();

  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('credentials');
  
  const [formData, setFormData] = useState({
    is_active: false,
    ambiente: 'HOMOLOGACAO' as 'HOMOLOGACAO' | 'PRODUCAO',
    id_correios: '',
    codigo_acesso: '',
    contrato: '',
    cartao_postagem: '',
    sender_name: '',
    sender_cpf_cnpj: '',
    sender_street: '',
    sender_number: '',
    sender_complement: '',
    sender_neighborhood: '',
    sender_city: '',
    sender_state: '',
    sender_cep: '',
    sender_phone: '',
    sender_email: '',
    default_service_code: '03298',
    default_package_type: 'caixa',
    default_weight_grams: 500,
    default_height_cm: 10,
    default_width_cm: 15,
    default_length_cm: 20,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        is_active: config.is_active,
        ambiente: config.ambiente,
        id_correios: config.id_correios || '',
        codigo_acesso: '', // Never show encrypted password
        contrato: config.contrato || '',
        cartao_postagem: config.cartao_postagem || '',
        sender_name: config.sender_name || '',
        sender_cpf_cnpj: config.sender_cpf_cnpj || '',
        sender_street: config.sender_street || '',
        sender_number: config.sender_number || '',
        sender_complement: config.sender_complement || '',
        sender_neighborhood: config.sender_neighborhood || '',
        sender_city: config.sender_city || '',
        sender_state: config.sender_state || '',
        sender_cep: config.sender_cep || '',
        sender_phone: config.sender_phone || '',
        sender_email: config.sender_email || '',
        default_service_code: config.default_service_code || '03298',
        default_package_type: config.default_package_type || 'caixa',
        default_weight_grams: config.default_weight_grams || 500,
        default_height_cm: config.default_height_cm || 10,
        default_width_cm: config.default_width_cm || 15,
        default_length_cm: config.default_length_cm || 20,
      });
    }
  }, [config]);

  const handleSubmit = async () => {
    const dataToSave: any = { ...formData };
    
    // Only include password if it was changed
    if (!formData.codigo_acesso) {
      delete dataToSave.codigo_acesso;
      dataToSave.codigo_acesso_encrypted = config?.codigo_acesso_encrypted;
    }

    await saveConfig.mutateAsync(dataToSave);
    onOpenChange(false);
  };

  const handleTestConnection = async () => {
    await testConnection.mutateAsync();
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração Correios</DialogTitle>
          <DialogDescription>
            Configure suas credenciais e dados do remetente para gerar etiquetas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-4 border-b">
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <div>
              <p className="font-medium">Integração ativa</p>
              <p className="text-sm text-muted-foreground">
                Habilitar geração de etiquetas
              </p>
            </div>
          </div>
          <Select
            value={formData.ambiente}
            onValueChange={(value: 'HOMOLOGACAO' | 'PRODUCAO') => 
              setFormData(prev => ({ ...prev, ambiente: value }))
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOMOLOGACAO">Homologação</SelectItem>
              <SelectItem value="PRODUCAO">Produção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="credentials">Credenciais</TabsTrigger>
            <TabsTrigger value="sender">Remetente</TabsTrigger>
            <TabsTrigger value="defaults">Padrões</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credenciais de Acesso</CardTitle>
                <CardDescription>
                  Obtenha suas credenciais no portal{' '}
                  <a 
                    href="https://cws.correios.com.br" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    CWS Correios
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ID Correios (Usuário)</Label>
                    <Input
                      value={formData.id_correios}
                      onChange={(e) => setFormData(prev => ({ ...prev, id_correios: e.target.value }))}
                      placeholder="Seu ID Correios"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha de Componente</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.codigo_acesso}
                        onChange={(e) => setFormData(prev => ({ ...prev, codigo_acesso: e.target.value }))}
                        placeholder={config?.codigo_acesso_encrypted ? '••••••••' : 'Senha do CWS'}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {config?.codigo_acesso_encrypted && (
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para manter a senha atual
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número do Contrato</Label>
                    <Input
                      value={formData.contrato}
                      onChange={(e) => setFormData(prev => ({ ...prev, contrato: e.target.value }))}
                      placeholder="Ex: 9912345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cartão de Postagem</Label>
                    <Input
                      value={formData.cartao_postagem}
                      onChange={(e) => setFormData(prev => ({ ...prev, cartao_postagem: e.target.value }))}
                      placeholder="Ex: 0076543210"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              onClick={handleTestConnection}
              disabled={testConnection.isPending || !formData.id_correios}
              className="w-full"
            >
              {testConnection.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              Testar Conexão
            </Button>
          </TabsContent>

          <TabsContent value="sender" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados do Remetente</CardTitle>
                <CardDescription>
                  Informações que aparecerão nas etiquetas como remetente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome/Razão Social</Label>
                    <Input
                      value={formData.sender_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_name: e.target.value }))}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Input
                      value={formData.sender_cpf_cnpj}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_cpf_cnpj: e.target.value }))}
                      placeholder="00.000.000/0001-00"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Logradouro</Label>
                    <Input
                      value={formData.sender_street}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_street: e.target.value }))}
                      placeholder="Rua, Avenida..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={formData.sender_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_number: e.target.value }))}
                      placeholder="123"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={formData.sender_complement}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_complement: e.target.value }))}
                      placeholder="Sala, Bloco..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.sender_neighborhood}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_neighborhood: e.target.value }))}
                      placeholder="Bairro"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.sender_city}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_city: e.target.value }))}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={formData.sender_state}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_state: e.target.value }))}
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={formData.sender_cep}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_cep: e.target.value }))}
                      placeholder="00000-000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.sender_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.sender_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, sender_email: e.target.value }))}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="defaults" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configurações Padrão</CardTitle>
                <CardDescription>
                  Valores padrão usados quando não especificados na geração da etiqueta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Serviço Padrão</Label>
                    <Select
                      value={formData.default_service_code}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, default_service_code: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {services?.map((service) => (
                          <SelectItem key={service.code} value={service.code}>
                            {service.name} - {service.description}
                          </SelectItem>
                        )) || (
                          <>
                            <SelectItem value="03298">PAC - Entrega econômica</SelectItem>
                            <SelectItem value="03220">SEDEX - Entrega expressa</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Embalagem</Label>
                    <Select
                      value={formData.default_package_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, default_package_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caixa">Caixa/Pacote</SelectItem>
                        <SelectItem value="envelope">Envelope</SelectItem>
                        <SelectItem value="cilindro">Cilindro/Rolo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Peso (g)</Label>
                    <Input
                      type="number"
                      value={formData.default_weight_grams}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_weight_grams: Number(e.target.value) }))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Altura (cm)</Label>
                    <Input
                      type="number"
                      value={formData.default_height_cm}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_height_cm: Number(e.target.value) }))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Largura (cm)</Label>
                    <Input
                      type="number"
                      value={formData.default_width_cm}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_width_cm: Number(e.target.value) }))}
                      min={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Comprimento (cm)</Label>
                    <Input
                      type="number"
                      value={formData.default_length_cm}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_length_cm: Number(e.target.value) }))}
                      min={1}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Serviços Habilitados</CardTitle>
                <CardDescription>
                  Selecione quais serviços serão cotados ao consultar frete para clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ShippingServicesConfig />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saveConfig.isPending}>
            {saveConfig.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configuração
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
