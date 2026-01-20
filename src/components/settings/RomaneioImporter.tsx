import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ImportResult {
  success: boolean;
  leadsCreated: number;
  leadsUpdated: number;
  salesCreated: number;
  errors: string[];
}

interface ParsedRomaneio {
  romaneioNumber: string;
  digitador: string;
  emissionDate: string;
  deliveryDate: string;
  turno: string;
  clienteId: string;
  clienteName: string;
  cpfCnpj: string;
  phone: string;
  street: string;
  streetNumber: string;
  complement: string;
  neighborhood: string;
  cep: string;
  cityState: string;
  region: string;
  deliveryReference: string;
  deliveryNotes: string;
  deliveryType: string;
  products: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  requiresReceipt: boolean;
  isPaid: boolean;
  totalValue: number;
}

export function RomaneioImporter() {
  const { profile } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const parseRomaneioPage = (pageText: string): ParsedRomaneio | null => {
    try {
      // Extract romaneio number
      const romaneioMatch = pageText.match(/ROMANEIO:\s*(\d+)/);
      if (!romaneioMatch) return null;

      // Extract digitador
      const digitadorMatch = pageText.match(/DIGITADOR:\s*(.+?)(?:\n|DATA)/);
      
      // Extract emission date
      const emissionMatch = pageText.match(/DATA DE EMISSÃO:\s*(\d{2}\/\d{2}\/\d{4})/);
      
      // Extract delivery date
      const deliveryDateMatch = pageText.match(/DATA DE ENTREGA:\s*(\d{2}\/\d{2}\/\d{4})/);
      
      // Extract turno
      const turnoMatch = pageText.match(/TURNO:\s*(MANHÃ|TARDE|NOITE)/i);

      // Extract client info - format: "ID - NAME"
      const clienteMatch = pageText.match(/# CLIENTE\s*\n\s*(\d+)\s*-\s*([^\n]+)/);
      
      // Extract CPF/CNPJ
      const cpfMatch = pageText.match(/CPF\/CNPJ:\s*([^\n]*)/);
      
      // Extract phone
      const phoneMatch = pageText.match(/FONE\/CEL:\s*(\d+)/);

      // Extract address
      const addressMatch = pageText.match(/# ENDEREÇO\s*\n\s*([^\n]+)/);
      const addressParts = addressMatch ? parseAddress(addressMatch[1]) : { street: '', number: '', complement: '' };
      
      // Extract neighborhood
      const neighborhoodMatch = pageText.match(/BAIRRO:\s*([^\n]+)/);
      
      // Extract CEP and city/state
      const cepCityMatch = pageText.match(/CEP:\s*([\d-]+)\s*-\s*([^\n]+)/);
      
      // Extract region
      const regionMatch = pageText.match(/REGIÃO:\s*([^\n]+)/);

      // Extract delivery notes (OBS.ENTREGA)
      const obsMatch = pageText.match(/OBS\.ENTREGA:?\s*\n?([^\n#]*)/i);
      
      // Extract delivery type
      const deliveryTypeMatch = pageText.match(/TIPO DE ENTREGA\s*\n\s*([^\n]+)/);

      // Extract products from table
      const products = parseProductsTable(pageText);

      // Extract total value
      const totalMatch = pageText.match(/TOTAL DO ROMANEIO:\s*R\$\s*([\d.,]+)/);
      
      // Extract payment status
      const isPaidMatch = pageText.match(/VENDA ESTA PAGA.*?:\s*(SIM|NÃO)/i);

      return {
        romaneioNumber: romaneioMatch[1],
        digitador: digitadorMatch?.[1]?.trim() || '',
        emissionDate: emissionMatch?.[1] || '',
        deliveryDate: deliveryDateMatch?.[1] || '',
        turno: turnoMatch?.[1] || '',
        clienteId: clienteMatch?.[1] || '',
        clienteName: clienteMatch?.[2]?.trim() || '',
        cpfCnpj: cpfMatch?.[1]?.trim() || '',
        phone: phoneMatch?.[1] || '',
        street: addressParts.street,
        streetNumber: addressParts.number,
        complement: addressParts.complement,
        neighborhood: neighborhoodMatch?.[1]?.trim() || '',
        cep: cepCityMatch?.[1]?.replace(/\D/g, '') || '',
        cityState: cepCityMatch?.[2]?.trim() || '',
        region: regionMatch?.[1]?.trim() || '',
        deliveryReference: '',
        deliveryNotes: obsMatch?.[1]?.trim() || '',
        deliveryType: deliveryTypeMatch?.[1]?.trim() || '',
        products,
        requiresReceipt: pageText.includes('EXIGE RECEITA: SIM'),
        isPaid: isPaidMatch?.[1]?.toUpperCase() === 'SIM',
        totalValue: totalMatch ? parseFloat(totalMatch[1].replace('.', '').replace(',', '.')) : 0,
      };
    } catch (error) {
      console.error('Error parsing romaneio page:', error);
      return null;
    }
  };

  const parseAddress = (addressLine: string): { street: string; number: string; complement: string } => {
    // Format: "Street Name, 123 - complement" or "Street Name, 123"
    const match = addressLine.match(/^(.+?),?\s*(\d+)?\s*(?:-\s*(.+))?$/);
    if (match) {
      return {
        street: match[1]?.trim() || '',
        number: match[2] || '',
        complement: match[3]?.trim() || '',
      };
    }
    return { street: addressLine, number: '', complement: '' };
  };

  const parseProductsTable = (pageText: string): ParsedRomaneio['products'] => {
    const products: ParsedRomaneio['products'] = [];
    
    // Match product lines in table format
    const tableMatch = pageText.match(/\| PRODUTO.*?\|\s*\n\s*\|.*?\|\s*\n([\s\S]*?)(?=EXIGE RECEITA|$)/);
    if (tableMatch) {
      const lines = tableMatch[1].split('\n');
      for (const line of lines) {
        const productMatch = line.match(/\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|/);
        if (productMatch) {
          products.push({
            code: productMatch[1],
            description: productMatch[2].trim(),
            quantity: parseFloat(productMatch[3].replace(',', '.')),
            unitPrice: parseFloat(productMatch[4].replace('.', '').replace(',', '.')),
            totalPrice: parseFloat(productMatch[5].replace('.', '').replace(',', '.')),
          });
        }
      }
    }
    
    return products;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, envie um arquivo PDF.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    setResults(null);

    addLog(`Iniciando processamento de: ${file.name}`);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);
      addLog('Arquivo convertido para base64');

      // Call edge function to parse PDF
      addLog('Enviando para processamento...');
      const { data, error } = await supabase.functions.invoke('romaneio-import', {
        body: {
          pdfBase64: base64,
          fileName: file.name,
        },
      });

      if (error) throw error;

      const pages = data.pages as string[];
      addLog(`PDF parseado: ${pages.length} páginas encontradas`);

      // Process each page
      const importResult: ImportResult = {
        success: true,
        leadsCreated: 0,
        leadsUpdated: 0,
        salesCreated: 0,
        errors: [],
      };

      // Get org info
      const organizationId = profile?.organization_id;
      if (!organizationId) {
        throw new Error('Organização não encontrada');
      }

      // Get Thiago's user ID
      const { data: thiagoProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('organization_id', organizationId)
        .ilike('email', '%thiago@sonatura.com.br%')
        .single();

      const importerUserId = thiagoProfile?.user_id || profile?.user_id;

      for (let i = 0; i < pages.length; i++) {
        const pageText = pages[i];
        setProgress(((i + 1) / pages.length) * 100);
        
        const romaneio = parseRomaneioPage(pageText);
        if (!romaneio) {
          addLog(`⚠️ Página ${i + 1}: Não foi possível parsear`);
          importResult.errors.push(`Página ${i + 1}: formato não reconhecido`);
          continue;
        }

        addLog(`Processando romaneio #${romaneio.romaneioNumber} - ${romaneio.clienteName}`);

        // Check if lead exists by phone
        const cleanPhone = romaneio.phone.replace(/\D/g, '');
        if (!cleanPhone) {
          addLog(`⚠️ Romaneio #${romaneio.romaneioNumber}: Sem telefone`);
          importResult.errors.push(`Romaneio #${romaneio.romaneioNumber}: sem telefone`);
          continue;
        }

        // Normalize phone with 55 prefix
        const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

        const { data: existingLeads } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('whatsapp', normalizedPhone);

        let leadId: string;

        if (existingLeads && existingLeads.length > 0) {
          // Lead exists - just use their ID
          leadId = existingLeads[0].id;
          importResult.leadsUpdated++;
          addLog(`✓ Lead existente: ${romaneio.clienteName}`);
        } else {
          // Parse city and state
          const cityStateMatch = romaneio.cityState.match(/^(.+?)\/(\w{2})/);
          const city = cityStateMatch?.[1]?.trim() || '';
          const state = cityStateMatch?.[2] || '';

          // Create new lead
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert([{
              organization_id: organizationId,
              assigned_to: 'Sistema',
              created_by: importerUserId,
              name: romaneio.clienteName,
              whatsapp: normalizedPhone,
              cpf_cnpj: romaneio.cpfCnpj || null,
              street: romaneio.street || null,
              street_number: romaneio.streetNumber || null,
              complement: romaneio.complement || null,
              neighborhood: romaneio.neighborhood || null,
              cep: romaneio.cep || null,
              city: city || null,
              state: state || null,
              delivery_notes: romaneio.deliveryNotes || null,
              stage: 'sale_completed' as const,
              stars: 3,
              observations: `[Importado do sistema antigo]\nCliente ID: ${romaneio.clienteId}\nRegião: ${romaneio.region}`,
            }])
            .select()
            .single();

          if (leadError) {
            addLog(`❌ Erro ao criar lead: ${leadError.message}`);
            importResult.errors.push(`Romaneio #${romaneio.romaneioNumber}: ${leadError.message}`);
            continue;
          }

          leadId = newLead.id;
          importResult.leadsCreated++;
          addLog(`✓ Lead criado: ${romaneio.clienteName}`);

          // Add responsible
          await supabase.from('lead_responsibles').insert({
            lead_id: leadId,
            user_id: importerUserId,
            organization_id: organizationId,
          });
        }

        // Create sale
        const productDetails = romaneio.products
          .map(p => `${p.description} (${p.quantity}x R$${p.unitPrice.toFixed(2)} = R$${p.totalPrice.toFixed(2)})`)
          .join('\n');

        // Parse delivery date
        const [day, month, year] = romaneio.deliveryDate.split('/');
        const deliveryDate = year && month && day ? `${year}-${month}-${day}` : null;

        // Determine delivery type based on text
        let deliveryType: 'pickup' | 'motoboy' | 'carrier' = 'pickup';
        if (romaneio.deliveryType.toLowerCase().includes('motoboy') || romaneio.region) {
          deliveryType = 'motoboy';
        } else if (romaneio.deliveryType.toLowerCase().includes('correio') || romaneio.deliveryType.toLowerCase().includes('transport')) {
          deliveryType = 'carrier';
        }

        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            organization_id: organizationId,
            lead_id: leadId,
            created_by: importerUserId,
            seller_user_id: importerUserId,
            subtotal_cents: Math.round(romaneio.totalValue * 100),
            discount_cents: 0,
            total_cents: Math.round(romaneio.totalValue * 100),
            delivery_type: deliveryType,
            scheduled_delivery_date: deliveryDate,
            scheduled_delivery_shift: romaneio.turno?.toLowerCase() === 'manhã' ? 'morning' : romaneio.turno?.toLowerCase() === 'tarde' ? 'afternoon' : 'morning',
            status: 'delivered',
            payment_status: romaneio.isPaid ? 'paid' : 'pending',
            observation_1: `[Importado do sistema antigo - Romaneio #${romaneio.romaneioNumber}]`,
            observation_2: productDetails,
            delivery_notes: `${romaneio.deliveryNotes}\nDigitador: ${romaneio.digitador}\nTipo: ${romaneio.deliveryType}`,
          })
          .select()
          .single();

        if (saleError) {
          addLog(`❌ Erro ao criar venda: ${saleError.message}`);
          importResult.errors.push(`Romaneio #${romaneio.romaneioNumber}: erro na venda`);
          continue;
        }

        // Get default product (Manipulado) or create placeholder
        const { data: products } = await supabase
          .from('lead_products')
          .select('id, name')
          .eq('organization_id', organizationId)
          .ilike('name', '%manipulado%')
          .limit(1);

        const defaultProductId = products?.[0]?.id;
        const defaultProductName = products?.[0]?.name || 'Produto Importado';

        if (defaultProductId) {
          // Create sale item
          for (const product of romaneio.products) {
            await supabase.from('sale_items').insert({
              sale_id: sale.id,
              product_id: defaultProductId,
              product_name: product.description || defaultProductName,
              quantity: product.quantity || 1,
              unit_price_cents: Math.round(product.unitPrice * 100),
              total_cents: Math.round(product.totalPrice * 100),
              discount_cents: 0,
              notes: `Código original: ${product.code}`,
              requisition_number: product.description.match(/Requisição Nº:\s*(\d+\/?\d*)/)?.[1] || null,
            });
          }
        }

        importResult.salesCreated++;
        addLog(`✓ Venda criada: Romaneio #${romaneio.romaneioNumber}`);
      }

      setResults(importResult);
      addLog(`\n=== IMPORTAÇÃO CONCLUÍDA ===`);
      addLog(`Leads criados: ${importResult.leadsCreated}`);
      addLog(`Leads atualizados: ${importResult.leadsUpdated}`);
      addLog(`Vendas criadas: ${importResult.salesCreated}`);
      addLog(`Erros: ${importResult.errors.length}`);

      toast({
        title: 'Importação concluída!',
        description: `${importResult.leadsCreated} leads criados, ${importResult.salesCreated} vendas importadas`,
      });
    } catch (error: any) {
      console.error('Import error:', error);
      addLog(`❌ ERRO: ${error.message}`);
      toast({
        title: 'Erro na importação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:application/pdf;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-2">
          <strong>Como funciona:</strong> Faça upload de PDFs de romaneios do sistema antigo. 
          Cada página será interpretada e os leads/vendas serão importados automaticamente.
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Se o lead já existir (mesmo telefone), apenas a venda será adicionada</li>
          <li>Produtos não encontrados serão salvos como observação na venda</li>
          <li>Status das vendas importadas: "Entregue"</li>
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
          id="romaneio-upload"
          disabled={isProcessing}
        />
        <label htmlFor="romaneio-upload">
          <Button asChild disabled={isProcessing}>
            <span className="cursor-pointer">
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Selecionar PDF de Romaneios
                </>
              )}
            </span>
          </Button>
        </label>
      </div>

      {isProcessing && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-muted-foreground">{Math.round(progress)}% concluído</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="border rounded-lg">
          <div className="flex items-center justify-between p-2 border-b bg-muted/30">
            <span className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Log de Importação
            </span>
            {!isProcessing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <ScrollArea className="h-48 p-3">
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className={
                  log.includes('❌') ? 'text-red-500' :
                  log.includes('✓') ? 'text-green-500' :
                  log.includes('⚠️') ? 'text-yellow-500' :
                  'text-muted-foreground'
                }>
                  {log}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {results && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{results.leadsCreated}</div>
            <div className="text-xs text-muted-foreground">Leads Criados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-500">{results.leadsUpdated}</div>
            <div className="text-xs text-muted-foreground">Leads Atualizados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-500">{results.salesCreated}</div>
            <div className="text-xs text-muted-foreground">Vendas Criadas</div>
          </div>
        </div>
      )}
    </div>
  );
}
