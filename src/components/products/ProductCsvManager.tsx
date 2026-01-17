import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, HelpCircle, Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import type { Product } from '@/hooks/useProducts';
import { useProductBrands } from '@/hooks/useProductBrands';

// Columns that can be exported/imported
const CSV_COLUMNS = [
  { key: 'id', label: 'ID (não altere para atualizar)', editable: false },
  { key: 'name', label: 'Nome', editable: true },
  { key: 'description', label: 'Descrição', editable: true },
  { key: 'category', label: 'Categoria', editable: true },
  { key: 'brand_name', label: 'Marca', editable: true }, // Virtual column - maps to brand_id
  { key: 'sku', label: 'SKU', editable: true },
  { key: 'barcode_ean', label: 'Código de Barras (EAN)', editable: true },
  { key: 'price_1_unit', label: 'Preço 1 un (centavos)', editable: true },
  { key: 'price_3_units', label: 'Preço 3 un (centavos)', editable: true },
  { key: 'price_6_units', label: 'Preço 6 un (centavos)', editable: true },
  { key: 'price_12_units', label: 'Preço 12 un (centavos)', editable: true },
  { key: 'minimum_price', label: 'Preço Mínimo (centavos)', editable: true },
  { key: 'cost_cents', label: 'Custo (centavos)', editable: true },
  { key: 'stock_quantity', label: 'Estoque', editable: true },
  { key: 'minimum_stock', label: 'Estoque Mínimo', editable: true },
  { key: 'track_stock', label: 'Controlar Estoque (true/false)', editable: true },
  { key: 'is_active', label: 'Ativo (true/false)', editable: true },
  { key: 'is_featured', label: 'Destaque (true/false)', editable: true },
  { key: 'usage_period_days', label: 'Período de Uso (dias)', editable: true },
  { key: 'unit', label: 'Unidade', editable: true },
  { key: 'net_weight_grams', label: 'Peso Líquido (g)', editable: true },
  { key: 'gross_weight_grams', label: 'Peso Bruto (g)', editable: true },
  { key: 'width_cm', label: 'Largura (cm)', editable: true },
  { key: 'height_cm', label: 'Altura (cm)', editable: true },
  { key: 'depth_cm', label: 'Profundidade (cm)', editable: true },
  { key: 'hot_site_url', label: 'URL Hot Site', editable: true },
  { key: 'youtube_video_url', label: 'URL YouTube', editable: true },
  { key: 'sales_script', label: 'Script de Vendas', editable: true },
];

interface ProductCsvManagerProps {
  products: Product[];
  canManage: boolean;
}

