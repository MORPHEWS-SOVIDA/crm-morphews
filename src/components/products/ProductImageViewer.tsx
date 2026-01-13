import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package, FileText, ZoomIn, Download, X } from 'lucide-react';

interface ProductImageViewerProps {
  imageUrl: string | null;
  labelImageUrl: string | null;
  productName: string;
  compact?: boolean;
}

export function ProductImageViewer({ 
  imageUrl, 
  labelImageUrl, 
  productName,
  compact = false 
}: ProductImageViewerProps) {
  const [viewingImage, setViewingImage] = useState<'product' | 'label' | null>(null);

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  };

  const currentImageUrl = viewingImage === 'product' ? imageUrl : labelImageUrl;
  const currentTitle = viewingImage === 'product' 
    ? `Foto - ${productName}` 
    : `Rótulo - ${productName}`;

  if (!imageUrl && !labelImageUrl) {
    return null;
  }

  return (
    <>
      <div className={`flex ${compact ? 'flex-row items-center gap-3' : 'flex-col gap-3'}`}>
        {/* Product Image Preview */}
        {imageUrl && (
          <div className={`${compact ? 'flex items-center gap-3' : 'space-y-2'}`}>
            <div 
              className="relative group cursor-pointer"
              onClick={() => setViewingImage('product')}
            >
              <img
                src={imageUrl}
                alt={productName}
                className={`${compact ? 'w-16 h-16' : 'w-24 h-24'} object-cover rounded-lg border border-border shadow-sm transition-transform group-hover:scale-105`}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <ZoomIn className="w-5 h-5 text-white" />
              </div>
            </div>
            {!compact && (
              <p className="text-xs text-muted-foreground text-center">Foto do produto</p>
            )}
          </div>
        )}

        {/* Buttons for Label */}
        {labelImageUrl && (
          <Button
            type="button"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => setViewingImage('label')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Ver Rótulo
          </Button>
        )}
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={viewingImage !== null} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2">
              {viewingImage === 'product' ? (
                <Package className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              {currentTitle}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative flex-1 overflow-auto p-4">
            {currentImageUrl && (
              <div className="flex items-center justify-center min-h-[300px]">
                <img
                  src={currentImageUrl}
                  alt={currentTitle}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <div className="flex gap-2">
              {imageUrl && (
                <Button
                  variant={viewingImage === 'product' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewingImage('product')}
                  className="gap-2"
                >
                  <Package className="h-4 w-4" />
                  Foto
                </Button>
              )}
              {labelImageUrl && (
                <Button
                  variant={viewingImage === 'label' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewingImage('label')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Rótulo
                </Button>
              )}
            </div>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (currentImageUrl) {
                  const fileName = viewingImage === 'product' 
                    ? `${productName.replace(/\s+/g, '_')}_foto.jpg`
                    : `${productName.replace(/\s+/g, '_')}_rotulo.jpg`;
                  handleDownload(currentImageUrl, fileName);
                }
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar Imagem
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
