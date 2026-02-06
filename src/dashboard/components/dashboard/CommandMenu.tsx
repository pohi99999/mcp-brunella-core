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
                    className="inline-flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
                >
                    <Search size={14} />
                    <span className="flex-1 text-left">Keresés...</span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
            </div>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Írj be parancsot vagy keress..." />
                <CommandList className="glass-panel border-0">
                    <CommandEmpty>Nincs találat.</CommandEmpty>
                    <CommandGroup heading="Navigáció">
                        <CommandItem onSelect={() => { setActiveTab('dashboard'); setOpen(false) }}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Dashboard</span>
                        </CommandItem>
                        <CommandItem onSelect={() => { setActiveTab('inventory'); setOpen(false) }}>
                            <Package className="mr-2 h-4 w-4" />
                            <span>Inventory</span>
                        </CommandItem>
                        <CommandItem onSelect={() => { setActiveTab('chat'); setOpen(false) }}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            <span>Neural Link Chat</span>
                        </CommandItem>
                        <CommandItem onSelect={() => { setActiveTab('files'); setOpen(false) }}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Fájlrendszer</span>
                        </CommandItem>
                        <CommandItem onSelect={() => { setActiveTab('settings'); setOpen(false) }}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Beállítások</span>
                        </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="Eszközök">
                        <CommandItem onSelect={() => { setActiveTab('n8n'); setOpen(false) }}>
                            <Workflow className="mr-2 h-4 w-4" />
                            <span>n8n Automatizáció</span>
                        </CommandItem>
                        <CommandItem onSelect={() => { setActiveTab('langflow'); setOpen(false) }}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            <span>Langflow</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    )
}
