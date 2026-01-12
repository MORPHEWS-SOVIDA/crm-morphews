import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DemandBoardsManager } from '@/components/demands/DemandBoardsManager';
import { DemandSlaConfig } from '@/components/demands/DemandSlaConfig';
import { DemandLabelsManager } from '@/components/demands/DemandLabelsManager';
import { Settings, Tag, Clock } from 'lucide-react';

export default function DemandsSettings() {
  const [activeTab, setActiveTab] = useState('boards');

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações de Demandas</h1>
          <p className="text-muted-foreground">Gerencie quadros, colunas, SLA e etiquetas</p>
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
