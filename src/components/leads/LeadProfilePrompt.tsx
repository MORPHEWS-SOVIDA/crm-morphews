import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cake, Users, Heart, Sparkles, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Lista de times brasileiros populares
const BRAZILIAN_TEAMS = [
  'Flamengo', 'Corinthians', 'São Paulo', 'Palmeiras', 'Santos',
  'Grêmio', 'Internacional', 'Cruzeiro', 'Atlético-MG', 'Fluminense',
  'Vasco', 'Botafogo', 'Bahia', 'Sport', 'Fortaleza',
  'Ceará', 'Athletico-PR', 'Coritiba', 'Goiás', 'Vitória',
  'Não torço', 'Outro'
];

const GENDER_OPTIONS = [
  { value: 'masculino', label: 'Masculino', emoji: '👨' },
  { value: 'feminino', label: 'Feminino', emoji: '👩' },
  { value: 'outro', label: 'Outro', emoji: '🧑' },
  { value: 'prefiro_nao_informar', label: 'Prefiro não informar', emoji: '🤐' },
];

interface LeadProfilePromptProps {
  leadId: string;
  leadName: string;
  currentBirthDate?: string | null;
  currentGender?: string | null;
  currentFavoriteTeam?: string | null;
  onUpdate: (data: { birth_date?: string; gender?: string; favorite_team?: string }) => Promise<void>;
  className?: string;
}

