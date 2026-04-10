import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Camera, CameraOff, SwitchCamera, ZoomIn, ZoomOut } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

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
  const [zoomLevel, setZoomLevel] = useState(2);
  const [maxZoom, setMaxZoom] = useState(1);
  const [supportsZoom, setSupportsZoom] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const applyZoom = useCallback(async (zoom: number) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const capabilities = track.getCapabilities?.() as any;
      if (capabilities?.zoom) {
        const clamped = Math.min(Math.max(zoom, capabilities.zoom.min), capabilities.zoom.max);
        await (track as any).applyConstraints({ advanced: [{ zoom: clamped }] });
      }
    } catch {
      // zoom not supported
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    trackRef.current = null;
    setIsActive(false);
    setSupportsZoom(false);
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
          if (decodedText === lastScannedRef.current && now - lastScannedTimeRef.current < 2000) {
            return;
          }
          lastScannedRef.current = decodedText;
          lastScannedTimeRef.current = now;
          onScan(decodedText);
        },
        () => {}
      );

      setIsActive(true);

      // Apply zoom after camera starts
      setTimeout(async () => {
        try {
          const videoElem = containerRef.current?.querySelector('video');
          if (videoElem?.srcObject) {
            const stream = videoElem.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            if (track) {
              trackRef.current = track;
              const capabilities = track.getCapabilities?.() as any;
              if (capabilities?.zoom) {
                const zMax = capabilities.zoom.max || 1;
                const zMin = capabilities.zoom.min || 1;
                setMaxZoom(zMax);
                setSupportsZoom(true);
                // Default to 2x or max, whichever is smaller
                const defaultZoom = Math.min(2, zMax);
                setZoomLevel(defaultZoom);
                await (track as any).applyConstraints({ advanced: [{ zoom: defaultZoom }] });
              }
            }
          }
        } catch {
          // zoom not available on this device
        }
      }, 500);
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
  };

  const handleZoomChange = (value: number[]) => {
    const newZoom = value[0];
    setZoomLevel(newZoom);
    applyZoom(newZoom);
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

      {/* Zoom control */}
      {isActive && supportsZoom && maxZoom > 1 && (
        <div className="flex items-center gap-2 max-w-[300px] mx-auto mt-2 px-1">
          <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Slider
            value={[zoomLevel]}
            min={1}
            max={maxZoom}
            step={0.1}
            onValueChange={handleZoomChange}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground w-8 text-right">{zoomLevel.toFixed(1)}x</span>
        </div>
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
