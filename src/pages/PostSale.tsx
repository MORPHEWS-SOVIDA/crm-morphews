import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { 
  usePendingPostSaleSurveys, 
  useAllPostSaleSurveys,
  getPostSaleSurveyStatusLabel,
  getPostSaleSurveyStatusColor,
  getDeliveryTypeLabel,
  PostSaleSurvey
} from '@/hooks/usePostSaleSurveys';
import { PostSaleSurveyForm } from '@/components/post-sale/PostSaleSurveyForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from '@/components/ui/table';
import { 
  ClipboardList, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  ChevronRight,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { WhatsAppButton } from '@/components/WhatsAppButton';

export default function PostSale() {
  const navigate = useNavigate();
  const { data: pendingSurveys, isLoading: loadingPending } = usePendingPostSaleSurveys();
  const { data: allSurveys, isLoading: loadingAll } = useAllPostSaleSurveys();
  
  const [selectedSurvey, setSelectedSurvey] = useState<PostSaleSurvey | null>(null);
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };
  
  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };
  
  const pendingCount = pendingSurveys?.filter(s => s.status === 'pending').length || 0;
  const attemptedCount = pendingSurveys?.filter(s => s.status === 'attempted').length || 0;
  const completedCount = allSurveys?.filter(s => s.status === 'completed').length || 0;

  const SurveyRow = ({ survey }: { survey: PostSaleSurvey }) => (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => setSelectedSurvey(survey)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{survey.lead?.name}</p>
            <p className="text-sm text-muted-foreground">{survey.lead?.whatsapp}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {formatCurrency(survey.sale?.total_cents || 0)}
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {getDeliveryTypeLabel(survey.sale?.delivery_type as any || survey.delivery_type)}
        </Badge>
      </TableCell>
      <TableCell>
        {formatDate(survey.sale?.delivered_at || null)}
      </TableCell>
      <TableCell>
        <Badge className={getPostSaleSurveyStatusColor(survey.status)}>
          {getPostSaleSurveyStatusLabel(survey.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {survey.lead?.whatsapp && (
            <div onClick={(e) => e.stopPropagation()}>
              <WhatsAppButton phone={survey.lead.whatsapp} variant="icon" />
            </div>
          )}
          <Button variant="ghost" size="icon">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Pós-Venda</h1>
            <p className="text-muted-foreground">Gerencie pesquisas de satisfação das entregas</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Tentativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">{attemptedCount}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Concluídas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{completedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pendentes
              {(pendingCount + attemptedCount) > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {pendingCount + attemptedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Concluídas
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Pesquisas Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPending ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !pendingSurveys || pendingSurveys.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>Nenhuma pesquisa pendente!</p>
                    <p className="text-sm">Todas as vendas entregues foram contatadas.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Tipo Entrega</TableHead>
                          <TableHead>Data Entrega</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingSurveys.map((survey) => (
                          <SurveyRow key={survey.id} survey={survey} />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Pesquisas Concluídas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingAll ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !allSurveys?.filter(s => s.status === 'completed').length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma pesquisa concluída ainda.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Tipo Entrega</TableHead>
                          <TableHead>Data Entrega</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[100px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allSurveys
                          .filter(s => s.status === 'completed')
                          .map((survey) => (
                            <SurveyRow key={survey.id} survey={survey} />
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Survey Form Dialog */}
      <Dialog open={!!selectedSurvey} onOpenChange={(open) => !open && setSelectedSurvey(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pesquisa Pós-Venda</DialogTitle>
          </DialogHeader>
          {selectedSurvey && (
            <PostSaleSurveyForm 
              survey={selectedSurvey} 
              onComplete={() => setSelectedSurvey(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
