import { useState } from 'react';
import { Phone, Delete, X, Video, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useWavoip } from '@/hooks/useWavoip';
import { useOrgHasFeature } from '@/hooks/usePlanFeatures';
import { cn } from '@/lib/utils';

interface WavoipDialpadProps {
  instanceId: string;
  instanceName?: string;
  className?: string;
}

const DIALPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function WavoipDialpad({ instanceId, instanceName, className }: WavoipDialpadProps) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const { data: hasWavoipFeature = false } = useOrgHasFeature("wavoip_calls");
  const { wavoipStatus, isLoadingCall, makeCall, instanceConfig } = useWavoip(instanceId);

  // Don't show if Wavoip feature is not enabled OR wavoip is not available on this instance
  if (!hasWavoipFeature || wavoipStatus !== 'available') {
    return null;
  }

  const handleKeyPress = (key: string) => {
    setPhoneNumber(prev => prev + key);
  };

  const handleDelete = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handleCall = async (isVideo: boolean = false) => {
    if (!phoneNumber || phoneNumber.length < 10) return;

    const targetInstanceName = instanceName || instanceConfig?.instanceName;
    if (!targetInstanceName) return;

    const success = await makeCall({
      instanceName: targetInstanceName,
      contactPhone: phoneNumber,
      isVideo,
    });

    if (success) {
      setOpen(false);
      setPhoneNumber('');
    }
  };

  // Format phone number for display
  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
        >
          <Phone className="h-4 w-4" />
          <span className="hidden sm:inline">Discar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-center">Fazer Chamada</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phone number display */}
          <div className="relative">
            <Input
              value={formatPhoneDisplay(phoneNumber)}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Digite o número"
              className="text-center text-xl font-mono pr-10"
            />
            {phoneNumber && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Dialpad */}
          <div className="grid grid-cols-3 gap-2">
            {DIALPAD_KEYS.map((row, rowIdx) => (
              row.map((key) => (
                <Button
                  key={`${rowIdx}-${key}`}
                  variant="outline"
                  size="lg"
                  className="h-14 text-xl font-semibold hover:bg-muted"
                  onClick={() => handleKeyPress(key)}
                >
                  {key}
                </Button>
              ))
            ))}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            {/* Video call */}
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              disabled={isLoadingCall || phoneNumber.length < 10}
              onClick={() => handleCall(true)}
            >
              {isLoadingCall ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </Button>

            {/* Voice call */}
            <Button
              size="lg"
              className="h-14 bg-green-600 hover:bg-green-700 text-white"
              disabled={isLoadingCall || phoneNumber.length < 10}
              onClick={() => handleCall(false)}
            >
              {isLoadingCall ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
            </Button>

            {/* Delete */}
            <Button
              variant="outline"
              size="lg"
              className="h-14"
              onClick={handleDelete}
              disabled={!phoneNumber}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Digite o número com DDD (ex: 11999999999)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
