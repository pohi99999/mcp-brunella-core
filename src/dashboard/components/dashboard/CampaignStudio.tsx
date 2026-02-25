import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Rocket, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { executeAgent } from '@/lib/apiService';
import { ScrollArea } from '@/components/ui/scroll-area';

export function CampaignStudio() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [campaignResult, setCampaignResult] = useState<string | null>(null);

  const handleGenerateCampaign = async () => {
    if (!prompt.trim()) {
      toast.error('A kampány leírása nem lehet üres!');
      return;
    }
    setIsLoading(true);
    setCampaignResult(null);
    try {
      const result = await executeAgent('CampaignGenerator', prompt);
      if (result.success) {
        toast.success('Kampány sikeresen legenerálva!');
        setCampaignResult(result.data?.report || 'Nincs megjeleníthető riport.');
      } else {
        throw new Error(result.message || 'Ismeretlen hiba történt.');
      }
    } catch (e: any) {
      toast.error(`Kampány generálás sikertelen: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="text-primary" />
            Automatikus Kampány Stúdió
          </CardTitle>
          <CardDescription>
            Írj le egy terméket vagy szolgáltatást, és a BAS legenerálja a teljes marketing kampányt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Például: 'Egy új, környezetbarát csomagolású kávé, ami specialty minősítéssel rendelkezik és a célcsoportja a 25-40 év közötti városi réteg...'"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] bg-background/50 border-border/80"
            disabled={isLoading}
          />
          <Button onClick={handleGenerateCampaign} disabled={isLoading} className="w-full gap-2 bg-primary hover:bg-primary/90">
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Rocket />
            )}
            {isLoading ? 'Kampány generálása folyamatban...' : 'Kampány Generálása'}
          </Button>
        </CardContent>
      </Card>

      {campaignResult && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Legenerált Kampány Eredmény</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] bg-background/50 border border-border/80 rounded-md p-4">
              <pre className="whitespace-pre-wrap text-sm font-mono">{campaignResult}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
