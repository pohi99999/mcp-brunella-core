cat << 'INNER_EOF' > /tmp/sed_ui.txt
<<<<<<< SEARCH
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    plan?: PlanStep[];
    taskIds?: number[];
    error?: boolean;
}
=======
interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    plan?: PlanStep[];
    taskIds?: number[];
    error?: boolean;
    isStreaming?: boolean;
}
>>>>>>> REPLACE
<<<<<<< SEARCH
    const [isLoading, setIsLoading] = useState(false);
=======
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingText, setThinkingText] = useState('Gondolkodom...');
>>>>>>> REPLACE
<<<<<<< SEARCH
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
=======
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        
        const thinkingPhrases = [
            'Elemezem a kérést...',
            'Konzultálok a csapattal...',
            'Összeállítom az akciótervet...',
            'Mindjárt mondom...',
            'Gondolkodom...'
        ];
        let phraseIdx = 0;
        const thinkingInterval = setInterval(() => {
            setThinkingText(thinkingPhrases[phraseIdx % thinkingPhrases.length]);
            phraseIdx++;
        }, 1500);

        try {
>>>>>>> REPLACE
<<<<<<< SEARCH
            const result = await response.json();

            if (result.success) {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: result.summary,
                        timestamp: Date.now(),
                        plan: result.plan,
                        taskIds: result.taskIds,
                    },
                ]);
                toast.success('✅ Orchestrator válaszolt');
                playTTS(result.summary);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Hiba történt';
            toast.error(`❌ ${msg}`);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: `❌ Hiba: ${msg}`,
                    timestamp: Date.now(),
                    error: true,
                },
            ]);
        } finally {
            setIsLoading(false);
        }
=======
            const result = await response.json();
            clearInterval(thinkingInterval);

            if (result.success) {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'assistant',
                        content: result.summary,
                        timestamp: Date.now(),
                        plan: result.plan,
                        taskIds: result.taskIds,
                    },
                ]);
                toast.success('✨ Készen vagyok!');
                playTTS(result.summary);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (e: unknown) {
            clearInterval(thinkingInterval);
            const msg = e instanceof Error ? e.message : 'Hiba történt';
            toast.error(`❌ Ajjaj, valami hiba csúszott a gépezetbe: ${msg}`);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: `❌ Hiba: ${msg}`,
                    timestamp: Date.now(),
                    error: true,
                },
            ]);
        } finally {
            setIsLoading(false);
            setThinkingText('Gondolkodom...');
        }
>>>>>>> REPLACE
<<<<<<< SEARCH
                    {isLoading && (
                        <p className="text-xs text-muted-foreground mt-2 animate-pulse">
                            ⏳ Orchestrator gondolkodik...
                        </p>
                    )}
=======
                    {isLoading && (
                        <div className="flex items-center gap-2 mt-2">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                            <p className="text-xs text-muted-foreground animate-pulse">
                                {thinkingText}
                            </p>
                        </div>
                    )}
>>>>>>> REPLACE
INNER_EOF

python3 -c '
import sys
with open("/tmp/sed_ui.txt", "r", encoding="utf-8") as f:
    diff = f.read()

parts = diff.split("<<<<<<< SEARCH")
content = ""
with open("src/dashboard/components/dashboard/PAIOSOrchestratorChat.tsx", "r", encoding="utf-8") as f:
    content = f.read()

for part in parts[1:]:
    search = part.split("=======")[0].strip("\n")
    replace = part.split("=======")[1].split(">>>>>>> REPLACE")[0].strip("\n")
    
    if search in content:
        content = content.replace(search, replace)
    else:
        print(f"Error: Could not find search string:\n{search[:100]}...")
        sys.exit(1)

with open("src/dashboard/components/dashboard/PAIOSOrchestratorChat.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Success: PAIOSOrchestratorChat.tsx updated")
'
