import { useEffect, useState } from "react"
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutDashboard,
    Package,
    MessageCircle,
    Workflow,
    Sparkles,
    FileText,
    Search
} from "lucide-react"

import { navigationRegistry } from "@/lib/navigation"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"

interface CommandMenuProps {
    setActiveTab: (tab: string) => void
    activeTab: string
}

export function CommandMenu({ setActiveTab, activeTab }: CommandMenuProps) {
    const [open, setOpen] = useState(false)
    const items = navigationRegistry.getAllItems();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    return (
        <>
            <div className="hidden lg:flex relative w-full max-w-sm items-center mr-4">
                <button
                    onClick={() => setOpen(true)}
                    className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-500 shadow-sm transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                >
                    <Search size={14} />
                    <span className="flex-1 text-left">Keresés...</span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[10px] font-medium text-zinc-500 opacity-100">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
            </div>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Írj be parancsot vagy keress..." />
                <CommandList className="glass-panel border-0">
                    <CommandEmpty>Nincs találat.</CommandEmpty>
                    <CommandGroup heading="Navigáció">
                        {items.map(item => (
                            <CommandItem 
                                key={item.id} 
                                onSelect={() => { setActiveTab(item.id); setOpen(false) }}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.label}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
