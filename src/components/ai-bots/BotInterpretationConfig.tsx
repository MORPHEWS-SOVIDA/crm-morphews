import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mic, FileText, Image, Zap } from "lucide-react";

interface BotInterpretationConfigProps {
  interpretAudio: boolean;
  interpretDocuments: boolean;
  interpretImages: boolean;
  documentReplyMessage: string;
  imageReplyMessage: string;
  onInterpretAudioChange: (value: boolean) => void;
  onInterpretDocumentsChange: (value: boolean) => void;
  onInterpretImagesChange: (value: boolean) => void;
  onDocumentReplyMessageChange: (value: string) => void;
  onImageReplyMessageChange: (value: string) => void;
}

export function BotInterpretationConfig({
  interpretAudio,
  interpretDocuments,
  interpretImages,
  documentReplyMessage,
  imageReplyMessage,
  onInterpretAudioChange,
  onInterpretDocumentsChange,
  onInterpretImagesChange,
  onDocumentReplyMessageChange,
  onImageReplyMessageChange,
}: BotInterpretationConfigProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Interpretação com IA
          </CardTitle>
          <CardDescription>
            Configure quais tipos de mídia o robô deve interpretar automaticamente usando IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Audio Interpretation */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Mic className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <Label className="text-base font-medium">Transcrição de Áudio</Label>
                <p className="text-sm text-muted-foreground">
                  Transcreve automaticamente áudios enviados pelos clientes
                </p>
              </div>
            </div>
            <Switch
              checked={interpretAudio}
              onCheckedChange={onInterpretAudioChange}
            />
          </div>

          {/* Document Interpretation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <Label className="text-base font-medium">Interpretação de Documentos</Label>
                  <p className="text-sm text-muted-foreground">
                    Analisa PDFs como receitas médicas e laudos automaticamente
                  </p>
                </div>
              </div>
              <Switch
                checked={interpretDocuments}
                onCheckedChange={onInterpretDocumentsChange}
              />
            </div>
            
            {interpretDocuments && (
              <div className="ml-4 pl-4 border-l-2 border-amber-200 dark:border-amber-800 space-y-2">
                <Label className="text-sm">Mensagem de resposta automática</Label>
                <Textarea
                  value={documentReplyMessage}
                  onChange={(e) => onDocumentReplyMessageChange(e.target.value)}
                  placeholder="Nossa IA analisou seu documento e identificou..."
                  rows={2}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  O robô enviará esta mensagem seguida do resumo do documento
                </p>
              </div>
            )}
          </div>

          {/* Image Interpretation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Image className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <Label className="text-base font-medium">Interpretação de Imagens</Label>
                  <p className="text-sm text-muted-foreground">
                    Analisa fotos enviadas (produtos, embalagens, etc.)
                  </p>
                </div>
              </div>
              <Switch
                checked={interpretImages}
                onCheckedChange={onInterpretImagesChange}
              />
            </div>
            
            {interpretImages && (
              <div className="ml-4 pl-4 border-l-2 border-purple-200 dark:border-purple-800 space-y-2">
                <Label className="text-sm">Mensagem de resposta automática</Label>
                <Textarea
                  value={imageReplyMessage}
                  onChange={(e) => onImageReplyMessageChange(e.target.value)}
                  placeholder="Nossa IA analisou sua imagem e identificou..."
                  rows={2}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  O robô enviará esta mensagem seguida da análise da imagem
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Zap className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Consumo de Energia IA</p>
              <ul className="text-muted-foreground mt-1 space-y-1">
                <li>• Transcrição de áudio: <strong>50 energia</strong> por áudio</li>
                <li>• Interpretação de documento: <strong>100 energia</strong> por arquivo</li>
                <li>• Interpretação de imagem: <strong>75 energia</strong> por imagem</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
