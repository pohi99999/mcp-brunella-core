import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, CheckCircle, Warning, Database } from '@phosphor-icons/react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

type IntelligenceDomain = 'business' | 'social' | 'political' | 'financial' | 'technology';
type IntelligenceStance = 'supports' | 'contradicts' | 'neutral';
type IntelligenceBiasLabel = 'low' | 'medium' | 'high' | 'unknown';
type IntelligenceSignalStatus = 'pending_review' | 'approved' | 'rejected' | 'promoted';

interface IntelligenceSourceClass
{
    id: IntelligenceDomain;
    label: string;
    description: string;
    provenanceRequired: boolean;
    biasLabelRequired: boolean;
    sensitiveReviewRequired: boolean;
}

interface IntelligenceSignalRecord
{
    id: string;
    sourceClass: IntelligenceDomain;
    source: string;
    title: string;
    summary: string;
    entity?: string;
    relation?: string;
    stance: IntelligenceStance;
    biasLabel: IntelligenceBiasLabel;
    provenance: string;
    confidence: number;
    score: number;
    status: IntelligenceSignalStatus;
    contradictionNote: string | null;
    reviewNote: string | null;
    reviewedAt: string | null;
    promotedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface IntelligenceOverview
{
    generatedAt: string;
    governance: {
        sourceClasses: IntelligenceSourceClass[];
        guardrails: string[];
        reviewPolicy: string[];
    };
    stats: {
        golden: { totalSamples?: number; newSinceLastTraining?: number; lastTrainingAt?: string } | null;
        memory: { summary: { totalEntries: number; avgConfidence: number; totalReuses: number } };
        index: { lastIndexTime: number; lastStats: { filesIndexed?: number; chunksIndexed?: number } | null; schedulerActive: boolean };
        tools: { totalRuns: number; successRate: number; avgDurationMs: number };
    };
    signals: {
        total: number;
        pendingReview: number;
        approved: number;
        rejected: number;
        promoted: number;
    };
    reviewQueue: IntelligenceSignalRecord[];
    recentPromotions: Array<{
        source: string;
        prompt: string;
        quality: number;
        createdAt: string;
        remoteStatus: string;
    }>;
    feedback: {
        avgScore: number;
        contradictionCount: number;
        recentEvidenceCount: number;
    };
}

const API_BASE = '';

export function IntelligenceMonitorPanel ()
{
    const [overview, setOverview] = useState<IntelligenceOverview | null>( null );
    const [loading, setLoading] = useState( true );
    const [busy, setBusy] = useState( false );
    const [form, setForm] = useState( {
        sourceClass: 'business' as IntelligenceDomain,
        source: '',
        title: '',
        summary: '',
        entity: '',
        relation: '',
        stance: 'neutral' as IntelligenceStance,
        biasLabel: 'unknown' as IntelligenceBiasLabel,
        provenance: '',
        confidence: 0.6,
    } );

    const fetchOverview = useCallback( async () =>
    {
        setLoading( true );
        try
        {
            const res = await fetch( `${ API_BASE }/api/v1/intelligence/overview` );
            const data = await res.json() as { success?: boolean; data?: IntelligenceOverview };
            if ( data.data )
            {
                setOverview( data.data );
            }
        } catch
        {
            // silent fallback
        } finally
        {
            setLoading( false );
        }
    }, [] );

    useEffect( () =>
    {
        void fetchOverview();
        const interval = setInterval( fetchOverview, 30_000 );
        return () => clearInterval( interval );
    }, [fetchOverview] );

    const refresh = async () =>
    {
        await fetchOverview();
    };

    const sourceClasses = useMemo( () => overview?.governance.sourceClasses ?? [], [overview] );

    const submitSignal = async () =>
    {
        if ( !form.source.trim() || !form.title.trim() || !form.summary.trim() || !form.provenance.trim() )
        {
            return;
        }

        setBusy( true );
        try
        {
            await fetch( `${ API_BASE }/api/v1/intelligence/signals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( {
                    ...form,
                    entity: form.entity.trim() || undefined,
                    relation: form.relation.trim() || undefined,
                } ),
            } );
            setForm( ( prev ) => ( {
                ...prev,
                source: '',
                title: '',
                summary: '',
                entity: '',
                relation: '',
                provenance: '',
                confidence: 0.6,
            } ) );
            await fetchOverview();
        } finally
        {
            setBusy( false );
        }
    };

    const reviewSignal = async ( signalId: string, decision: 'approve' | 'reject', note?: string ) =>
    {
        setBusy( true );
        try
        {
            await fetch( `${ API_BASE }/api/v1/intelligence/review/${ signalId }`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( { decision, note } ),
            } );
            await fetchOverview();
        } finally
        {
            setBusy( false );
        }
    };

    if ( loading && !overview )
    {
        return <div className="p-6 text-sm text-zinc-400">Intelligence Monitor betöltése...</div>;
    }

    return (
        <div className="p-6 space-y-6 min-h-screen bg-zinc-950 text-zinc-100">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Database className="w-6 h-6 text-cyan-400" /> Intelligence Monitor
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Public intelligence feed, review queue és golden dataset promotion.
                    </p>
                </div>
                <Button onClick={ refresh } disabled={ busy } variant="outline" className="gap-2">
                    <ArrowClockwise className={ busy ? 'animate-spin' : '' } /> Frissítés
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <MetricCard label="Signals" value={ overview?.signals.total ?? 0 } />
                <MetricCard label="Pending review" value={ overview?.signals.pendingReview ?? 0 } />
                <MetricCard label="Promoted" value={ overview?.signals.promoted ?? 0 } />
                <MetricCard label="Golden samples" value={ overview?.stats.golden?.totalSamples ?? 0 } />
                <MetricCard label="Avg score" value={ ( overview?.feedback.avgScore ?? 0 ).toFixed( 2 ) } />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" /> Ingest new signal
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select title="Jelzés osztálya" aria-label="Jelzés osztálya" value={ form.sourceClass } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, sourceClass: e.target.value as IntelligenceDomain } ) ) } className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm">
                            { sourceClasses.map( ( cls ) => <option key={ cls.id } value={ cls.id }>{ cls.label }</option> ) }
                        </select>
                        <input value={ form.source } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, source: e.target.value } ) ) } placeholder="Forrás neve vagy URL" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" />
                        <input value={ form.title } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, title: e.target.value } ) ) } placeholder="Cím" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm md:col-span-2" />
                        <textarea value={ form.summary } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, summary: e.target.value } ) ) } placeholder="Rövid összefoglaló" rows={ 3 } className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm md:col-span-2 resize-y" />
                        <input value={ form.entity } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, entity: e.target.value } ) ) } placeholder="Entity (opcionális)" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" />
                        <input value={ form.relation } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, relation: e.target.value } ) ) } placeholder="Relation (opcionális)" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm" />
                        <select title="Állítás típusa" aria-label="Állítás típusa" value={ form.stance } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, stance: e.target.value as IntelligenceStance } ) ) } className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm">
                            <option value="neutral">neutral</option>
                            <option value="supports">supports</option>
                            <option value="contradicts">contradicts</option>
                        </select>
                        <select title="Bias jelölés" aria-label="Bias jelölés" value={ form.biasLabel } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, biasLabel: e.target.value as IntelligenceBiasLabel } ) ) } className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm">
                            <option value="unknown">unknown</option>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                        </select>
                        <input value={ form.provenance } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, provenance: e.target.value } ) ) } placeholder="Provenance / bizonyíték" className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm md:col-span-2" />
                        <div className="md:col-span-2 flex items-center gap-3">
                            <input title="Bizalom értéke" aria-label="Bizalom értéke" type="range" min="0" max="1" step="0.05" value={ form.confidence } onChange={ ( e ) => setForm( ( prev ) => ( { ...prev, confidence: Number( e.target.value ) } ) ) } className="flex-1" />
                            <Badge>{ form.confidence.toFixed( 2 ) }</Badge>
                        </div>
                        <div className="md:col-span-2">
                            <Button disabled={ busy || !form.source.trim() || !form.title.trim() || !form.summary.trim() || !form.provenance.trim() } onClick={ () => void submitSignal() }>
                                Mentés a review queue-ba
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Review queue</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        { overview?.reviewQueue.length ? overview.reviewQueue.map( ( signal ) => (
                            <div key={ signal.id } className="rounded border border-zinc-800 bg-zinc-900/70 p-3 space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-sm">{ signal.title }</p>
                                        <p className="text-xs text-zinc-400">{ signal.sourceClass } • { signal.source }</p>
                                    </div>
                                    <Badge>{ signal.status }</Badge>
                                </div>
                                <p className="text-xs text-zinc-300 line-clamp-3">{ signal.summary }</p>
                                <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                                    <span>Score: { signal.score.toFixed( 2 ) }</span>
                                    <span>Bias: { signal.biasLabel }</span>
                                    <span>Stance: { signal.stance }</span>
                                    { signal.contradictionNote && <span className="text-amber-400">⚠ { signal.contradictionNote }</span> }
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" disabled={ busy } onClick={ () => void reviewSignal( signal.id, 'approve' ) }>Approve</Button>
                                    <Button size="sm" variant="outline" disabled={ busy } onClick={ () => void reviewSignal( signal.id, 'reject', 'Rejected from dashboard' ) }>Reject</Button>
                                </div>
                            </div>
                        ) ) : (
                            <div className="text-sm text-zinc-400">Nincs review-ra váró jelzés.</div>
                        ) }
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Governance & promotion</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Source classes</h4>
                            <div className="space-y-2">
                                { sourceClasses.map( ( cls ) => (
                                    <div key={ cls.id } className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm">{ cls.label }</span>
                                            <span className="text-xs text-zinc-500">{ cls.id }</span>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-1">{ cls.description }</p>
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            { cls.provenanceRequired && <Badge>provenance</Badge> }
                                            { cls.biasLabelRequired && <Badge>bias label</Badge> }
                                            { cls.sensitiveReviewRequired && <Badge>human review</Badge> }
                                        </div>
                                    </div>
                                ) ) }
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold mb-2">Recent promotions</h4>
                            <div className="space-y-2">
                                { overview?.recentPromotions.length ? overview.recentPromotions.map( ( item, index ) => (
                                    <div key={ `${ item.source }-${ index }` } className="rounded border border-zinc-800 bg-zinc-900/70 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm text-zinc-200">{ item.source }</span>
                                            <Badge>{ item.remoteStatus }</Badge>
                                        </div>
                                        <p className="text-xs text-zinc-400 mt-1">Quality: { item.quality.toFixed( 2 ) } • { new Date( item.createdAt ).toLocaleString() }</p>
                                        <p className="text-xs text-zinc-300 mt-2 line-clamp-2">{ item.prompt }</p>
                                    </div>
                                ) ) : (
                                    <div className="text-sm text-zinc-400">Még nincs promotion.</div>
                                ) }
                            </div>
                        </div>

                        { overview?.governance.guardrails && (
                            <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Warning className="w-4 h-4 text-amber-400" /> Guardrails</h4>
                                <ul className="space-y-1 text-xs text-zinc-300 list-disc pl-5">
                                    { overview.governance.guardrails.map( ( guardrail ) => <li key={ guardrail }>{ guardrail }</li> ) }
                                </ul>
                            </div>
                        ) }
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard ( { label, value }: { label: string; value: string | number } )
{
    return (
        <Card>
            <CardContent className="p-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wider">{ label }</div>
                <div className="text-2xl font-bold mt-1">{ value }</div>
            </CardContent>
        </Card>
    );
}
