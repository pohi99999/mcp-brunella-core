
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { createAgent } from '@/lib/apiService'
import { toast } from 'sonner'
import { Plus, X, RocketLaunch, IdentificationCard, ListChecks, Lightning } from '@phosphor-icons/react'

export function AgentFactory() {
    const { t } = useTranslation();
    const [name, setName] = useState('')
    const [role, setRole] = useState('')
    const [description, setDescription] = useState('')
    const [capabilities, setCapabilities] = useState<string[]>([])
    const [newCap, setNewCap] = useState('')
    const [triggers, setTriggers] = useState<string[]>([])
    const [newTrigger, setNewTrigger] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleAddCap = () => {
        if (newCap.trim() && !capabilities.includes(newCap.trim())) {
            setCapabilities([...capabilities, newCap.trim()])
            setNewCap('')
        }
    }

    const handleAddTrigger = () => {
        if (newTrigger.trim() && !triggers.includes(newTrigger.trim())) {
            setTriggers([...triggers, newTrigger.trim()])
            setNewTrigger('')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !role) {
            toast.error(t("factory.required_error"));
            return
        }

        setIsSubmitting(true)
        try {
            await createAgent({
                name,
                role,
                description,
                capabilities,
                triggers
            })
            toast.success(t("factory.success_message", { name }));
            // Reset form
            setName('')
            setRole('')
            setDescription('')
            setCapabilities([])
            setTriggers([])
        } catch (error: any) {
            toast.error(`${t("factory.error_message")}: ${error.message}`)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <RocketLaunch size={24} weight="duotone" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("factory.title")}</h2>
                    <p className="text-zinc-500">{t("factory.description")}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-6 max-w-2xl">
                <Card className="glass-card border-white/10 shadow-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <IdentificationCard size={20} />
                            {t("factory.basic_info")}
                        </CardTitle>
                        <CardDescription>{t("factory.identity_desc")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("factory.agent_name_label")}</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t("factory.agent_name_placeholder")}
                                className="bg-white/[0.04] border-white/10 focus:border-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("factory.role_label")}</label>
                            <Input
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                placeholder={t("factory.role_placeholder")}
                                className="bg-white/[0.04] border-white/10 focus:border-primary"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t("factory.description_label")}</label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t("factory.description_placeholder")}
                                className="bg-white/[0.04] border-white/10 min-h-[100px] focus:border-primary"
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 sm:grid-cols-2">
                    <Card className="glass-card border-white/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-primary text-base">
                                <ListChecks size={18} />
                                {t("factory.capabilities")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <Input
                                    value={newCap}
                                    onChange={(e) => setNewCap(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCap())}
                                    placeholder={t("factory.capability_placeholder")}
                                    className="bg-white/[0.04] border-white/10"
                                />
                                <Button type="button" size="icon" onClick={handleAddCap} variant="secondary">
                                    <Plus />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[40px]">
                                {capabilities.map(cap => (
                                    <Badge key={cap} variant="secondary" className="gap-1 pr-1">
                                        {cap}
                                        <button type="button" aria-label={t("factory.remove_cap")} title={t("factory.remove_cap")} onClick={() => setCapabilities(capabilities.filter(c => c !== cap))}>
                                            <X size={12} />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-white/10">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-primary text-base">
                                <Lightning size={18} />
                                {t("factory.triggers")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-2">
                                <Input
                                    value={newTrigger}
                                    onChange={(e) => setNewTrigger(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTrigger())}
                                    placeholder={t("factory.trigger_placeholder")}
                                    className="bg-white/[0.04] border-white/10"
                                />
                                <Button type="button" size="icon" onClick={handleAddTrigger} variant="secondary">
                                    <Plus />
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2 min-h-[40px]">
                                {triggers.map(t => (
                                    <Badge key={t} variant="outline" className="gap-1 pr-1 bg-primary/5">
                                        {t}
                                        <button type="button" aria-label={t("factory.remove_trigger")} title={t("factory.remove_trigger")} onClick={() => setTriggers(triggers.filter(tr => tr !== t))}>
                                            <X size={12} />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01]"
                >
                    {isSubmitting ? t("factory.creating_button") : t("factory.create_button")}
                </Button>
            </form>
        </div>
    )
}
