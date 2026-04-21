import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Copy, ExternalLink, MessageSquare, Send, Users, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";

interface TrackingItem {
    id: string;
    category: string;
    name: string;
    email: string;
    sentAt: string;
}

const WAVE2_CONTACTS: TrackingItem[] = [
    { id: "a1", category: "Webdesign", name: "Webdesign.hu", email: "info@webdesign.hu", sentAt: "2026-02-27 10:00" },
    { id: "a2", category: "SEO/PPC", name: "Ranking.hu", email: "hello@ranking.hu", sentAt: "2026-02-27 10:30" },
    { id: "a3", category: "PR", name: "PR Herald", email: "info@prherald.hu", sentAt: "2026-02-27 11:00" },
];

export function LeadsMasterMonitor() {
    const { t } = useTranslation();
    const [tracking] = useState<Record<string, { status: string; note: string }>>({});
    const stats = useMemo(() => ({ sent: WAVE2_CONTACTS.length, replied_yes: 0, replied_no: 0, no_response: 0 }), []);

    const handleCopy = () => {
        toast.success(t("leads_monitor.link_copied"));
    };

    return (
        <Card className="w-full border-primary/20 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-400" /> {t("leads_monitor.title")}</CardTitle>
                        <CardDescription>{t("leads_monitor.description")}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="mr-2 h-3.5 w-3.5" /> {t("leads_monitor.copy_link")}</Button>
                        <Button size="sm" onClick={() => toast.info(t("leads_monitor.open_new_tab")) }><ExternalLink className="mr-2 h-3.5 w-3.5" /> {t("leads_monitor.open")}</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-4">
                    {[
                        { label: t("leads_monitor.stats.sent"), value: stats.sent, icon: Send, tone: "text-blue-300" },
                        { label: t("leads_monitor.stats.interested"), value: stats.replied_yes, icon: CheckCircle2, tone: "text-emerald-300" },
                        { label: t("leads_monitor.stats.rejected"), value: stats.replied_no, icon: XCircle, tone: "text-rose-300" },
                        { label: t("leads_monitor.stats.no_response"), value: stats.no_response, icon: MessageSquare, tone: "text-slate-300" },
                    ].map((item) => {
                        const Icon = item.icon;
                        return (
                            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400"><Icon className={`h-4 w-4 ${item.tone}`} /> {item.label}</div>
                                <div className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <ScrollArea className="h-[420px]">
                        <div className="space-y-2 pr-2">
                            {WAVE2_CONTACTS.map((contact) => (
                                <div key={contact.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 p-3">
                                    <div>
                                        <div className="text-sm font-semibold text-white">{contact.name}</div>
                                        <div className="text-xs text-slate-400">{contact.category} • {contact.email}</div>
                                    </div>
                                    <Badge variant="secondary" className="border-white/10 bg-white/5 text-slate-200">{t("leads_monitor.stats.sent")}</Badge>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}
