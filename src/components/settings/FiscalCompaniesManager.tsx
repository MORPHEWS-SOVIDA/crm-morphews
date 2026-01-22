import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2, Building2, Upload, CheckCircle2, XCircle, Star, Webhook } from 'lucide-react';
import {
  useFiscalCompanies,
  useCreateFiscalCompany,
  useUpdateFiscalCompany,
  useDeleteFiscalCompany,
  useUploadCertificate,
  useRegisterWebhooks,
  formatCNPJ,
  type FiscalCompany,
  type CreateFiscalCompanyData,
} from '@/hooks/useFiscalCompanies';
import { useCepLookup } from '@/hooks/useCepLookup';

const TAX_REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface FiscalCompanyFormData extends CreateFiscalCompanyData {
  id?: string;
}

export function FiscalCompaniesManager() {
  const { data: companies = [], isLoading } = useFiscalCompanies();
  const createCompany = useCreateFiscalCompany();
  const updateCompany = useUpdateFiscalCompany();
  const deleteCompany = useDeleteFiscalCompany();
  const uploadCertificate = useUploadCertificate();
  const registerWebhooks = useRegisterWebhooks();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<FiscalCompany | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FiscalCompany | null>(null);
  const [certificateDialog, setCertificateDialog] = useState<FiscalCompany | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');

  const [formData, setFormData] = useState<FiscalCompanyFormData>({
    company_name: '',
    trade_name: '',
    cnpj: '',
    state_registration: '',
    municipal_registration: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_city_code: '',
    address_state: '',
    address_zip: '',
    phone: '',
    email: '',
    tax_regime: 'simples_nacional',
    is_primary: false,
    default_cfop_internal: '5102',
    default_cfop_interstate: '6102',
    default_cst: '102',
    nfse_municipal_code: '',
  });

  const { lookupCep, isLoading: isLoadingCep } = useCepLookup();

  const resetForm = () => {
    setFormData({
      company_name: '',
      trade_name: '',
      cnpj: '',
      state_registration: '',
      municipal_registration: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_city_code: '',
      address_state: '',
      address_zip: '',
      phone: '',
      email: '',
      tax_regime: 'simples_nacional',
      is_primary: false,
      default_cfop_internal: '5102',
      default_cfop_interstate: '6102',
      default_cst: '102',
      nfse_municipal_code: '',
    });
    setEditingCompany(null);
  };

  const handleOpenDialog = (company?: FiscalCompany) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        company_name: company.company_name,
        trade_name: company.trade_name || '',
        cnpj: formatCNPJ(company.cnpj),
        state_registration: company.state_registration || '',
        municipal_registration: company.municipal_registration || '',
        address_street: company.address_street || '',
        address_number: company.address_number || '',
        address_complement: company.address_complement || '',
        address_neighborhood: company.address_neighborhood || '',
        address_city: company.address_city || '',
        address_city_code: company.address_city_code || '',
        address_state: company.address_state || '',
        address_zip: company.address_zip || '',
        phone: company.phone || '',
        email: company.email || '',
        tax_regime: company.tax_regime,
        is_primary: company.is_primary,
        default_cfop_internal: company.default_cfop_internal,
        default_cfop_interstate: company.default_cfop_interstate,
        default_cst: company.default_cst,
        nfse_municipal_code: company.nfse_municipal_code || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleCepBlur = async () => {
    const cep = formData.address_zip?.replace(/\D/g, '');
    if (cep?.length === 8) {
      const result = await lookupCep(cep);
      if (result) {
        setFormData(prev => ({
          ...prev,
          address_street: result.street || prev.address_street,
          address_neighborhood: result.neighborhood || prev.address_neighborhood,
          address_city: result.city || prev.address_city,
          address_state: result.state || prev.address_state,
          address_city_code: result.ibge || prev.address_city_code,
        }));
      }
    }
  };

  const handleSubmit = async () => {
    if (editingCompany) {
      await updateCompany.mutateAsync({
        id: editingCompany.id,
        data: formData,
      });
    } else {
      await createCompany.mutateAsync(formData);
    }
    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteCompany.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const handleUploadCertificate = async () => {
    if (certificateDialog && certificateFile && certificatePassword) {
      await uploadCertificate.mutateAsync({
        companyId: certificateDialog.id,
        file: certificateFile,
        password: certificatePassword,
      });
      setCertificateDialog(null);
      setCertificateFile(null);
      setCertificatePassword('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Empresas (CNPJs)</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre as empresas que emitirão notas fiscais
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Empresa
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhuma empresa cadastrada.<br />
              Adicione sua primeira empresa para começar a emitir notas fiscais.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{company.company_name}</h4>
                      {company.is_primary && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="w-3 h-3" />
                          Principal
                        </Badge>
                      )}
                      {!company.is_active && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    {company.trade_name && (
                      <p className="text-sm text-muted-foreground">{company.trade_name}</p>
                    )}
                    <p className="text-sm font-mono">{formatCNPJ(company.cnpj)}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>{TAX_REGIMES.find(r => r.value === company.tax_regime)?.label}</span>
                      {company.address_city && company.address_state && (
                        <span>{company.address_city}/{company.address_state}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {company.certificate_file_path ? (
                        <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Certificado A1
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-600">
                          <XCircle className="w-3 h-3" />
                          Sem certificado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => registerWebhooks.mutate({ fiscalCompanyId: company.id })}
                      disabled={registerWebhooks.isPending}
                      title="Registrar webhooks na API Focus NFe"
                    >
                      {registerWebhooks.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Webhook className="w-4 h-4 mr-1" />
                      )}
                      Webhooks
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCertificateDialog(company)}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      Certificado
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenDialog(company)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteConfirm(company)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Company Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da empresa para emissão de notas fiscais
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Razão Social *</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="Razão social completa"
                />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input
                  value={formData.trade_name}
                  onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  placeholder="Nome fantasia"
                />
              </div>
              <div>
                <Label>CNPJ *</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            {/* Tax Info */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Regime Tributário</Label>
                <Select
                  value={formData.tax_regime}
                  onValueChange={(v) => setFormData({ ...formData, tax_regime: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_REGIMES.map((regime) => (
                      <SelectItem key={regime.value} value={regime.value}>
                        {regime.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inscrição Estadual</Label>
                <Input
                  value={formData.state_registration}
                  onChange={(e) => setFormData({ ...formData, state_registration: e.target.value })}
                  placeholder="IE"
                />
              </div>
              <div>
                <Label>Inscrição Municipal</Label>
                <Input
                  value={formData.municipal_registration}
                  onChange={(e) => setFormData({ ...formData, municipal_registration: e.target.value })}
                  placeholder="IM (para NFSe)"
                />
              </div>
            </div>

            {/* Address */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Endereço</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={formData.address_zip}
                    onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    value={formData.address_street}
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input
                    value={formData.address_number}
                    onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                    placeholder="Nº"
                  />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input
                    value={formData.address_complement}
                    onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                    placeholder="Sala, Andar..."
                  />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={formData.address_neighborhood}
                    onChange={(e) => setFormData({ ...formData, address_neighborhood: e.target.value })}
                    placeholder="Bairro"
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={formData.address_city}
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <Label>UF</Label>
                  <Select
                    value={formData.address_state}
                    onValueChange={(v) => setFormData({ ...formData, address_state: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-2">
                <Label>Código IBGE da Cidade</Label>
                <Input
                  value={formData.address_city_code}
                  onChange={(e) => setFormData({ ...formData, address_city_code: e.target.value })}
                  placeholder="7 dígitos - preenchido automaticamente pelo CEP"
                  className="max-w-[200px]"
                />
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="fiscal@empresa.com"
                />
              </div>
            </div>

            {/* Fiscal Defaults */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Configurações Fiscais Padrão</h4>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>CFOP Interno</Label>
                  <Input
                    value={formData.default_cfop_internal}
                    onChange={(e) => setFormData({ ...formData, default_cfop_internal: e.target.value })}
                    placeholder="5102"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Vendas dentro do estado</p>
                </div>
                <div>
                  <Label>CFOP Interestadual</Label>
                  <Input
                    value={formData.default_cfop_interstate}
                    onChange={(e) => setFormData({ ...formData, default_cfop_interstate: e.target.value })}
                    placeholder="6102"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Vendas fora do estado</p>
                </div>
                <div>
                  <Label>CST Padrão</Label>
                  <Input
                    value={formData.default_cst}
                    onChange={(e) => setFormData({ ...formData, default_cst: e.target.value })}
                    placeholder="102"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Código Situação Tributária</p>
                </div>
                <div>
                  <Label>Cód. Municipal (NFSe)</Label>
                  <Input
                    value={formData.nfse_municipal_code}
                    onChange={(e) => setFormData({ ...formData, nfse_municipal_code: e.target.value })}
                    placeholder="Ex: 1701"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Para notas de serviço</p>
                </div>
              </div>
            </div>

            {/* Primary Toggle */}
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label>Empresa Principal</Label>
                <p className="text-sm text-muted-foreground">
                  Será usada por padrão nas emissões
                </p>
              </div>
              <Switch
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.company_name || !formData.cnpj || createCompany.isPending || updateCompany.isPending}
            >
              {(createCompany.isPending || updateCompany.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingCompany ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Upload Dialog */}
      <Dialog open={!!certificateDialog} onOpenChange={() => setCertificateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Certificado A1</DialogTitle>
            <DialogDescription>
              Envie o certificado digital A1 (.pfx) para {certificateDialog?.company_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Arquivo do Certificado (.pfx)</Label>
              <Input
                type="file"
                accept=".pfx,.p12"
                onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
              />
            </div>
            <div>
              <Label>Senha do Certificado</Label>
              <Input
                type="password"
                value={certificatePassword}
                onChange={(e) => setCertificatePassword(e.target.value)}
                placeholder="Senha do certificado"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCertificateDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUploadCertificate}
              disabled={!certificateFile || !certificatePassword || uploadCertificate.isPending}
            >
              {uploadCertificate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar Certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteConfirm?.company_name}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
