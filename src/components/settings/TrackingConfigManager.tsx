import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Facebook, Globe, Music2, Save, ExternalLink, Check, X } from 'lucide-react';
import { useTrackingConfig, useUpdateTrackingConfig, useConversionStats } from '@/hooks/useTrackingConfig';

export function TrackingConfigManager() {
  const { data: config, isLoading } = useTrackingConfig();
  const updateConfig = useUpdateTrackingConfig();
  const { data: stats } = useConversionStats();
  
  const [formData, setFormData] = useState({
    // Meta
    meta_pixel_id: '',
    meta_access_token: '',
    meta_test_event_code: '',
    meta_enabled: false,
    // Google
    google_ads_customer_id: '',
    google_conversion_action_id: '',
    google_developer_token: '',
    google_enabled: false,
    // TikTok
    tiktok_pixel_id: '',
    tiktok_access_token: '',
    tiktok_enabled: false,
  });
  
  // Sincronizar form com dados carregados
  useState(() => {
    if (config) {
      setFormData({
        meta_pixel_id: config.meta_pixel_id || '',
        meta_access_token: config.meta_access_token || '',
        meta_test_event_code: config.meta_test_event_code || '',
        meta_enabled: config.meta_enabled || false,
        google_ads_customer_id: config.google_ads_customer_id || '',
        google_conversion_action_id: config.google_conversion_action_id || '',
        google_developer_token: config.google_developer_token || '',
        google_enabled: config.google_enabled || false,
        tiktok_pixel_id: config.tiktok_pixel_id || '',
        tiktok_access_token: config.tiktok_access_token || '',
        tiktok_enabled: config.tiktok_enabled || false,
      });
    }
  });

  const handleSave = () => {
    updateConfig.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm">Meta (Facebook)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-3 w-3" />
                  <span>{stats.meta.sent}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <X className="h-3 w-3" />
                  <span>{stats.meta.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-600" />
                <CardTitle className="text-sm">Google Ads</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-3 w-3" />
                  <span>{stats.google.sent}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <X className="h-3 w-3" />
                  <span>{stats.google.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Music2 className="h-4 w-4" />
                <CardTitle className="text-sm">TikTok</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <Check className="h-3 w-3" />
                  <span>{stats.tiktok.sent}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <X className="h-3 w-3" />
                  <span>{stats.tiktok.failed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="meta" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="meta" className="gap-2">
            <Facebook className="h-4 w-4" />
            Meta
          </TabsTrigger>
          <TabsTrigger value="google" className="gap-2">
            <Globe className="h-4 w-4" />
            Google
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="gap-2">
            <Music2 className="h-4 w-4" />
            TikTok
          </TabsTrigger>
        </TabsList>

        {/* Meta Tab */}
        <TabsContent value="meta" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Meta Conversions API</CardTitle>
                  <CardDescription>
                    Envie eventos de conversão diretamente para o Facebook/Instagram
                  </CardDescription>
                </div>
                <Switch
                  checked={formData.meta_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, meta_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pixel ID</Label>
                <Input
                  placeholder="123456789012345"
                  value={formData.meta_pixel_id}
                  onChange={(e) => setFormData({ ...formData, meta_pixel_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  type="password"
                  placeholder="EAAxxxxxxx..."
                  value={formData.meta_access_token}
                  onChange={(e) => setFormData({ ...formData, meta_access_token: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Gere em{' '}
                  <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener" className="text-primary hover:underline">
                    Events Manager <ExternalLink className="inline h-3 w-3" />
                  </a>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Test Event Code (opcional)</Label>
                <Input
                  placeholder="TEST12345"
                  value={formData.meta_test_event_code}
                  onChange={(e) => setFormData({ ...formData, meta_test_event_code: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Use para testar eventos antes de ir para produção
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Google Tab */}
        <TabsContent value="google" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Google Ads Conversions</CardTitle>
                  <CardDescription>
                    Envie conversões offline para otimizar campanhas
                  </CardDescription>
                </div>
                <Switch
                  checked={formData.google_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, google_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="secondary">Em breve - Requer OAuth</Badge>
              <div className="space-y-2">
                <Label>Customer ID</Label>
                <Input
                  placeholder="123-456-7890"
                  value={formData.google_ads_customer_id}
                  onChange={(e) => setFormData({ ...formData, google_ads_customer_id: e.target.value })}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label>Conversion Action ID</Label>
                <Input
                  placeholder="123456789"
                  value={formData.google_conversion_action_id}
                  onChange={(e) => setFormData({ ...formData, google_conversion_action_id: e.target.value })}
                  disabled
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TikTok Tab */}
        <TabsContent value="tiktok" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>TikTok Events API</CardTitle>
                  <CardDescription>
                    Envie eventos de conversão para TikTok Ads
                  </CardDescription>
                </div>
                <Switch
                  checked={formData.tiktok_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, tiktok_enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Pixel Code</Label>
                <Input
                  placeholder="CXXXXXXXX"
                  value={formData.tiktok_pixel_id}
                  onChange={(e) => setFormData({ ...formData, tiktok_pixel_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  type="password"
                  placeholder="Token de acesso"
                  value={formData.tiktok_access_token}
                  onChange={(e) => setFormData({ ...formData, tiktok_access_token: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}