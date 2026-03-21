cat << 'INNER_EOF' > /tmp/sed_robotkez_badges.txt
<<<<<<< SEARCH
        {activePlan && (
          <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="w-4 h-4 text-primary" />
                Végrehajtási Terv ({activePlan.plan.length} lépés)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activePlan.plan.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded bg-muted/30 border border-border/30"
                  >
                    {getStepIcon(currentStep === i ? 'running' : currentStep > i ? 'completed' : 'pending')}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{step.action}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
=======
        {activePlan && (
          <Card className="glass-card border-border/50 bg-background/50 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="w-4 h-4 text-primary" />
                🔥 Lépésről-lépésre Terv ({activePlan.plan.length} lépés)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activePlan.plan.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2 rounded bg-muted/30 border border-border/30 transition-all hover:bg-muted"
                  >
                    {getStepIcon(currentStep === i ? 'running' : currentStep > i ? 'completed' : 'pending')}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] leading-none text-blue-500 border-blue-500/30 bg-blue-500/10">
                          {step.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
>>>>>>> REPLACE
INNER_EOF

python3 -c '
import sys
with open("/tmp/sed_robotkez_badges.txt", "r", encoding="utf-8") as f:
    diff = f.read()

parts = diff.split("<<<<<<< SEARCH")
content = ""
with open("src/dashboard/components/dashboard/RobotkezV2Chat.tsx", "r", encoding="utf-8") as f:
    content = f.read()

for part in parts[1:]:
    search = part.split("=======")[0].strip("\n")
    replace = part.split("=======")[1].split(">>>>>>> REPLACE")[0].strip("\n")
    
    if search in content:
        content = content.replace(search, replace)
    else:
        print(f"Error: Could not find search string:\n{search[:100]}...")
        sys.exit(1)

with open("src/dashboard/components/dashboard/RobotkezV2Chat.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("Success: RobotkezV2Chat.tsx updated (Plan Badges)")
'
