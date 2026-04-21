import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Search, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

type PropertyType = 'apartment' | 'house' | 'industrial' | 'other';

interface ValuationRange { conservative: number; target: number; quick: number; }
interface Comparable { address: string; priceEur: number; areaSqm: number; pricePerSqm: number; }
interface ResearchReport {
  location: string; propertyType: string; areaSqm: number; askingPrice: number;
  valuationRange: ValuationRange; comparables: Comparable[]; riskFlags: string[];
  recommendation: string; generatedAt: string;
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  BUY: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  HOLD: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  INVESTIGATE: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  PASS: 'border-red-500/20 bg-red-500/10 text-red-300',
};

export function PSalesResearchPanel() {
  const [form, setForm] = useState({ location: 'Budapest', propertyType: 'apartment' as PropertyType, areaSqm: 75, askingPrice: 80000 });
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/psales/research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as ResearchReport;
      setReport(data);
      toast.success(`Elemzés kész: ${data.recommendation}`);
    } catch {
      toast.error('Elemzés sikertelen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Search className="h-4 w-4 text-primary" />
            Piaci Kutatás és Értékelés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Lokáció</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                placeholder="Budapest"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Típus</label>
              <select
                value={form.propertyType}
                onChange={e => setForm(f => ({ ...f, propertyType: e.target.value as PropertyType }))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#050816] px-3 py-2 text-sm text-white"
              >
                <option value="apartment">Lakás</option>
                <option value="house">Ház</option>
                <option value="industrial">Ipari</option>
                <option value="other">Egyéb</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Alapterület (m²)</label>
              <input
                type="number"
                value={form.areaSqm}
                onChange={e => setForm(f => ({ ...f, areaSqm: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Kért ár (EUR)</label>
              <input
                type="number"
                value={form.askingPrice}
                onChange={e => setForm(f => ({ ...f, askingPrice: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <Button
            className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
            onClick={runAnalysis}
            disabled={loading}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            {loading ? 'Elemzés fut...' : 'Elemzés indítása'}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <>
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm text-white">
                <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Értéktartomány</span>
                <Badge className={RECOMMENDATION_COLORS[report.recommendation] ?? ''}>{report.recommendation}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Gyorseladási ár', value: report.valuationRange.quick, pct: 75 },
                { label: 'Konzervatív ár', value: report.valuationRange.conservative, pct: 85 },
                { label: 'Célár (piaci)', value: report.valuationRange.target, pct: 100 },
              ].map(({ label, value, pct }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{label}</span>
                    <span>{value.toLocaleString('hu-HU')} EUR</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          {report.riskFlags.length > 0 && (
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Kockázati jelzések
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.riskFlags.map(flag => (
                  <div key={flag} className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                    {flag}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
