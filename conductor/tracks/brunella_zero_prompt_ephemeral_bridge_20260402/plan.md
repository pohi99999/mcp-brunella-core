# Plan — Brunella Zero-Prompt → Ephemeral Agent Bridge

1. Azonosítani, mely Zero-Prompt eseményekből kell dinamikus agent-spawn trigger legyen.
2. Meghatározni a policy-alapú spawn feltételeket és a jóváhagyási határokat.
3. Összekötni a Zero-Prompt eseményészlelést az ephemeral agent lifecycle-lel.
4. Rögzíteni az audit, sandbox és tool-scope követelményeket az automatikusan keltett ágensekhez.
5. Meghatározni, hogyan jelenjen meg a proaktív, dinamikus végrehajtás a dashboardon és a CLI-ben.
6. Szabályozni a költség-, kockázat- és trigger-thresholdokat.
7. Kialakítani a safe-fallback viselkedést, ha spawn helyett csak approval vagy escalation kell.
8. A híd működéséhez célzott acceptance kritériumokat rögzíteni.
