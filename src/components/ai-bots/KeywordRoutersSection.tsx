import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Key, Plus, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useKeywordRouters, useKeywordRouterRules, useDeleteKeywordRouter } from "@/hooks/useKeywordRouters";
import { KeywordRouterCard } from "./KeywordRouterCard";
import { KeywordRouterWizard } from "./KeywordRouterWizard";
import { KeywordRouterDetailDialog } from "./KeywordRouterDetailDialog";

export function KeywordRoutersSection() {
  const { data: routers, isLoading } = useKeywordRouters();
  const deleteRouter = useDeleteKeywordRouter();
  
  const [showWizard, setShowWizard] = useState(false);
  const [selectedRouterId, setSelectedRouterId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-full mb-4" />
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!routers || routers.length === 0) {
    return (
      <>
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <Key className="h-10 w-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Nenhum roteador por palavra de entrada</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Crie roteadores que ativam robôs específicos baseado na primeira mensagem do cliente.
              Ideal para campanhas de marketing com diferentes produtos!
            </p>
            <Button onClick={() => setShowWizard(true)} size="lg" className="gap-2">
              <Zap className="h-5 w-5" />
              Criar Primeiro Roteador
            </Button>
          </CardContent>
        </Card>

        <KeywordRouterWizard
          open={showWizard}
          onOpenChange={setShowWizard}
          onComplete={() => setShowWizard(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setShowWizard(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Roteador por Palavra
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {routers.map((router) => (
          <KeywordRouterCardWithRules
            key={router.id}
            router={router}
            onSelect={() => setSelectedRouterId(router.id)}
            onDelete={() => deleteRouter.mutate(router.id)}
            isDeleting={deleteRouter.isPending}
          />
        ))}
      </div>

      <KeywordRouterWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={() => setShowWizard(false)}
      />

      <KeywordRouterDetailDialog
        routerId={selectedRouterId}
        open={!!selectedRouterId}
        onOpenChange={(open) => !open && setSelectedRouterId(null)}
      />
    </>
  );
}

// Helper component to fetch rules count
function KeywordRouterCardWithRules({
  router,
  onSelect,
  onDelete,
  isDeleting,
}: {
  router: any;
  onSelect: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { data: rules } = useKeywordRouterRules(router.id);

  return (
    <KeywordRouterCard
      router={router}
      rulesCount={rules?.length || 0}
      onSelect={onSelect}
      onDelete={onDelete}
      isDeleting={isDeleting}
    />
  );
}
