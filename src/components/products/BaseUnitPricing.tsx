import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Package, Lightbulb } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface BaseUnitPricingProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  disabled?: boolean;
}

export function BaseUnitPricing({ form, disabled }: BaseUnitPricingProps) {
  const useDefaultCommission = form.watch('base_use_default_commission');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Preço de 1 Unidade
        </CardTitle>
        <CardDescription>
          Valores base para venda de 1 unidade do produto. Esses valores são usados como referência para kits e combos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preço e Comissão */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="base_price_cents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço de Venda *</FormLabel>
                <FormControl>
                  <CurrencyInput
                    value={field.value || 0}
                    onChange={field.onChange}
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription>
                  Preço padrão de 1 unidade
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <FormField
              control={form.control}
              name="base_use_default_commission"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Comissão Padrão</FormLabel>
                </FormItem>
              )}
            />

            {!useDefaultCommission && (
              <FormField
                control={form.control}
                name="base_commission_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão Personalizada (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || null)}
                        placeholder="0.00"
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        {/* Pontos e Período */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="base_points"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pontos de Campanha</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription>
                  Pontos ganhos por 1 unidade vendida
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="base_usage_period_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Período de Uso (dias)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    placeholder="30"
                    disabled={disabled}
                  />
                </FormControl>
                <FormDescription>
                  Duração estimada de 1 unidade
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Sales Hack */}
        <FormField
          control={form.control}
          name="base_sales_hack"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Hack para Vender Mais
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ''}
                  placeholder="Dicas e argumentos de venda para 1 unidade..."
                  className="min-h-[80px]"
                  disabled={disabled}
                />
              </FormControl>
              <FormDescription>
                Orientações para o vendedor fechar a venda
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
