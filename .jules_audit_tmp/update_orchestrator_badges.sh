cat << 'INNER_EOF' > /tmp/sed_orchestrator_badges.txt
<<<<<<< SEARCH
                                    {/* Execution Plan */}
                                    {msg.plan && msg.plan.length > 0 && (
                                        <div className="mt-3 space-y-2 border-t pt-2">
                                            <p className="text-xs font-semibold opacity-70">📋 Execution Plan:</p>
                                            {msg.plan.map((step, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <Badge variant="outline" className="shrink-0">
                                                        {step.phase}
                                                    </Badge>
                                                    <div className="flex-1">
                                                        <span className="font-medium">{step.agent}</span>
                                                        <span className="opacity-70"> → {step.task}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
=======
                                    {/* Execution Plan */}
                                    {msg.plan && msg.plan.length > 0 && (
                                        <div className="mt-3 space-y-2 border-t pt-2">
                                            <p className="text-xs font-semibold opacity-70">📋 Csapat bevonása:</p>
                                            {msg.plan.map((step, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs">
                                                    <Badge variant="secondary" className="shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                        {step.phase}
                                                    </Badge>
                                                    <div className="flex-1">
                                                        <span className="font-bold text-primary mr-1">[{step.agent}]</span>
                                                        <span className="opacity-80">{step.task}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
>>>>>>> REPLACE
INNER_EOF

python3 -c '
import sys
with open("/tmp/sed_orchestrator_badges.txt", "r", encoding="utf-8") as f:
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
print("Success: PAIOSOrchestratorChat.tsx updated (Agents Visibility)")
'
