import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, UserCheck, Lock, Check, Loader2 } from 'lucide-react';
import { useManagers, useValidateAuthorization } from '@/hooks/useDiscountAuthorization';
import { cn } from '@/lib/utils';

interface DiscountAuthorizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productId: string;
  minimumPriceCents: number;
  requestedPriceCents: number;
  onAuthorized: (authorizationId: string, authorizedByName: string) => void;
}

export function DiscountAuthorizationDialog({
  open,
  onOpenChange,
  productName,
  productId,
  minimumPriceCents,
  requestedPriceCents,
  onAuthorized,
}: DiscountAuthorizationDialogProps) {
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'select' | 'code'>('select');

  const { data: managers = [], isLoading: loadingManagers } = useManagers();
  const validateAuth = useValidateAuthorization();

  const selectedManager = managers.find((m) => m.user_id === selectedManagerId);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const discountAmount = minimumPriceCents - requestedPriceCents;
  const discountPercent = ((discountAmount / minimumPriceCents) * 100).toFixed(1);

  const handleSelectManager = () => {
    if (!selectedManagerId) {
      setError('Selecione um gerente para continuar');
      return;
    }
    setError('');
    setStep('code');
  };

  const handleValidateCode = async () => {
    if (code.length !== 4) {
      setError('O código deve ter 4 caracteres');
      return;
    }

    setError('');

    try {
      const result = await validateAuth.mutateAsync({
        authorizerUserId: selectedManagerId,
        code,
        productId,
        minimumPriceCents,
        authorizedPriceCents: requestedPriceCents,
      });

      if (result.success && result.authorizationId) {
        const managerName = selectedManager
          ? `${selectedManager.first_name} ${selectedManager.last_name}`
          : 'Gerente';
        onAuthorized(result.authorizationId, managerName);
        handleClose();
      } else {
        setError(result.error || 'Código inválido');
      }
    } catch (err) {
      setError('Erro ao validar autorização');
    }
  };

  const handleClose = () => {
    setSelectedManagerId('');
    setCode('');
    setError('');
    setStep('select');
    onOpenChange(false);
  };

  const handleCodeChange = (value: string) => {
    // Allow only letters and numbers, max 4 chars
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
    setCode(cleaned);
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Autorização Necessária
          </DialogTitle>
          <DialogDescription>
            Este valor está abaixo do preço mínimo e requer autorização de um gerente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Price Comparison */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm font-medium text-amber-900">{productName}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-amber-700">Preço Mínimo:</span>
                  <p className="font-bold text-amber-900">{formatPrice(minimumPriceCents)}</p>
                </div>
                <div>
                  <span className="text-amber-700">Valor Solicitado:</span>
                  <p className="font-bold text-red-600">{formatPrice(requestedPriceCents)}</p>
                </div>
              </div>
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Desconto de {formatPrice(discountAmount)} ({discountPercent}%)
              </Badge>
            </CardContent>
          </Card>

          {step === 'select' ? (
            /* Step 1: Select Manager */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Quem vai autorizar este desconto?</Label>
                {loadingManagers ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : managers.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      Nenhum gerente disponível para autorização.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o gerente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.map((manager) => (
                        <SelectItem key={manager.user_id} value={manager.user_id}>
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4" />
                            {manager.first_name} {manager.last_name}
                            <Badge variant="secondary" className="text-xs ml-2">
                              {manager.role}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={handleSelectManager} disabled={!selectedManagerId}>
                  Continuar
                </Button>
              </div>
            </div>
          ) : (
            /* Step 2: Enter Code */
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">
                  Peça o código para{' '}
                  <strong>
                    {selectedManager?.first_name} {selectedManager?.last_name}
                  </strong>
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Código de Autorização
                </Label>
                <Input
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Ex: A123"
                  className={cn(
                    "text-center text-2xl font-bold tracking-widest uppercase",
                    error && "border-destructive"
                  )}
                  maxLength={4}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  O código possui 1 letra e 3 números
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('select')}>
                  Voltar
                </Button>
                <Button
                  onClick={handleValidateCode}
                  disabled={code.length !== 4 || validateAuth.isPending}
                >
                  {validateAuth.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Validar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
