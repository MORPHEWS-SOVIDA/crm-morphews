import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Bot, 
  Route, 
  Settings, 
  Trash2,
  MoreVertical 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BotTeamWithDetails } from "@/hooks/useBotTeams";

interface BotTeamCardProps {
  team: BotTeamWithDetails;
  onSelect: (teamId: string) => void;
  onDelete: (teamId: string) => void;
  isDeleting?: boolean;
}

export function BotTeamCard({ team, onSelect, onDelete, isDeleting }: BotTeamCardProps) {
  return (
    <Card 
      className={`transition-all hover:shadow-lg cursor-pointer ${
        !team.is_active ? 'opacity-60' : ''
      }`}
      onClick={() => onSelect(team.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{team.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {team.description || "Time de robôs IA"}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={team.is_active ? "default" : "secondary"}>
              {team.is_active ? "Ativo" : "Inativo"}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onSelect(team.id)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover time?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O time "{team.name}" e todas as suas rotas serão removidos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => onDelete(team.id)}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Team Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>{team.members_count || 0} robôs</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Route className="h-4 w-4" />
            <span>{team.routes_count || 0} rotas</span>
          </div>
        </div>

        {/* Initial Bot */}
        {team.initial_bot && (
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
            {team.initial_bot.avatar_url ? (
              <img
                src={team.initial_bot.avatar_url}
                alt={team.initial_bot.name}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-3 w-3 text-primary" />
              </div>
            )}
            <span className="text-sm">
              <span className="text-muted-foreground">Maestro:</span>{" "}
              <span className="font-medium">{team.initial_bot.name}</span>
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(team.id);
            }}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configurar Rotas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
