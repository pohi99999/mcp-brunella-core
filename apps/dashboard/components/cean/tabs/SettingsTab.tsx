/**
 * SettingsTab — LLM Router beállítások UI
 * Összekötés: Settings UI → apiService → POST /api/router/config → DEFAULT_CONFIG + JSON perzisztencia
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card.js';
import { Badge } from '../../ui/badge.js';
import { Button } from '../../ui/button.js';
import { Slider } from '../../ui/slider.js';
import { Switch } from '../../ui/switch.js';
import { Input } from '../../ui/input.js';
import { Label } from '../../ui/label.js';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group.js';
import { Separator } from '../../ui/separator.js';
import {
    getRouterConfig,
    saveRouterConfig,
    clearRouterOverride,
    type RouterConfig,
} from '../../../lib/apiService.js';

const PROVIDERS = [
    { value: '', label: 'Auto (intelligens)', description: 'A router dönti el feladatonként' },
    { value: 'ollama', label: 'Ollama (helyi)', description: 'Mindig lokális modell' },
    { value: 'gemini', label: 'Gemini', description: 'Google Gemini (cloud)' },
    { value: 'github', label: 'GitHub Models', description: 'GPT-4o via GitHub (cloud)' },
    { value: 'cloudflare', label: 'Cloudflare', description: 'Cloudflare Workers AI' },
] as const;

function budgetLabel(budget: number): string {
    if (budget === 0) return 'Csak helyi (Ollama)';
    if (budget <= 25) return 'Főleg helyi';
    if (budget <= 50) return 'Vegyes (alapértelmezett)';
    if (budget <= 75) return 'Főleg cloud';
    return 'Mindig cloud';
}

export const SettingsTab = () => {
    const [config, setConfig] = useState<RouterConfig | null>(null);
    const [draft, setDraft] = useState<RouterConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedOk, setSavedOk] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dirty =
        config !== null &&
        draft !== null &&
        JSON.stringify(config) !== JSON.stringify(draft);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const cfg = await getRouterConfig();
            setConfig(cfg);
            setDraft(cfg);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleSave = async () => {
        if (!draft) return;
        setSaving(true);
        setError(null);
        try {
            const updated = await saveRouterConfig(draft);
            setConfig(updated);
            setDraft(updated);
            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2500);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    };

    const handleClearOverride = async () => {
        setSaving(true);
        setError(null);
        try {
            const updated = await clearRouterOverride();
            setConfig(updated);
            setDraft(updated);
            setSavedOk(true);
            setTimeout(() => setSavedOk(false), 2500);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        if (config) setDraft({ ...config });
    };

    const updateDraft = (partial: Partial<RouterConfig>) => {
        setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                Beállítások betöltése...
            </div>
        );
    }

    if (error && !draft) {
        return (
            <div className="p-6">
                <div className="text-destructive text-sm mb-3">{error}</div>
                <Button variant="outline" size="sm" onClick={load}>
                    Újrapróbálás
                </Button>
            </div>
        );
    }

    if (!draft) return null;

    return (
        <div className="p-4 space-y-4 max-w-2xl">
            {/* Fejléc */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">LLM Router beállítások</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Konfiguráció azonnal életbe lép, szerver újraindítás után is megmarad.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {savedOk && <Badge variant="outline" className="text-green-600 border-green-600">Mentve ✓</Badge>}
                    {dirty && <Badge variant="outline" className="text-amber-600 border-amber-600">Módosítatlan</Badge>}
                </div>
            </div>

            <Separator />

            {/* Provider override */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Provider override</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup
                        value={draft.overrideProvider ?? ''}
                        onValueChange={(val) =>
                            updateDraft({ overrideProvider: val || undefined })
                        }
                        className="space-y-2"
                    >
                        {PROVIDERS.map((p) => (
                            <div key={p.value} className="flex items-center space-x-3">
                                <RadioGroupItem value={p.value} id={`provider-${p.value || 'auto'}`} />
                                <Label
                                    htmlFor={`provider-${p.value || 'auto'}`}
                                    className="flex flex-col cursor-pointer"
                                >
                                    <span className="font-medium text-sm">{p.label}</span>
                                    <span className="text-xs text-muted-foreground">{p.description}</span>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
            </Card>

            {/* Model override */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Model override</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            placeholder="pl. gpt-4o, gemini-2.0-flash, qwen2.5-coder:7b"
                            value={draft.overrideModel ?? ''}
                            onChange={(e) =>
                                updateDraft({ overrideModel: e.target.value || undefined })
                            }
                            className="font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearOverride}
                            disabled={saving || (!draft.overrideModel && !draft.overrideProvider)}
                        >
                            Törlés
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Ha be van állítva, minden feladathoz ezt a modellt használja (legmagasabb prioritású).
                    </p>
                </CardContent>
            </Card>

            {/* Budget slider */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>Cloud budget</span>
                        <Badge variant="secondary">{draft.budget} — {budgetLabel(draft.budget)}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Slider
                        min={0}
                        max={100}
                        step={10}
                        value={[draft.budget]}
                        onValueChange={([val]) => updateDraft({ budget: val })}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>0 — csak helyi</span>
                        <span>50 — vegyes</span>
                        <span>100 — csak cloud</span>
                    </div>
                </CardContent>
            </Card>

            {/* Togglek */}
            <Card>
                <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="prefer-local" className="font-medium text-sm">
                                Helyi modell előnyben
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Közepes komplexitású feladatnál Ollama-t használ cloud helyett.
                            </p>
                        </div>
                        <Switch
                            id="prefer-local"
                            checked={draft.preferLocal}
                            onCheckedChange={(val) => updateDraft({ preferLocal: val })}
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="fallback-enabled" className="font-medium text-sm">
                                Automatikus fallback
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Cloud hiba esetén automatikusan Ollama-ra vált.
                            </p>
                        </div>
                        <Switch
                            id="fallback-enabled"
                            checked={draft.fallbackEnabled}
                            onCheckedChange={(val) => updateDraft({ fallbackEnabled: val })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Hibaüzenet */}
            {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {error}
                </div>
            )}

            {/* Gombok */}
            <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving || !dirty} className="min-w-24">
                    {saving ? 'Mentés...' : 'Mentés'}
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={saving || !dirty}>
                    Visszaállítás
                </Button>
            </div>
        </div>
    );
};
