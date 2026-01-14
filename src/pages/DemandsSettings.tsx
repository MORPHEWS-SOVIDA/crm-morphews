import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DemandBoardsManager } from '@/components/demands/DemandBoardsManager';
import { DemandSlaConfig } from '@/components/demands/DemandSlaConfig';
import { DemandLabelsManager } from '@/components/demands/DemandLabelsManager';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Settings, Tag, Clock, ArrowLeft } from 'lucide-react';

export default function DemandsSettings() {
  const [activeTab, setActiveTab] = useState('boards');

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações de Demandas</h1>
            <p className="text-muted-foreground">Gerencie quadros, colunas, SLA e etiquetas</p>
          </div>

          <Button variant="outline" asChild>
            <Link to="/demandas" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="boards" className="gap-2">
              <Settings className="h-4 w-4" />
              Quadros e Colunas
            </TabsTrigger>
            <TabsTrigger value="sla" className="gap-2">
              <Clock className="h-4 w-4" />
              Configuração SLA
            </TabsTrigger>
            <TabsTrigger value="labels" className="gap-2">
              <Tag className="h-4 w-4" />
              Etiquetas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boards" className="mt-6">
            <DemandBoardsManager />
          </TabsContent>

          <TabsContent value="sla" className="mt-6">
            <DemandSlaConfig />
          </TabsContent>

          <TabsContent value="labels" className="mt-6">
            <DemandLabelsManager />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
