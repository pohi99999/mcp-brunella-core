cat << 'INNER_EOF' > /tmp/sed_robotkez_ui.txt
<<<<<<< SEARCH
  // Send chat message
  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setActivePlan(null);
    setCurrentStep(-1);

    try {
      const result = await api.robotkezChat(text);

      // Check if task was delegated to background
      if (result.data?.taskId) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
          taskId: result.data.taskId,
          plan: result.data.plan,
          backgroundTask: true
        }]);
        toast.info('Háttérben fut - lásd Background Tasks');
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message || (result.success ? 'Kész!' : 'Hiba történt'),
          timestamp: Date.now(),
          screenshot: result.data?.screenshot
        }]);
        toast.success('Feladat befejezve');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Hiba történt';
      toast.error(msg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Hiba: ${msg}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      refreshData();
    }
  };
=======
  // Send chat message
  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setActivePlan(null);
    setCurrentStep(-1);

    const thinkingPhrases = [
      'Böngésző indul...',
      'Oldalt elemzem...',
      'DOM fát olvasom...',
      'Kattintási célpontokat keresek...',
      'Még egy kis türelmet...'
    ];
    let phraseIdx = 0;
    const thinkingInterval = setInterval(() => {
      setThinkingText(thinkingPhrases[phraseIdx % thinkingPhrases.length]);
      phraseIdx++;
    }, 1500);

    try {
      const result = await api.robotkezChat(text);
      clearInterval(thinkingInterval);

      // Check if task was delegated to background
      if (result.data?.taskId) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message || `🚀 Rendben, felpörgetem a böngészőt (ID: ${result.data.taskId}).`,
          timestamp: Date.now(),
          taskId: result.data.taskId,
          plan: result.data.plan,
          backgroundTask: true
        }]);
        toast.info('🚀 Robotkéz elindult a háttérben!');
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.message || (result.success ? '✅ Meg is oldottam!' : '⚠️ Problémába ütköztem.'),
          timestamp: Date.now(),
          screenshot: result.data?.screenshot
        }]);
        toast.success('✨ Feladat elvégezve');
      }
    } catch (e: unknown) {
      clearInterval(thinkingInterval);
      const msg = e instanceof Error ? e.message : 'Hiba történt';
      toast.error(`❌ ${msg}`);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Ajjaj, hiba csúszott a folyamatba: ${msg}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
      setThinkingText('Gondolkodom...');
      refreshData();
    }
  };
>>>>>>> REPLACE
INNER_EOF

python3 -c '
import sys
with open("/tmp/sed_robotkez_ui.txt", "r", encoding="utf-8") as f:
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