export function LeadProfilePrompt({
  leadId,
  leadName,
  currentBirthDate,
  currentGender,
  currentFavoriteTeam,
  onUpdate,
  className,
}: LeadProfilePromptProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [birthDate, setBirthDate] = useState(currentBirthDate || '');
  const [gender, setGender] = useState(currentGender || '');
  const [favoriteTeam, setFavoriteTeam] = useState(currentFavoriteTeam || '');
  const [isSaving, setIsSaving] = useState(false);
  const [savedFields, setSavedFields] = useState<string[]>([]);

  // Sync local state with props when they change (e.g., after saving)
  useEffect(() => {
    if (currentBirthDate && currentBirthDate !== birthDate) {
      setBirthDate(currentBirthDate);
    }
  }, [currentBirthDate]);

  useEffect(() => {
    if (currentGender && currentGender !== gender) {
      setGender(currentGender);
    }
  }, [currentGender]);

  useEffect(() => {
    if (currentFavoriteTeam && currentFavoriteTeam !== favoriteTeam) {
      setFavoriteTeam(currentFavoriteTeam);
    }
  }, [currentFavoriteTeam]);

  // Count missing fields
  const missingFields = [
    !currentBirthDate && !birthDate,
    !currentGender && !gender,
    !currentFavoriteTeam && !favoriteTeam,
  ].filter(Boolean).length;

  const allFieldsFilled = missingFields === 0 && (currentBirthDate || birthDate) && (currentGender || gender) && (currentFavoriteTeam || favoriteTeam);

  // Auto-expand if fields are missing
  useEffect(() => {
    if (missingFields > 0 && !allFieldsFilled) {
      setIsExpanded(true);
    }
  }, [missingFields, allFieldsFilled]);

  const handleSave = async () => {
    setIsSaving(true);
    const updates: { birth_date?: string; gender?: string; favorite_team?: string } = {};
    const saved: string[] = [];
    
    if (birthDate && birthDate !== currentBirthDate) {
      updates.birth_date = birthDate;
      saved.push('birth_date');
    }
    if (gender && gender !== currentGender) {
      updates.gender = gender;
      saved.push('gender');
    }
    if (favoriteTeam && favoriteTeam !== currentFavoriteTeam) {
      updates.favorite_team = favoriteTeam;
      saved.push('favorite_team');
    }

    if (Object.keys(updates).length > 0) {
      await onUpdate(updates);
      setSavedFields(saved);
      setTimeout(() => setSavedFields([]), 2000);
    }
    setIsSaving(false);
  };

  const hasChanges = 
    (birthDate && birthDate !== currentBirthDate) ||
    (gender && gender !== currentGender) ||
    (favoriteTeam && favoriteTeam !== currentFavoriteTeam);

  // Show filled info for existing leads so seller can see it
  const showFilledInfo = currentBirthDate || currentGender || currentFavoriteTeam;
  
  // If all filled, show a compact summary for the seller to use
  if (allFieldsFilled && !hasChanges) {
    return (
      <div className={cn(
        "p-3 rounded-xl border bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-green-700 dark:text-green-400">
                Sobre {leadName.split(' ')[0]}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                {currentBirthDate && (
                  <span className="flex items-center gap-1">
                    <Cake className="w-3 h-3 text-pink-500" />
                    {new Date(currentBirthDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </span>
                )}
                {currentGender && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-purple-500" />
                    {GENDER_OPTIONS.find(g => g.value === currentGender)?.label || currentGender}
                  </span>
                )}
                {currentFavoriteTeam && (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-orange-500" />
                    {currentFavoriteTeam}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted-foreground"
          >
            {isExpanded ? 'Fechar' : 'Editar'}
          </Button>
        </div>
        
        {/* Expandable edit form */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-green-200 dark:border-green-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {renderEditFields()}
                </div>
                {hasChanges && (
                  <div className="flex justify-end mt-3">
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white gap-2"
                    >
                      {isSaving ? 'Salvando...' : 'Atualizar'}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Helper function to render edit fields
  function renderEditFields() {
    return (
      <>
        {/* Birth Date */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "relative p-3 rounded-lg border-2 transition-all",
            savedFields.includes('birth_date')
              ? "border-green-400 bg-green-50 dark:bg-green-950/30"
              : birthDate 
                ? "border-pink-300 bg-pink-50/50 dark:bg-pink-950/20"
                : "border-transparent bg-white/80 dark:bg-gray-900/50"
          )}
        >
          <Label className="text-xs font-medium flex items-center gap-1.5 text-pink-600 dark:text-pink-400 mb-1.5">
            <Cake className="w-3.5 h-3.5" />
            Data de Nascimento
            {savedFields.includes('birth_date') && <Check className="w-3 h-3 text-green-500" />}
          </Label>
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="h-9 text-sm bg-transparent border-0 p-0 focus-visible:ring-0"
          />
        </motion.div>

        {/* Gender */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "relative p-3 rounded-lg border-2 transition-all",
            savedFields.includes('gender')
              ? "border-green-400 bg-green-50 dark:bg-green-950/30"
              : gender 
                ? "border-purple-300 bg-purple-50/50 dark:bg-purple-950/20"
                : "border-transparent bg-white/80 dark:bg-gray-900/50"
          )}
        >
          <Label className="text-xs font-medium flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1.5">
            <Users className="w-3.5 h-3.5" />
            Gênero
            {savedFields.includes('gender') && <Check className="w-3 h-3 text-green-500" />}
          </Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger className="h-9 text-sm bg-transparent border-0 p-0 focus:ring-0">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="flex items-center gap-2">
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Favorite Team */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "relative p-3 rounded-lg border-2 transition-all",
            savedFields.includes('favorite_team')
              ? "border-green-400 bg-green-50 dark:bg-green-950/30"
              : favoriteTeam 
                ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20"
                : "border-transparent bg-white/80 dark:bg-gray-900/50"
          )}
        >
          <Label className="text-xs font-medium flex items-center gap-1.5 text-orange-600 dark:text-orange-400 mb-1.5">
            <Heart className="w-3.5 h-3.5" />
            Time do Coração
            {savedFields.includes('favorite_team') && <Check className="w-3 h-3 text-green-500" />}
          </Label>
          <Select value={favoriteTeam} onValueChange={setFavoriteTeam}>
            <SelectTrigger className="h-9 text-sm bg-transparent border-0 p-0 focus:ring-0">
              <SelectValue placeholder="Qual time?" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_TEAMS.map(team => (
                <SelectItem key={team} value={team}>
                  {team === 'Flamengo' ? '🔴⚫ ' : team === 'Corinthians' ? '⚫⚪ ' : team === 'Palmeiras' ? '💚 ' : team === 'São Paulo' ? '🔴⚪⚫ ' : team === 'Grêmio' ? '🔵⚫⚪ ' : team === 'Internacional' ? '🔴⚪ ' : '⚽ '}
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border-2",
        allFieldsFilled 
          ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
          : "border-dashed border-purple-300 dark:border-purple-700 bg-gradient-to-r from-purple-50/80 via-pink-50/80 to-orange-50/80 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-orange-950/30",
        className
      )}
    >
      {/* Animated background particles */}
      {!allFieldsFilled && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute w-20 h-20 rounded-full bg-purple-200/30 dark:bg-purple-500/10"
            animate={{
              x: [0, 100, 50, 0],
              y: [0, 50, 100, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{ top: '10%', left: '10%' }}
          />
          <motion.div
            className="absolute w-16 h-16 rounded-full bg-pink-200/30 dark:bg-pink-500/10"
            animate={{
              x: [0, -50, 20, 0],
              y: [0, 80, 40, 0],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{ top: '60%', right: '15%' }}
          />
          <motion.div
            className="absolute w-12 h-12 rounded-full bg-orange-200/30 dark:bg-orange-500/10"
            animate={{
              x: [0, 30, -30, 0],
              y: [0, -40, 20, 0],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            style={{ bottom: '20%', left: '50%' }}
          />
        </div>
      )}

      {/* Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={!allFieldsFilled ? { 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              allFieldsFilled 
                ? "bg-green-100 dark:bg-green-900/50"
                : "bg-gradient-to-br from-purple-500 to-pink-500"
            )}
          >
            {allFieldsFilled ? (
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-white" />
            )}
          </motion.div>
          
          <div>
            <h3 className={cn(
              "font-semibold text-sm",
              allFieldsFilled 
                ? "text-green-700 dark:text-green-400"
                : "text-purple-700 dark:text-purple-300"
            )}>
              {allFieldsFilled ? 'Perfil Completo! 🎉' : '✨ Conheça melhor seu cliente!'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {allFieldsFilled 
                ? `Dados de ${leadName.split(' ')[0]} atualizados`
                : `${missingFields} ${missingFields === 1 ? 'informação falta' : 'informações faltam'} para ${leadName.split(' ')[0]}`
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!allFieldsFilled && missingFields > 0 && (
            <div className="flex -space-x-1">
              {!currentBirthDate && !birthDate && (
                <div className="w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center border-2 border-white dark:border-gray-800">
                  <Cake className="w-3 h-3 text-pink-500" />
                </div>
              )}
              {!currentGender && !gender && (
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center border-2 border-white dark:border-gray-800">
                  <Users className="w-3 h-3 text-purple-500" />
                </div>
              )}
              {!currentFavoriteTeam && !favoriteTeam && (
                <div className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center border-2 border-white dark:border-gray-800">
                  <Heart className="w-3 h-3 text-orange-500" />
                </div>
              )}
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {renderEditFields()}
              </div>

              {/* Save button */}
              <AnimatePresence>
                {hasChanges && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex justify-end"
                  >
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white gap-2"
                    >
                      {isSaving ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Atualizar Perfil
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
