import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, User, Bot, Zap, ArrowRight } from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { cn } from '@/lib/utils';

export function LiveChatterWidget() {
  const { chatter } = useSocket();

  const getAgentIcon = (name: string) => {
    if (name.toLowerCase() === 'system') return <Zap className="w-3 h-3 text-yellow-500" />;
    if (name.toLowerCase() === 'orchestrator') return <Bot className="w-3 h-3 text-purple-500" />;
    return <User className="w-3 h-3 text-blue-500" />;
  };

  return (
    <Card className="h-full flex flex-col glass-panel">
      <CardHeader className="p-4 border-b border-white/5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold tracking-widest uppercase flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Ügynökök Közötti Csevegés
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-500 uppercase">Live Feed</span>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full max-h-[400px]">
          <div className="p-4 space-y-4">
            {chatter.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-500 space-y-2">
                <MessageSquare className="w-8 h-8 opacity-20" />
                <p className="text-xs italic">Még nincs ügynök aktivitás...</p>
              </div>
            ) : (
              chatter.map((entry) => (
                <div 
                  key={entry.id} 
                  className="group flex flex-col space-y-1 animate-in fade-in slide-in-from-left-2 duration-300"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {getAgentIcon(entry.sender)}
                      <span className="text-[10px] font-bold text-zinc-300">{entry.sender}</span>
                    </div>
                    
                    {entry.receiver && (
                      <>
                        <ArrowRight className="w-3 h-3 text-zinc-600" />
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                          {getAgentIcon(entry.receiver)}
                          <span className="text-[10px] font-bold text-zinc-300">{entry.receiver}</span>
                        </div>
                      </>
                    )}
                    
                    <span className="text-[9px] text-zinc-600 font-mono ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString('hu-HU')}
                    </span>
                  </div>
                  
                  <div className="pl-2 border-l-2 border-primary/20 group-hover:border-primary/50 transition-colors">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {entry.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
