import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Key, Bot, Settings, Trash2 } from "lucide-react";
import { KeywordBotRouter } from "@/hooks/useKeywordRouters";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface KeywordRouterCardProps {
  router: KeywordBotRouter;
  rulesCount: number;
  onSelect: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function KeywordRouterCard({
  router,
  rulesCount,
  onSelect,
  onDelete,
  isDeleting,
}: KeywordRouterCardProps) {
  return (
    <Card
      className={`transition-all hover:shadow-lg cursor-pointer ${
        !router.is_active ? "opacity-60" : ""
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{router.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {router.description || "Roteador por palavra de entrada"}
              </CardDescription>
            </div>
          </div>

          <Badge variant={router.is_active ? "default" : "secondary"}>
            {router.is_active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Fallback Bot */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
          <span className="text-xs text-muted-foreground">Padrão:</span>
          {router.fallback_bot?.avatar_url ? (
            <img
              src={router.fallback_bot.avatar_url}
              alt={router.fallback_bot.name}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-3 w-3 text-primary" />
            </div>
          )}
          <span className="text-sm font-medium">{router.fallback_bot?.name}</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Key className="h-4 w-4" />
            {rulesCount} regra{rulesCount !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configurar
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover roteador?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O roteador "{router.name}" e todas suas regras serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? "Removendo..." : "Remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
