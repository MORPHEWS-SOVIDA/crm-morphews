import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  scanning?: boolean;
  className?: string;
}

export function QRScanner({ onScan, scanning = true, className }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const lastScannedRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsActive(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;
    setError(null);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      await scannerRef.current.start(
        { facingMode },
        {
          fps: 10,
          qrbox: { width: 200, height: 200 },
          aspectRatio: 1,
        },
        (decodedText) => {
          const now = Date.now();
          // Debounce: same code within 2 seconds
          if (decodedText === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) {
            return;
          }
          lastScannedRef.current = decodedText;
          lastScannedTimeRef.current = now;
          onScan(decodedText);
        },
        () => {} // ignore errors (no QR found in frame)
      );

      setIsActive(true);
    } catch (err: any) {
      console.error('QR Scanner error:', err);
      if (err?.message?.includes('Permission')) {
        setError('Permissão da câmera negada. Permita o acesso à câmera nas configurações do navegador.');
      } else {
        setError('Não foi possível acessar a câmera. Verifique se outro app está usando.');
      }
    }
  }, [facingMode, onScan]);

  useEffect(() => {
    if (scanning) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [scanning, startScanner, stopScanner]);

  const toggleCamera = async () => {
    await stopScanner();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    // Will restart via useEffect
  };

  return (
    <div className={className}>
      <div 
        id="qr-reader" 
        ref={containerRef}
        className="w-full max-w-[300px] mx-auto rounded-lg overflow-hidden bg-muted"
        style={{ minHeight: isActive ? undefined : '200px' }}
      />
      
      {error && (
        <p className="text-sm text-destructive text-center mt-2">{error}</p>
      )}

      <div className="flex justify-center gap-2 mt-3">
        {isActive ? (
          <>
            <Button variant="outline" size="sm" onClick={stopScanner}>
              <CameraOff className="h-4 w-4 mr-1" /> Parar
            </Button>
            <Button variant="outline" size="sm" onClick={toggleCamera}>
              <SwitchCamera className="h-4 w-4 mr-1" /> Trocar Câmera
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={startScanner}>
            <Camera className="h-4 w-4 mr-1" /> Iniciar Câmera
          </Button>
        )}
      </div>
    </div>
  );
}
