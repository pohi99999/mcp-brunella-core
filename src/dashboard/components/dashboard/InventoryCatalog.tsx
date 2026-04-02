import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, MagnifyingGlass, ChartLineUp } from "@phosphor-icons/react";
import * as api from "@/lib/apiService";
import { InventoryRadarWidget } from "./InventoryRadarWidget";

interface ValuationRow {
    sku: string;
    name: string;
    unit: string;
    valuation_method: string;
    current_stock: number;
    fifo_stock_value: number;
    wac_stock_value: number;
}

export function InventoryCatalog() {
    const [items, setItems] = useState<ValuationRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const data = await api.fetchInventoryValuation();
                setItems(data || []);
            } catch (error) {
                console.error("Error loading inventory catalog:", error);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Készlet- és Leltárkezelés</h2>
                <p className="text-zinc-400 text-sm">Autonóm FIFO/WAC értékelés és láncolt készletradar.</p>
            </div>

            <InventoryRadarWidget />

            <Card className="bg-zinc-900/40 border-white/[0.04]">
                <CardHeader>
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <Package size={20} className="text-blue-400" />
                        Termékleltár & Értékelés
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader className="bg-white/[0.02]">
                                <TableRow className="border-white/[0.04]">
                                    <TableHead className="text-zinc-400 font-medium">SKU</TableHead>
                                    <TableHead className="text-zinc-400 font-medium">Név</TableHead>
                                    <TableHead className="text-zinc-400 font-medium text-right">Készlet</TableHead>
                                    <TableHead className="text-zinc-400 font-medium text-right">Módszer</TableHead>
                                    <TableHead className="text-zinc-400 font-medium text-right">FIFO Érték</TableHead>
                                    <TableHead className="text-zinc-400 font-medium text-right">WAC Érték</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length > 0 ? (
                                    items.map((item) => (
                                        <TableRow key={item.sku} className="border-white/[0.04] hover:bg-white/[0.01]">
                                            <TableCell className="font-mono text-[11px] text-zinc-300">{item.sku}</TableCell>
                                            <TableCell className="text-sm text-zinc-200">{item.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={item.current_stock <= 0 ? "destructive" : "outline"} className="text-xs">
                                                    {item.current_stock} {item.unit}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-zinc-500 uppercase">{item.valuation_method}</TableCell>
                                            <TableCell className="text-right text-sm font-medium text-white">
                                                {item.fifo_stock_value.toLocaleString("hu-HU")} Ft
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-zinc-400 italic">
                                                {item.wac_stock_value.toLocaleString("hu-HU")} Ft
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-zinc-500 italic">
                                            {loading ? "Adatok betöltése..." : "Nincs elérhető készletadat."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
