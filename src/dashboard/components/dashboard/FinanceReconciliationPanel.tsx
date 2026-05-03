import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  getBookkeepingStatus, 
  getBookkeepingTransactions, 
  sendBookkeepingSummaryEmail,
  executeAgent,
  BookkeepingTransaction 
} from "@/lib/apiService";
import { toast } from "sonner";
import {
  BarChart3,
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCcw,
  ExternalLink,
  Search
} from "lucide-react";

export function FinanceReconciliationPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [unmatched, setUnmatched] = useState<BookkeepingTransaction[]>([]);

  const loadData = useCallback(async () => {
    try {
      const statusRes = await getBookkeepingStatus();
      setStatus(statusRes);

      const transactionsRes = await getBookkeepingTransactions({ status: 'UNMATCHED', limit: 50 });
      setUnmatched(transactionsRes.entries);
    } catch (error) {
      console.error("Failed to load bookkeeping data", error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunReconciliation = async () => {
    setLoading(true);
    toast.info(t("finance_recon.running"));
    try {
      await executeAgent("MatchingAgent", "Match all PENDING bank transactions");
      toast.success(t("finance_recon.complete"));
      await loadData();
    } catch (error: any) {
      toast.error(`${t("common.error", "Hiba")}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      await sendBookkeepingSummaryEmail();
      toast.success(t("finance_recon.report_sent"));
    } catch (error: any) {
      toast.error(`${t("common.error", "Hiba")} az email küldésekor: ${error.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t("finance_recon.title")}</h1>
          <p className="text-zinc-400 text-sm">{t("finance_recon.description")}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSendEmail} className="gap-2 border-white/10 hover:bg-white/5 text-zinc-300">
            <Mail size={16} />
            {t("finance_recon.send_report")}
          </Button>
          <Button onClick={handleRunReconciliation} disabled={loading} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
            {loading ? <RefreshCcw size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            {t("finance_recon.run_recon")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard title={t("finance_recon.stats.total")} value={status?.summary?.total || 0} icon={<BarChart3 className="text-blue-400" />} />
        <StatusCard title={t("finance_recon.stats.matched")} value={status?.summary?.completed || 0} icon={<CheckCircle2 className="text-emerald-400" />} color="text-emerald-400" />
        <StatusCard title={t("finance_recon.stats.pending")} value={status?.summary?.pending || 0} icon={<Clock className="text-yellow-400" />} color="text-yellow-400" />
        <StatusCard title={t("finance_recon.stats.exception")} value={status?.summary?.unmatched || 0} icon={<AlertCircle className="text-red-400" />} color="text-red-400" />
      </div>

      <Card className="glass-card border-white/[0.04] bg-white/[0.02]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle size={18} className="text-red-400" />
            {t("finance_recon.exceptions_title")}
          </CardTitle>
          <CardDescription>{t("finance_recon.exceptions_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">{t("finance_recon.table.date")}</TableHead>
                <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">{t("finance_recon.table.partner")}</TableHead>
                <TableHead className="text-zinc-500 uppercase text-[10px] font-bold text-right">{t("finance_recon.table.amount")}</TableHead>
                <TableHead className="text-zinc-500 uppercase text-[10px] font-bold">{t("finance_recon.table.description")}</TableHead>
                <TableHead className="text-zinc-500 uppercase text-[10px] font-bold text-center">{t("finance_recon.table.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmatched.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-zinc-500">{t("finance_recon.no_exceptions")}</TableCell>
                </TableRow>
              ) : (
                unmatched.map((tx) => (
                  <TableRow key={tx.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="text-xs text-zinc-300">{tx.data.date}</TableCell>
                    <TableCell className="text-xs font-medium text-white">{tx.data.partner}</TableCell>
                    <TableCell className="text-xs text-right font-mono text-white">{tx.data.amount?.toLocaleString()} HUF</TableCell>
                    <TableCell className="text-xs text-zinc-400 italic max-w-xs truncate">{tx.data.reference || tx.data.description}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-white/5">
                        <Search size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCard({ title, value, icon, color = "text-white" }: { title: string, value: number, icon: React.ReactNode, color?: string }) {
  return (
    <Card className="glass-card border-white/[0.04] bg-white/[0.03]">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{title}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
