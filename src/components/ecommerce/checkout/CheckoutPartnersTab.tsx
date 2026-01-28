import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Factory, Building2, Users2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface CheckoutPartnersTabProps {
  industryId: string | null;
  industryCommissionType: 'percentage' | 'fixed';
  industryCommissionValue: number;
  factoryId: string | null;
  factoryCommissionType: 'percentage' | 'fixed';
  factoryCommissionValue: number;
  coproducerId: string | null;
  coproducerCommissionType: 'percentage' | 'fixed';
  coproducerCommissionValue: number;
  onChange: (data: {
    industry_id: string | null;
    industry_commission_type: 'percentage' | 'fixed';
    industry_commission_value: number;
    factory_id: string | null;
    factory_commission_type: 'percentage' | 'fixed';
    factory_commission_value: number;
    coproducer_id: string | null;
    coproducer_commission_type: 'percentage' | 'fixed';
    coproducer_commission_value: number;
  }) => void;
}

interface Partner {
  id: string;
  name: string;
  email: string;
  virtual_account_id: string;
}

const NONE_VALUE = '__none__';

export function CheckoutPartnersTab({
  industryId,
  industryCommissionType,
  industryCommissionValue,
  factoryId,
  factoryCommissionType,
  factoryCommissionValue,
  coproducerId,
  coproducerCommissionType,
  coproducerCommissionValue,
  onChange,
}: CheckoutPartnersTabProps) {
  const { profile } = useAuth();
  const [industries, setIndustries] = useState<Partner[]>([]);
  const [factories, setFactories] = useState<Partner[]>([]);
  const [coproducers, setCoproducers] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchPartners = async () => {
      setLoading(true);

      // Fetch all partner associations with virtual account info
      const { data: associations } = await supabase
        .from('partner_associations')
        .select(`
          id,
          partner_type,
          virtual_account_id,
          virtual_accounts (
            id,
            holder_name,
            holder_email
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true);

      const allPartners = associations || [];
      
      // Transform and filter by partner type
      const transformPartner = (p: any): Partner => ({
        id: p.virtual_account_id, // Use virtual_account_id as the reference
        name: p.virtual_accounts?.holder_name || 'Sem nome',
        email: p.virtual_accounts?.holder_email || '',
        virtual_account_id: p.virtual_account_id,
      });

      // Get unique partners by virtual_account_id for each type
      const getUniquePartners = (type: string) => {
        const filtered = allPartners.filter(p => p.partner_type === type);
        const unique = new Map<string, Partner>();
        filtered.forEach(p => {
          if (!unique.has(p.virtual_account_id)) {
            unique.set(p.virtual_account_id, transformPartner(p));
          }
        });
        return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
      };

      setIndustries(getUniquePartners('industry'));
      setFactories(getUniquePartners('factory'));
      setCoproducers(getUniquePartners('coproducer'));
      
      setLoading(false);
    };

    fetchPartners();
  }, [profile?.organization_id]);

  const handleChange = (field: string, value: any) => {
    const newData = {
      industry_id: industryId,
      industry_commission_type: industryCommissionType,
      industry_commission_value: industryCommissionValue,
      factory_id: factoryId,
      factory_commission_type: factoryCommissionType,
      factory_commission_value: factoryCommissionValue,
      coproducer_id: coproducerId,
      coproducer_commission_type: coproducerCommissionType,
      coproducer_commission_value: coproducerCommissionValue,
      [field]: value,
    };
    onChange(newData);
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <CardContent className="py-3 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Parceiros Fixos:</strong> Estes parceiros recebem comissão em <strong>TODAS</strong> as vendas deste checkout, 
            independente de qual afiliado divulgou. Os afiliados (aba ao lado) só ganham quando a venda vem pelo link deles.
          </div>
        </CardContent>
      </Card>

      {/* Industry */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm">Indústria</CardTitle>
            <Badge variant="secondary" className="text-xs">Ganha em toda venda</Badge>
          </div>
          <CardDescription className="text-xs">
            Fornecedor principal que recebe comissão fixa ou % em cada venda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs">Indústria</Label>
              <Select
                value={industryId || NONE_VALUE}
                onValueChange={(v) => handleChange('industry_id', v === NONE_VALUE ? null : v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                  {industries.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>{ind.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={industryCommissionType}
                onValueChange={(v) => handleChange('industry_commission_type', v)}
                disabled={!industryId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">% da venda</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">
                {industryCommissionType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
              </Label>
              <Input
                type="number"
                min="0"
                step={industryCommissionType === 'percentage' ? '0.5' : '1'}
                value={industryCommissionValue}
                onChange={(e) => handleChange('industry_commission_value', parseFloat(e.target.value) || 0)}
                disabled={!industryId}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Factory */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-orange-500" />
            <CardTitle className="text-sm">Fábrica</CardTitle>
            <Badge variant="secondary" className="text-xs">Ganha em toda venda</Badge>
          </div>
          <CardDescription className="text-xs">
            Fabricante do produto que recebe valor por unidade vendida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs">Fábrica</Label>
              <Select
                value={factoryId || NONE_VALUE}
                onValueChange={(v) => handleChange('factory_id', v === NONE_VALUE ? null : v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                  {factories.map((fac) => (
                    <SelectItem key={fac.id} value={fac.id}>{fac.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={factoryCommissionType}
                onValueChange={(v) => handleChange('factory_commission_type', v)}
                disabled={!factoryId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">% da venda</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">
                {factoryCommissionType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
              </Label>
              <Input
                type="number"
                min="0"
                step={factoryCommissionType === 'percentage' ? '0.5' : '1'}
                value={factoryCommissionValue}
                onChange={(e) => handleChange('factory_commission_value', parseFloat(e.target.value) || 0)}
                disabled={!factoryId}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coproducer */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-green-500" />
            <CardTitle className="text-sm">Co-produtor</CardTitle>
            <Badge variant="secondary" className="text-xs">Ganha em toda venda</Badge>
          </div>
          <CardDescription className="text-xs">
            Parceiro que ajuda na criação/promoção e recebe % de cada venda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs">Co-produtor</Label>
              <Select
                value={coproducerId || NONE_VALUE}
                onValueChange={(v) => handleChange('coproducer_id', v === NONE_VALUE ? null : v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                  {coproducers.map((cop) => (
                    <SelectItem key={cop.id} value={cop.id}>
                      {cop.name} ({cop.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={coproducerCommissionType}
                onValueChange={(v) => handleChange('coproducer_commission_type', v)}
                disabled={!coproducerId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">% da venda</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">
                {coproducerCommissionType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
              </Label>
              <Input
                type="number"
                min="0"
                step={coproducerCommissionType === 'percentage' ? '0.5' : '1'}
                value={coproducerCommissionValue}
                onChange={(e) => handleChange('coproducer_commission_value', parseFloat(e.target.value) || 0)}
                disabled={!coproducerId}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
