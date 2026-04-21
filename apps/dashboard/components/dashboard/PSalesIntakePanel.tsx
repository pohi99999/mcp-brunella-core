import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { ClipboardList, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type PropertyType = 'apartment' | 'house' | 'industrial';

interface SurveyResult {
  propertyType: string;
  required: string[];
  uploadedDocs: string[];
  missing: string[];
  completeness: number;
  isComplete: boolean;
}

const TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Lakás',
  house: 'Ház',
  industrial: 'Ipari / Üzleti',
};

export function PSalesIntakePanel() {
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChecklist = async (type: PropertyType) => {
    try {
      const res = await fetch(`/api/psales/intake/checklist/${type}`);
      const data = await res.json() as { required: string[] };
      setChecklist(data.required ?? []);
      setUploadedDocs([]);
      setResult(null);
    } catch {
      toast.error('Nem sikerült betölteni a kötelező iratokat.');
    }
  };

  const handleTypeChange = async (type: PropertyType) => {
    setPropertyType(type);
    await loadChecklist(type);
  };

  const toggleDoc = (doc: string) => {
    setUploadedDocs(prev =>
      prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]
    );
    setResult(null);
  };

  const runSurvey = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/psales/intake/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyType, uploadedDocs }),
      });
      const data = await res.json() as SurveyResult;
      setResult(data);
      if (data.isComplete) toast.success('Minden dokumentum feltöltve!');
      else toast.info(`${data.missing.length} dokumentum hiányzik.`);
    } catch {
      toast.error('Felmérés sikertelen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <ClipboardList className="h-4 w-4 text-primary" />
            Intake Felmérő — Dokumentumok
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(Object.keys(TYPE_LABELS) as PropertyType[]).map(type => (
              <Button
                key={type}
                size="sm"
                variant={propertyType === type ? 'default' : 'outline'}
                className={propertyType === type
                  ? 'bg-primary/20 text-primary border-primary/20'
                  : 'border-white/[0.08] bg-white/[0.04] text-zinc-300'}
                onClick={() => handleTypeChange(type)}
              >
                {TYPE_LABELS[type]}
              </Button>
            ))}
          </div>

          {checklist.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Dokumentumok</p>
              {checklist.map(doc => {
                const uploaded = uploadedDocs.includes(doc);
                return (
                  <button
                    key={doc}
                    onClick={() => toggleDoc(doc)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      uploaded
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    {uploaded
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      : <AlertCircle className="h-4 w-4 shrink-0 text-zinc-600" />
                    }
                    {doc}
                  </button>
                );
              })}
            </div>
          )}

          {checklist.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/[0.08] bg-white/[0.04] text-zinc-300"
              onClick={() => loadChecklist(propertyType)}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Iratok betöltése
            </Button>
          )}

          {checklist.length > 0 && (
            <Button
              className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
              onClick={runSurvey}
              disabled={loading}
            >
              {loading ? 'Felmérés fut...' : 'Felmérés indítása'}
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white">Felmérés eredménye</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Teljességjelző</span>
                <span>{result.completeness}%</span>
              </div>
              <Progress value={result.completeness} className="h-2" />
            </div>
            {result.missing.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Hiányzó iratok</p>
                {result.missing.map(doc => (
                  <div key={doc} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    <AlertCircle className="h-3 w-3" />
                    {doc}
                  </div>
                ))}
              </div>
            )}
            {result.isComplete && (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                Minden dokumentum megvan ✓
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