export function ProductCsvManager({ products, canManage }: ProductCsvManagerProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: brands = [] } = useProductBrands();

  const hasProducts = products.length > 0;

  // Create a map of brand_id to brand_name for export
  const brandIdToName = brands.reduce((acc, brand) => {
    acc[brand.id] = brand.name;
    return acc;
  }, {} as Record<string, string>);

  // Create a map of brand_name (lowercase) to brand_id for import
  const brandNameToId = brands.reduce((acc, brand) => {
    acc[brand.name.toLowerCase().trim()] = brand.id;
    return acc;
  }, {} as Record<string, string>);

  const escapeCSVField = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExport = () => {
    // Header row
    const headers = CSV_COLUMNS.map(col => col.label);
    
    // Data rows - handle brand_name virtual column
    const rows = products.map(product => 
      CSV_COLUMNS.map(col => {
        if (col.key === 'brand_name') {
          // Virtual column: get brand name from brand_id
          const brandName = product.brand_id ? brandIdToName[product.brand_id] || '' : '';
          return escapeCSVField(brandName);
        }
        return escapeCSVField(product[col.key as keyof Product]);
      })
    );

    // Build CSV content with BOM for Excel compatibility
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast.success(`${products.length} produtos exportados com sucesso!`);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.organization_id) return;

    setIsImporting(true);
    const results = { created: 0, updated: 0, errors: [] as string[] };

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Arquivo CSV vazio ou inválido');
        setIsImporting(false);
        return;
      }

      // Skip header
      const dataLines = lines.slice(1);

      for (let i = 0; i < dataLines.length; i++) {
        const lineNumber = i + 2; // +2 because of header and 0-index
        try {
          const values = parseCSVLine(dataLines[i]);
          
          if (values.length < CSV_COLUMNS.length) {
            results.errors.push(`Linha ${lineNumber}: número de colunas incorreto`);
            continue;
          }

          // Build product data
          const productData: Record<string, unknown> = {
            organization_id: profile.organization_id,
          };
          
          let productId: string | null = null;

          CSV_COLUMNS.forEach((col, index) => {
            const value = values[index]?.trim();
            
            if (col.key === 'id') {
              if (value) productId = value;
              return;
            }

            // Handle virtual brand_name column - convert to brand_id
            if (col.key === 'brand_name') {
              if (value) {
                const brandId = brandNameToId[value.toLowerCase().trim()];
                if (brandId) {
                  productData['brand_id'] = brandId;
                }
                // If brand not found, we just skip it (don't set brand_id)
              } else {
                productData['brand_id'] = null;
              }
              return;
            }

            if (!value && value !== '0') {
              // For nullable fields, set null
              if (['description', 'sales_script', 'sku', 'barcode_ean', 'unit', 'hot_site_url', 'youtube_video_url', 'brand_id'].includes(col.key)) {
                productData[col.key] = null;
              }
              return;
            }

            // Parse based on column type
            if (['price_1_unit', 'price_3_units', 'price_6_units', 'price_12_units', 'minimum_price', 'cost_cents', 'stock_quantity', 'minimum_stock', 'usage_period_days', 'net_weight_grams', 'gross_weight_grams', 'width_cm', 'height_cm', 'depth_cm'].includes(col.key)) {
              const num = parseInt(value, 10);
              if (!isNaN(num)) productData[col.key] = num;
            } else if (['track_stock', 'is_active', 'is_featured'].includes(col.key)) {
              productData[col.key] = value.toLowerCase() === 'true';
            } else {
              productData[col.key] = value;
            }
          });

          // Validate required fields
          if (!productData.name) {
            results.errors.push(`Linha ${lineNumber}: nome é obrigatório`);
            continue;
          }

          // Check if product exists (by ID)
          if (productId) {
            const { data: existing } = await supabase
              .from('lead_products')
              .select('id')
              .eq('id', productId)
              .eq('organization_id', profile.organization_id)
              .single();

            if (existing) {
              // Update existing product
              const { error } = await supabase
                .from('lead_products')
                .update(productData as never)
                .eq('id', productId);

              if (error) {
                results.errors.push(`Linha ${lineNumber}: erro ao atualizar - ${error.message}`);
              } else {
                results.updated++;
              }
            } else {
              // ID doesn't exist in this org, create new (without the old ID)
              const { error } = await supabase
                .from('lead_products')
                .insert(productData as never);

              if (error) {
                results.errors.push(`Linha ${lineNumber}: erro ao criar - ${error.message}`);
              } else {
                results.created++;
              }
            }
          } else {
            // No ID, create new product
            const { error } = await supabase
              .from('lead_products')
              .insert(productData as never);

            if (error) {
              results.errors.push(`Linha ${lineNumber}: erro ao criar - ${error.message}`);
            } else {
              results.created++;
            }
          }
        } catch (err) {
          results.errors.push(`Linha ${lineNumber}: erro ao processar - ${err instanceof Error ? err.message : 'erro desconhecido'}`);
        }
      }

      setImportResults(results);
      queryClient.invalidateQueries({ queryKey: ['products'] });

      if (results.errors.length === 0) {
        toast.success(`Importação concluída! ${results.created} criados, ${results.updated} atualizados`);
      } else {
        toast.warning(`Importação parcial: ${results.created} criados, ${results.updated} atualizados, ${results.errors.length} erros`);
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      toast.error('Erro ao processar o arquivo CSV');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!canManage) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Help tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:text-blue-600">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm p-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">Como funciona a importação/exportação:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Exportar:</strong> Baixe todos os seus produtos em formato CSV</li>
                <li><strong>Importar:</strong> Use a planilha exportada como modelo para adicionar ou atualizar produtos</li>
                <li><strong>ID:</strong> Se a linha tiver um ID existente, o produto será atualizado. Se não tiver ID ou o ID não existir, um novo produto será criado</li>
                <li><strong>Atualização em massa:</strong> Altere os dados das linhas com ID e importe novamente para atualizar</li>
                <li>O nome do produto é obrigatório</li>
                <li>Valores monetários devem estar em centavos</li>
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Export button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              disabled={!hasProducts}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </TooltipTrigger>
          {!hasProducts && (
            <TooltipContent>
              Cadastre pelo menos um produto primeiro para exportar
            </TooltipContent>
          )}
        </Tooltip>

        {/* Import button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={!hasProducts || isImporting}
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Importar CSV
            </Button>
          </TooltipTrigger>
          {!hasProducts && (
            <TooltipContent>
              Cadastre e exporte pelo menos um produto primeiro para usar como modelo
            </TooltipContent>
          )}
        </Tooltip>

        <input
          type="file"
          ref={fileInputRef}
          accept=".csv"
          className="hidden"
          onChange={handleImport}
        />

        {/* Results dialog */}
        <AlertDialog open={!!importResults} onOpenChange={(open) => !open && setImportResults(null)}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Resultado da Importação</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <div className="flex gap-4">
                    <div className="text-center p-3 bg-green-500/10 rounded-lg flex-1">
                      <div className="text-2xl font-bold text-green-600">{importResults?.created || 0}</div>
                      <div className="text-xs text-muted-foreground">Criados</div>
                    </div>
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg flex-1">
                      <div className="text-2xl font-bold text-blue-600">{importResults?.updated || 0}</div>
                      <div className="text-xs text-muted-foreground">Atualizados</div>
                    </div>
                    <div className="text-center p-3 bg-red-500/10 rounded-lg flex-1">
                      <div className="text-2xl font-bold text-red-600">{importResults?.errors.length || 0}</div>
                      <div className="text-xs text-muted-foreground">Erros</div>
                    </div>
                  </div>
                  
                  {importResults?.errors && importResults.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto text-left">
                      <p className="font-medium text-sm mb-1">Erros encontrados:</p>
                      <ul className="text-xs space-y-1 text-destructive">
                        {importResults.errors.slice(0, 10).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                        {importResults.errors.length > 10 && (
                          <li>... e mais {importResults.errors.length - 10} erros</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Fechar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
