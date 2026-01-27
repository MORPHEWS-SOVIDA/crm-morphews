import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ClipboardList, Download, Loader2, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  usePostSaleReport,
  usePostSaleQuestions,
  questionTypeLabels,
} from '@/hooks/usePostSaleQuestions';
import { useTenantMembers } from '@/hooks/multi-tenant';

export default function PostSaleReport() {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [sellerId, setSellerId] = useState<string>('all');

  const { data: questions = [] } = usePostSaleQuestions();
  const { data: members = [] } = useTenantMembers();
  const { data: surveys = [], isLoading } = usePostSaleReport({
    startDate,
    endDate,
    sellerId: sellerId === 'all' ? undefined : sellerId,
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const getResponseValue = (responses: any[], questionId: string): string => {
    const response = responses?.find((r: any) => r.question_id === questionId);
    if (!response) return '-';

    const question = questions.find(q => q.id === questionId);
    if (!question) return '-';

    switch (question.question_type) {
      case 'yes_no':
        return response.answer_boolean === true ? 'Sim' : response.answer_boolean === false ? 'Não' : '-';
      case 'rating_0_10':
        return response.answer_number?.toString() ?? '-';
      case 'text':
        return response.answer_text || '-';
      case 'medication':
        if (response.answer_boolean === false) return 'Não usa';
        return response.answer_text || 'Usa (sem detalhes)';
      default:
        return '-';
    }
  };

  const handleExportCSV = () => {
    if (surveys.length === 0) return;

    const activeQuestions = questions.filter(q => q.is_active);

    // Header
    const headers = [
      'Data',
      'Romaneio',
      'Cliente',
      'WhatsApp',
      'Valor',
      'Vendedor',
      ...activeQuestions.map(q => q.question),
      'Observações',
    ];

    // Rows
    const rows = surveys.map((survey: any) => {
      const seller = members.find(m => m.user_id === survey.sale?.seller_user_id);
      const sellerName = seller?.profile 
        ? `${seller.profile.first_name} ${seller.profile.last_name || ''}`.trim() 
        : '-';
      return [
        survey.completed_at ? format(new Date(survey.completed_at), 'dd/MM/yyyy HH:mm') : '-',
        survey.sale?.romaneio_number || '-',
        survey.lead?.name || '-',
        survey.lead?.whatsapp || '-',
        survey.sale?.total_cents ? formatCurrency(survey.sale.total_cents) : '-',
        sellerName,
        ...activeQuestions.map(q => getResponseValue(survey.responses, q.id)),
        survey.notes || '-',
      ];
    });

    // Build CSV
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')),
    ].join('\n');

    // Download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-pos-venda-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeQuestions = questions.filter(q => q.is_active);

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-primary" />
              Relatório de Pós-Venda
            </h1>
            <p className="text-muted-foreground">
              Visualize todas as respostas das pesquisas de satisfação
            </p>
          </div>

          <Button onClick={handleExportCSV} disabled={surveys.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Seller */}
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={sellerId} onValueChange={setSellerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os vendedores</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profile?.first_name} {member.profile?.last_name || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isLoading ? 'Carregando...' : `${surveys.length} pesquisa(s) encontrada(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : surveys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma pesquisa encontrada para o período selecionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Data</TableHead>
                      <TableHead className="whitespace-nowrap">Romaneio</TableHead>
                      <TableHead className="whitespace-nowrap">Cliente</TableHead>
                      <TableHead className="whitespace-nowrap">Valor</TableHead>
                      {activeQuestions.map((q) => (
                        <TableHead key={q.id} className="whitespace-nowrap max-w-[200px]">
                          {q.question.length > 30 ? q.question.substring(0, 30) + '...' : q.question}
                        </TableHead>
                      ))}
                      <TableHead className="whitespace-nowrap">Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveys.map((survey: any) => (
                      <TableRow key={survey.id}>
                        <TableCell className="whitespace-nowrap">
                          {survey.completed_at
                            ? format(new Date(survey.completed_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                            : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-primary">
                          #{survey.sale?.romaneio_number || '-'}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {survey.lead?.name || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {survey.sale?.total_cents ? formatCurrency(survey.sale.total_cents) : '-'}
                        </TableCell>
                        {activeQuestions.map((q) => (
                          <TableCell key={q.id} className="max-w-[150px] truncate">
                            {getResponseValue(survey.responses, q.id)}
                          </TableCell>
                        ))}
                        <TableCell className="max-w-[200px] truncate">
                          {survey.notes || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
