import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import
{
    Package,
    TrendUp,
    TrendDown,
    CheckCircle,
    MagnifyingGlass,
    ChartLineUp
} from "@phosphor-icons/react";
import * as api from "@/lib/apiService";

interface ValuationRow
{
    sku: string;
    name: string;
    unit: string;
    valuation_method: string;
    current_stock: number;
    fifo_stock_value: number;
    wac_stock_value: number;
}

interface StocktakeSummary
{
    id: string;
    sku: string;
    name: string;
    discrepancy: number;
    discrepancy_value: number;
    status: string;
    created_at: string;
}

export function InventoryRadarWidget ()
{
    const [valuation, setValuation] = useState<ValuationRow[]>( [] );
    const [stocktakes, setStocktakes] = useState<StocktakeSummary[]>( [] );
    const [loading, setLoading] = useState( true );
    const [errorMessage, setErrorMessage] = useState<string | null>( null );

    useEffect( () =>
    {
        async function fetchData ()
        {
            setLoading( true );
            try
            {
                const [vData, sData] = await Promise.all( [
                    api.fetchInventoryValuation(),
                    api.fetchOpenStocktakes()
                ] );

                // If the response is the envelope { success: true, summary: [...] }
                const vArray = ( vData && ( vData as any ).summary ) ? ( vData as any ).summary : ( vData || [] );
                const sArray = Array.isArray( sData ) ? sData : [];

                setValuation( vArray );
                setStocktakes( sArray );
                setErrorMessage( null );
            } catch ( error )
            {
                console.error( "Error fetching inventory radar data:", error );
                setErrorMessage( "Hiba a készletadatok betöltésekor" );
            } finally
            {
                setLoading( false );
            }
        }
        fetchData();
    }, [] );

    if ( loading )
    {
        return (
            <div className="flex h-48 items-center justify-center text-zinc-500 italic text-sm">
                Készletadatok betöltése...
            </div>
        );
    }

    if ( errorMessage )
    {
        return (
            <div className="flex h-48 items-center justify-center text-red-400 italic text-sm">
                {errorMessage}
            </div>
        );
    }

    const lowStockItems = valuation.filter( ( item: ValuationRow ) => item.current_stock <= 0 );

    const totalValue = valuation.reduce( ( acc: number, curr: ValuationRow ) =>
        acc + ( curr.valuation_method === "FIFO" ? curr.fifo_stock_value : curr.wac_stock_value ), 0
    );

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-zinc-900/40 border-white/[0.04]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Package size={18} className="text-blue-400" />
                        Készletérték Radar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">
                        {totalValue.toLocaleString( "hu-HU" )} Ft
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Összesített ELÁBÉ alapú készletérték</p>
                    <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Termékek száma:</span>
                            <span className="text-zinc-200">{valuation.length} db</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Kritikus (0 készlet):</span>
                            <span className={lowStockItems.length > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>
                                {lowStockItems.length} tétel
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-white/[0.04]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MagnifyingGlass size={18} className="text-amber-400" />
                        Aktív Leltárvizsgálat
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[120px] px-6">
                        <div className="space-y-3 pb-4">
                            {stocktakes.length > 0 ? (
                                stocktakes.map( ( st: StocktakeSummary ) => (
                                    <div key={st.id} className="flex items-start justify-between border-b border-white/[0.02] pb-2 last:border-0">
                                        <div>
                                            <div className="text-xs font-medium text-zinc-200">{st.sku}</div>
                                            <div className="text-[10px] text-zinc-500">{st.name}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs font-bold ${ st.discrepancy < 0 ? "text-red-400" : "text-emerald-400" }`}>
                                                {st.discrepancy > 0 ? "+" : ""}{st.discrepancy}
                                            </div>
                                            <Badge variant="outline" className="text-[9px] h-4 px-1 uppercase">{st.status}</Badge>
                                        </div>
                                    </div>
                                ) )
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[100px] text-zinc-500 italic text-xs">
                                    <CheckCircle size={24} className="mb-2 text-emerald-500/40" />
                                    Nincs nyitott leltáreltérés
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Card className="bg-zinc-900/40 border-white/[0.04]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <ChartLineUp size={18} className="text-emerald-400" />
                        Beszerzési Radar
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/10 p-2 rounded-lg">
                            <TrendUp size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-white">Autonóm mód</div>
                            <p className="text-[10px] text-zinc-500">AI elemzés: Kereslet alapú utánpótlás aktív</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded border border-white/[0.04]">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Draft PO-k</span>
                            <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-none">Aktív</Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
