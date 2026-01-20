import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

  const extractTextFromPdf = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pages: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Build text with proper spacing
      let pageText = '';
      let lastY = -1;
      
      for (const item of textContent.items) {
        if ('str' in item) {
          const textItem = item as { str: string; transform: number[] };
          const y = textItem.transform[5];
          
          // Add newline if Y position changed significantly
          if (lastY !== -1 && Math.abs(lastY - y) > 5) {
            pageText += '\n';
          } else if (pageText && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
            pageText += ' ';
          }
          
          pageText += textItem.str;
          lastY = y;
        }
      }
      
      pages.push(pageText);
    }
    
    return pages;
  };

  const parseRomaneioPage = (pageText: string): ParsedRomaneio | null => {
    try {
      // Extract romaneio number
      const romaneioMatch = pageText.match(/ROMANEIO:\s*(\d+)/);
      if (!romaneioMatch) return null;

      // Extract digitador
      const digitadorMatch = pageText.match(/DIGITADOR:\s*(.+?)(?=\s*DATA DE EMISSÃO)/s);
      
      // Extract emission date
      const emissionMatch = pageText.match(/DATA DE EMISSÃO:\s*(\d{2}\/\d{2}\/\d{4})/);
      
      // Extract delivery date
      const deliveryDateMatch = pageText.match(/DATA DE ENTREGA:\s*(\d{2}\/\d{2}\/\d{4})/);
      
      // Extract turno
      const turnoMatch = pageText.match(/TURNO:\s*(MANHÃ|TARDE|NOITE|DIA INTEIRO|MADRUGADA)/i);

      // Extract client info - format: "ID - NAME" after CLIENTE
      const clienteMatch = pageText.match(/CLIENTE\s+(\d+)\s*[-–]\s*([^\n]+?)(?=\s*CPF\/CNPJ)/s);
      
      // Extract CPF/CNPJ
      const cpfMatch = pageText.match(/CPF\/CNPJ:\s*([^\s]+)/);
      
      // Extract phone (look for FONE/CEL pattern)
      const phoneMatch = pageText.match(/FONE\/CEL:\s*(\d+)/);

      // Extract address - after ENDEREÇO heading
      const addressSection = pageText.match(/ENDEREÇO\s+(.+?)(?=\s*BAIRRO)/s);
      const addressParts = addressSection ? parseAddress(addressSection[1].trim()) : { street: '', number: '', complement: '' };
      
      // Extract neighborhood
      const neighborhoodMatch = pageText.match(/BAIRRO:\s*([^\n]+?)(?=\s*CEP)/);
      
      // Extract CEP and city/state
      const cepCityMatch = pageText.match(/CEP:\s*([\d-]+)\s*[-–]\s*([^–\n]+?)(?=\s*[-–]\s*Brasil|\s*REGIÃO)/);
      
      // Extract region
      const regionMatch = pageText.match(/REGIÃO:\s*([^\n]+)/);

      // Extract delivery notes (OBS.ENTREGA or OBS. ENTREGA)
      const obsMatch = pageText.match(/OBS\.?\s*ENTREGA\s+([^#]+?)(?=\s*TIPO DE ENTREGA)/s);
      
      // Extract delivery type
      const deliveryTypeMatch = pageText.match(/TIPO DE ENTREGA\s+([^\n]+)/);

      // Extract products from table format
      const products = parseProductsFromText(pageText);

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
    const cleanAddress = addressLine.replace(/\s+/g, ' ').trim();
    const match = cleanAddress.match(/^(.+?),?\s*(\d+)\s*(?:[-–]\s*(.+))?$/);
    if (match) {
      return {
        street: match[1]?.trim() || '',
        number: match[2] || '',
        complement: match[3]?.trim() || '',
      };
    }
    return { street: addressLine, number: '', complement: '' };
  };

  const parseProductsFromText = (pageText: string): ParsedRomaneio['products'] => {
    const products: ParsedRomaneio['products'] = [];
    
    // Look for product entries between VALOR TOTAL header and EXIGE RECEITA
    const productSection = pageText.match(/VALOR TOTAL\s+(.+?)(?=EXIGE RECEITA)/s);
    if (productSection) {
      // Pattern: code | description | quantity | unit price | total
      const lines = productSection[1].split('\n');
      let currentProduct: string[] = [];
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // Check if line starts with a product code (number)
        if (/^\d+\s+/.test(trimmedLine)) {
          // New product line
          if (currentProduct.length > 0) {
            const parsed = parseProductLine(currentProduct.join(' '));
            if (parsed) products.push(parsed);
          }
          currentProduct = [trimmedLine];
        } else {
          // Continuation of previous product
          currentProduct.push(trimmedLine);
        }
      }
      
      // Don't forget last product
      if (currentProduct.length > 0) {
        const parsed = parseProductLine(currentProduct.join(' '));
        if (parsed) products.push(parsed);
      }
    }
    
    return products;
  };

  const parseProductLine = (line: string): ParsedRomaneio['products'][0] | null => {
    // Pattern: CODE DESCRIPTION QUANTITY UNIT_PRICE TOTAL_PRICE
    // Example: "51 LIFE COMBO 2 meses, Requisição Nº: 1,0000 250,0000 250,00"
    const match = line.match(/^(\d+)\s+(.+?)\s+([\d,]+)\s+([\d.,]+)\s+([\d.,]+)$/);
    if (match) {
      return {
        code: match[1],
        description: match[2].trim(),
        quantity: parseFloat(match[3].replace(',', '.')),
        unitPrice: parseFloat(match[4].replace('.', '').replace(',', '.')),
        totalPrice: parseFloat(match[5].replace('.', '').replace(',', '.')),
      };
    }
    return null;
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
      // Extract text from PDF using pdfjs-dist
      addLog('Extraindo texto do PDF...');
      const pages = await extractTextFromPdf(file);
      addLog(`PDF processado: ${pages.length} páginas encontradas`);

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
        if (romaneio.deliveryType.toLowerCase().includes('motoboy') || 
            romaneio.deliveryType.toLowerCase().includes('tele-entrega') ||
            romaneio.region) {
          deliveryType = 'motoboy';
        } else if (romaneio.deliveryType.toLowerCase().includes('correio') || 
                   romaneio.deliveryType.toLowerCase().includes('transport')) {
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
            scheduled_delivery_shift: romaneio.turno?.toLowerCase() === 'manhã' ? 'morning' : 
                                     romaneio.turno?.toLowerCase() === 'tarde' ? 'afternoon' : 'morning',
            status: 'delivered',
            payment_status: romaneio.isPaid ? 'paid' : 'pending',
            observation_1: `[Importado do sistema antigo - Romaneio #${romaneio.romaneioNumber}]`,
            observation_2: productDetails || `Valor total: R$${romaneio.totalValue.toFixed(2)}`,
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

        if (defaultProductId && romaneio.products.length > 0) {
          // Create sale items
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
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">{Math.round(progress)}% concluído</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="border rounded-lg">
          <div className="bg-muted px-4 py-2 border-b">
            <h4 className="font-medium">Log de Importação</h4>
          </div>
          <ScrollArea className="h-64 p-4">
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, idx) => (
                <div key={idx} className={
                  log.includes('❌') ? 'text-destructive' :
                  log.includes('⚠️') ? 'text-yellow-600' :
                  log.includes('✓') ? 'text-green-600' :
                  log.includes('===') ? 'font-bold text-primary' :
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
        <div className={`rounded-lg p-4 ${results.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
          <div className="flex items-center gap-2 mb-2">
            {results.errors.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <h4 className="font-medium">Resultado da Importação</h4>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Leads criados</div>
              <div className="font-bold text-lg">{results.leadsCreated}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Leads atualizados</div>
              <div className="font-bold text-lg">{results.leadsUpdated}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Vendas criadas</div>
              <div className="font-bold text-lg">{results.salesCreated}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Erros</div>
              <div className="font-bold text-lg">{results.errors.length}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
