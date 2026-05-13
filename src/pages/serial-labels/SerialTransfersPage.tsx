import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRightLeft, ScanLine, Hash, X } from 'lucide-react';
import { QRScanner } from '@/components/serial-labels/QRScanner';
import { useStockLocations } from '@/hooks/useStockLocations';
import { useSerialTransfers, useTransferSerials } from '@/hooks/useSerialTransfers';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SerialTransfersPage() {
  const { data: locations = [] } = useStockLocations();
  const { data: history = [] } = useSerialTransfers();
  const transferMutation = useTransferSerials();

  const [toLocationId, setToLocationId] = useState('');
  const [notes, setNotes] = useState('');

  // Range mode
  const [prefix, setPrefix] = useState('VIDA');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  // Scan mode
  const [scanning, setScanning] = useState(false);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);

  const buildRangeCodes = (): string[] => {
    const s = parseInt(rangeStart);
    const e = parseInt(rangeEnd);
    if (!s || !e || e < s) return [];
    const out: string[] = [];
    for (let i = s; i <= e; i++) out.push(`${prefix}${String(i).padStart(5, '0')}`);
    return out;
  };

  const handleTransferRange = async () => {
    if (!toLocationId) return toast.error('Selecione o local de destino');
    const codes = buildRangeCodes();
    if (!codes.length) return toast.error('Faixa numérica inválida');
    if (codes.length > 5000) return toast.error('Máximo de 5.000 etiquetas por transferência');
    await transferMutation.mutateAsync({ toLocationId, serialCodes: codes, notes });
    setRangeStart(''); setRangeEnd(''); setNotes('');
  };

  const handleTransferScanned = async () => {
    if (!toLocationId) return toast.error('Selecione o local de destino');
    if (!scannedCodes.length) return toast.error('Nenhuma etiqueta lida');
    await transferMutation.mutateAsync({ toLocationId, serialCodes: scannedCodes, notes });
    setScannedCodes([]); setNotes('');
  };

  const handleScannedCode = (code: string) => {
    const norm = code.trim().toUpperCase();
    if (!norm) return;
    setScannedCodes(prev => prev.includes(norm) ? prev : [...prev, norm]);
  };

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expedicao/etiquetas-seriais"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <ArrowRightLeft className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Transferências entre Locais de Estoque</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nova transferência</CardTitle>
          <CardDescription>
            Mova etiquetas entre os centros logísticos (ex: SEDE-LOJA-CAJU → CORREIO-INDEPENDENCIA).
            O sistema busca a origem automaticamente a partir do local atual de cada etiqueta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Local de Destino</Label>
            <Select value={toLocationId} onValueChange={setToLocationId}>
              <SelectTrigger><SelectValue placeholder="Selecione o destino..." /></SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name}{l.code ? ` (${l.code})` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Envio de 144 unidades para reposição do Correio Independência"
              rows={2}
            />
          </div>

          <Tabs defaultValue="range" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="range"><Hash className="h-4 w-4 mr-1" /> Por Faixa Numérica</TabsTrigger>
              <TabsTrigger value="scan"><ScanLine className="h-4 w-4 mr-1" /> Escanear QR</TabsTrigger>
            </TabsList>

            <TabsContent value="range" className="space-y-3 pt-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Prefixo</Label>
                  <Input value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} maxLength={4} />
                </div>
                <div>
                  <Label>Início</Label>
                  <Input type="number" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="number" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
                </div>
              </div>
              {rangeStart && rangeEnd && (
                <p className="text-sm text-muted-foreground">
                  {buildRangeCodes().length} etiqueta(s) serão transferidas.
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleTransferRange}
                disabled={transferMutation.isPending || !toLocationId}
              >
                {transferMutation.isPending ? 'Transferindo...' : 'Transferir por Faixa'}
              </Button>
            </TabsContent>

            <TabsContent value="scan" className="space-y-3 pt-3">
              {scanning ? (
                <QRScanner onScan={handleScannedCode} onClose={() => setScanning(false)} />
              ) : (
                <Button variant="outline" className="w-full" onClick={() => setScanning(true)}>
                  <ScanLine className="h-4 w-4 mr-2" /> Iniciar Scanner
                </Button>
              )}
              {scannedCodes.length > 0 && (
                <div className="border rounded-md p-2 space-y-1 max-h-48 overflow-auto">
                  {scannedCodes.map(c => (
                    <div key={c} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{c}</span>
                      <Button size="icon" variant="ghost" onClick={() => setScannedCodes(prev => prev.filter(x => x !== c))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                onClick={handleTransferScanned}
                disabled={transferMutation.isPending || !toLocationId || !scannedCodes.length}
              >
                {transferMutation.isPending ? 'Transferindo...' : `Transferir ${scannedCodes.length} etiqueta(s)`}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de transferências</CardTitle>
          <CardDescription>Últimas 100 transferências da organização.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transferência registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {history.map(t => (
                <div key={t.id} className="border rounded-md p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{t.from_location?.name || '—'}</Badge>
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                    <Badge>{t.to_location?.name || '—'}</Badge>
                    <Badge variant="secondary">{t.serial_count} etiqueta(s)</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
