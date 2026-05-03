/**
 * PAIOS Model Selector - Reusable Provider Selection Component
 *
 * Features:
 * - 4 model provider selection (Gemini, GPT-4o, Ollama, Anthropic)
 * - Real-time provider health indicators
 * - Compact radix-ui Select dropdown format
 * - Health status badges (🟢 up, 🔴 down, ⚫ unknown)
 *
 * @track paios_model_selector_ui_20260223
 */

import { useState, useEffect } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Brain, Cloud, Cpu, Zap } from 'lucide-react';

export type ModelProvider = 'gemini' | 'github' | 'ollama' | 'anthropic';

export type ProviderHealth = 'healthy' | 'unhealthy' | 'unknown';

export interface ProviderInfo {
    id: ModelProvider;
    label: string;
    icon: typeof Brain;
    color: string;
}

export interface ModelSelectorProps {
    value: ModelProvider;
    onChange: (provider: ModelProvider) => void;
    showHealth?: boolean;
    className?: string;
}

const PROVIDERS: ProviderInfo[] = [
    {
        id: 'gemini',
        label: 'Gemini 2.0 Flash',
        icon: Brain,
        color: 'text-blue-500',
    },
    {
        id: 'github',
        label: 'GPT-4o (GitHub Models)',
        icon: Cloud,
        color: 'text-purple-500',
    },
    {
        id: 'ollama',
        label: 'Qwen 2.5 Coder (Local)',
        icon: Cpu,
        color: 'text-green-500',
    },
    {
        id: 'anthropic',
        label: 'Claude Sonnet 3.5',
        icon: Zap,
        color: 'text-orange-500',
    },
];

export function ModelSelector({
    value,
    onChange,
    showHealth = true,
    className = '',
}: ModelSelectorProps) {
    const [health, setHealth] = useState<Record<ModelProvider, ProviderHealth>>({
        gemini: 'unknown',
        github: 'unknown',
        ollama: 'unknown',
        anthropic: 'unknown',
    });

    // Fetch provider health from backend
    useEffect(() => {
        if (!showHealth) return;

        const fetchHealth = async () => {
            try {
                const response = await fetch('/api/health');
                if (!response.ok) return;

                const data = await response.json();

                setHealth({
                    gemini: data.services?.gemini?.status === 'healthy' ? 'healthy' : 'unhealthy',
                    github: data.services?.github?.status === 'healthy' ? 'healthy' : 'unhealthy',
                    ollama: data.services?.ollama?.status === 'healthy' ? 'healthy' : 'unhealthy',
                    anthropic: data.services?.cloudflare?.status === 'healthy' ? 'healthy' : 'unhealthy',
                });
            } catch {
                // Ignore fetch errors
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Refresh every 30s

        return () => clearInterval(interval);
    }, [showHealth]);

    const getHealthBadge = (status: ProviderHealth) => {
        const variants = {
            healthy: { icon: '🟢', variant: 'default' as const, text: 'UP' },
            unhealthy: { icon: '🔴', variant: 'destructive' as const, text: 'DOWN' },
            unknown: { icon: '⚫', variant: 'secondary' as const, text: '?' },
        };
        const { icon, variant, text } = variants[status];
        return (
            <Badge variant={variant} className="text-xs ml-auto">
                {icon} {text}
            </Badge>
        );
    };

    const selected = PROVIDERS.find(p => p.id === value);
    const SelectedIcon = selected?.icon || Brain;

    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={`w-full ${className}`}>
                <SelectValue>
                    <div className="flex items-center gap-2">
                        <SelectedIcon className={`w-4 h-4 ${selected?.color || 'text-gray-500'}`} />
                        <span>{selected?.label || 'Select Model'}</span>
                        {showHealth && <span className="ml-auto">{getHealthBadge(health[value])}</span>}
                    </div>
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
                {PROVIDERS.map(provider => {
                    const Icon = provider.icon;
                    return (
                        <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex items-center justify-between w-full gap-4">
                                <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${provider.color}`} />
                                    <span>{provider.label}</span>
                                </div>
                                {showHealth && getHealthBadge(health[provider.id])}
                            </div>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}
