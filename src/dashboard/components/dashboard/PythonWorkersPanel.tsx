import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import {
    FileText,
    Globe,
    Database,
    Play,
    CheckCircle2,
    XCircle,
    Loader2,
    Download,
    Image as ImageIcon
} from 'lucide-react';
import { logError } from '@/utils/logger';

/**
 * Python Workers Panel
 * Dashboard component for monitoring and executing Python workers:
 * - OCR Worker (Tesseract, PaddleOCR, EasyOCR)
 * - Web Scraper (Playwright)
 * - LanceDB Batch Ingestion
 * 
 * @module PythonWorkersPanel
 */

interface WorkerStatus {
    name: string;
    available: boolean;
    lastRun?: string;
    totalRuns?: number;
}

/** Shape returned by GET /api/v1/python-workers/status */
interface WorkersStatusResponse {
    status: string;
    workers: Array<{ name: string; available: boolean }>;
}

interface WorkerResult {
    success: boolean;
    duration?: number;
    error?: string;
    data?: any;
}

export const PythonWorkersPanel: React.FC = () => {
    const [activeWorker, setActiveWorker] = useState<'ocr' | 'scraper' | 'lancedb'>('ocr');
    const [workerStatuses, setWorkerStatuses] = useState<WorkerStatus[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<WorkerResult | null>(null);

    // OCR Worker State
    const [ocrFile, setOcrFile] = useState('');
    const [ocrEngine, setOcrEngine] = useState('auto');
    const [ocrLanguage, setOcrLanguage] = useState('eng');

    // Web Scraper State
    const [scraperUrl, setScraperUrl] = useState('');
    const [scraperSelectors, setScraperSelectors] = useState('');
    const [scraperTemplate, setScraperTemplate] = useState('custom');

    // LanceDB State
    const [lancedbFile, setLancedbFile] = useState('');
    const [lancedbTable, setLancedbTable] = useState('');
    const [lancedbTextField, setLancedbTextField] = useState('text');
    const [lancedbBatchSize, setLancedbBatchSize] = useState('100');

    useEffect(() => {
        loadWorkerStatuses();
    }, []);

    /**
     * Load worker availability statuses from the real backend endpoint.
     * Route: GET /api/v1/python-workers/status (also accessible at /api/python-workers/status)
     */
    const loadWorkerStatuses = async () => {
        try {
            const res = await fetch('/api/v1/python-workers/status');
            if (res.ok) {
                const data: WorkersStatusResponse = await res.json();
                // Map backend worker names to display labels
                const displayNames: Record<string, string> = {
                    ocr: 'OCR Worker',
                    scraper: 'Web Scraper',
                    'lancedb-batch': 'LanceDB Batch',
                };
                setWorkerStatuses(
                    data.workers.map((w) => ({
                        name: displayNames[w.name] ?? w.name,
                        available: w.available,
                        totalRuns: 0,
                    }))
                );
            } else {
                throw new Error(`HTTP ${res.status}`);
            }
        } catch (error) {
            logError('PythonWorkersPanel', `Failed to load worker statuses: ${String(error)}`);
            // Fallback: show workers as available so the panel is still usable
            setWorkerStatuses([
                { name: 'OCR Worker', available: true, totalRuns: 0 },
                { name: 'Web Scraper', available: true, totalRuns: 0 },
                { name: 'LanceDB Batch', available: true, totalRuns: 0 },
            ]);
        }
    };

    /**
     * Execute OCR Worker
     */
    const executeOCR = async () => {
        if (!ocrFile.trim()) {
            alert('Please enter a file path');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/v1/python-workers/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: ocrFile,
                    engine: ocrEngine,
                    language: ocrLanguage,
                }),
            });

            const data = await response.json();
            setResult(data);
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || 'OCR execution failed',
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Execute Web Scraper
     */
    const executeScraper = async () => {
        if (!scraperUrl.trim()) {
            alert('Please enter a URL');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const requestBody: any = {
                url: scraperUrl,
                template: scraperTemplate,
            };

            if (scraperTemplate === 'custom' && scraperSelectors) {
                try {
                    requestBody.selectors = JSON.parse(scraperSelectors);
                } catch (e) {
                    alert('Invalid JSON selectors format');
                    setLoading(false);
                    return;
                }
            }

            const response = await fetch('/api/v1/python-workers/scraper', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();
            setResult(data);
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || 'Web scraping failed',
            });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Execute LanceDB Batch Ingestion
     */
    const executeLanceDB = async () => {
        if (!lancedbFile.trim() || !lancedbTable.trim()) {
            alert('Please enter file path and table name');
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/v1/python-workers/lancedb-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: lancedbFile,
                    table_name: lancedbTable,
                    text_field: lancedbTextField,
                    batch_size: parseInt(lancedbBatchSize, 10),
                }),
            });

            const data = await response.json();
            setResult(data);
        } catch (error: any) {
            setResult({
                success: false,
                error: error.message || 'LanceDB ingestion failed',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Worker Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {workerStatuses.map((worker) => (
                    <Card key={worker.name}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{worker.name}</CardTitle>
                            {worker.available ? (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{worker.totalRuns || 0}</div>
                            <p className="text-xs text-zinc-500">Total runs</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Worker Execution Tabs */}
            <Card>
                <CardHeader>
                    <CardTitle>Python Workers Execution</CardTitle>
                    <CardDescription>
                        Execute OCR, web scraping, or LanceDB batch ingestion tasks
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeWorker} onValueChange={(v) => setActiveWorker(v as any)}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="ocr">
                                <FileText className="h-4 w-4 mr-2" />
                                OCR Worker
                            </TabsTrigger>
                            <TabsTrigger value="scraper">
                                <Globe className="h-4 w-4 mr-2" />
                                Web Scraper
                            </TabsTrigger>
                            <TabsTrigger value="lancedb">
                                <Database className="h-4 w-4 mr-2" />
                                LanceDB Batch
                            </TabsTrigger>
                        </TabsList>

                        {/* OCR Worker Tab */}
                        <TabsContent value="ocr" className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">File Path</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="data/invoice.png"
                                    value={ocrFile}
                                    onChange={(e) => setOcrFile(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Engine</label>
                                    <Select value={ocrEngine} onValueChange={setOcrEngine}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">Auto (Best Available)</SelectItem>
                                            <SelectItem value="tesseract">Tesseract</SelectItem>
                                            <SelectItem value="paddleocr">PaddleOCR</SelectItem>
                                            <SelectItem value="easyocr">EasyOCR</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Language</label>
                                    <Select value={ocrLanguage} onValueChange={setOcrLanguage}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="eng">English</SelectItem>
                                            <SelectItem value="hun">Hungarian</SelectItem>
                                            <SelectItem value="deu">German</SelectItem>
                                            <SelectItem value="fra">French</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button onClick={executeOCR} disabled={loading} className="w-full">
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Run OCR
                            </Button>
                        </TabsContent>

                        {/* Web Scraper Tab */}
                        <TabsContent value="scraper" className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Target URL</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="https://example.com"
                                    value={scraperUrl}
                                    onChange={(e) => setScraperUrl(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Template</label>
                                <Select value={scraperTemplate} onValueChange={setScraperTemplate}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="custom">Custom (JSON Selectors)</SelectItem>
                                        <SelectItem value="product">Product Listings</SelectItem>
                                        <SelectItem value="article">Article Content</SelectItem>
                                        <SelectItem value="contact">Contact Info</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {scraperTemplate === 'custom' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Selectors (JSON)</label>
                                    <Textarea
                                        placeholder='[{"name":"title","selector":"h1"},{"name":"price","selector":".price"}]'
                                        value={scraperSelectors}
                                        onChange={(e) => setScraperSelectors(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                            )}
                            <Button onClick={executeScraper} disabled={loading} className="w-full">
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Run Scraper
                            </Button>
                        </TabsContent>

                        {/* LanceDB Batch Tab */}
                        <TabsContent value="lancedb" className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Data File Path</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="data/articles.csv"
                                    value={lancedbFile}
                                    onChange={(e) => setLancedbFile(e.target.value)}
                                />
                                <p className="text-xs text-zinc-500">Supports: CSV, JSON, JSONL, Parquet</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Table Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border rounded-md"
                                        placeholder="knowledge_base"
                                        value={lancedbTable}
                                        onChange={(e) => setLancedbTable(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Text Field</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border rounded-md"
                                        placeholder="text"
                                        value={lancedbTextField}
                                        onChange={(e) => setLancedbTextField(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Batch Size</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border rounded-md"
                                    placeholder="100"
                                    value={lancedbBatchSize}
                                    onChange={(e) => setLancedbBatchSize(e.target.value)}
                                />
                            </div>
                            <Button onClick={executeLanceDB} disabled={loading} className="w-full">
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                                Run Batch Ingestion
                            </Button>
                        </TabsContent>
                    </Tabs>

                    {/* Results Display */}
                    {result && (
                        <div className="mt-6">
                            <Alert variant={result.success ? 'default' : 'destructive'}>
                                {result.success ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <XCircle className="h-4 w-4" />
                                )}
                                <AlertDescription>
                                    {result.success ? (
                                        <div className="space-y-2">
                                            <p className="font-medium">Execution Successful</p>
                                            {result.duration && <p className="text-sm">Duration: {result.duration.toFixed(2)}s</p>}
                                            {result.data && (
                                                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-60">
                                                    {JSON.stringify(result.data, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="font-medium">Execution Failed</p>
                                            <p className="text-sm mt-1">{result.error}</p>
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PythonWorkersPanel;
