cat << 'INNER_EOF' > /tmp/sed_robotkez_loader.txt
<<<<<<< SEARCH
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Loader className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <div className="bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <p className="text-sm text-muted-foreground">Feldolgozás...</p>
                    </div>
                  </div>
                )}
=======
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Loader className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <div className="bg-muted/50 rounded-lg px-3 py-2 border border-border/50">
                      <p className="text-sm text-muted-foreground animate-pulse">
                        {thinkingText}
                      </p>
                    </div>
                  </div>
                )}
>>>>>>> REPLACE
INNER_EOF

python3 -c '
import sys
with open("/tmp/sed_robotkez_loader.txt", "r", encoding="utf-8") as f:
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
print("Success: RobotkezV2Chat.tsx updated")
'
