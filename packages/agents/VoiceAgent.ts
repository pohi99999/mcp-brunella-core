import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo, logError } from '@packages/utils/logger.js';

/**
 * VoiceAgent - Auralia-inspired Voice Command Specialist
 * 
 * Ez az ügynök felelős a hangalapú interakciók kontextusának kezeléséért.
 * Bár a leírást (STT) a Python backend végzi, a VoiceAgent képes:
 * 1. A kapott szöveges parancs szemantikai javítására (Auralia CommandProcessor logika).
 * 2. Képernyőkép kontextussal együtt értelmezni a hangparancsot (Multimodal).
 * 3. Speciális "hang-csak" válaszok generálására.
 */
export class VoiceAgent extends BaseAgent {
    name = 'voice';
    role = 'Voice & Multimodal Interface Specialist';
    description = 'Képes hangutasítások (STT szöveg) finomhangolására, képi kontextus (screenshot) értelmezésére és multimodális feladatok előkészítésére.';
    capabilities = [
        'voice_command_refinement',
        'multimodal_context_analysis',
        'screenshot_analysis'
    ];
    triggers = ['hang', 'voice', 'audio', 'hallod', 'kép a képernyőn', 'screenshot'];

    async executeTask(context: AgentContext): Promise<AgentResult> {
        logInfo('VoiceAgent', `Feldolgozás alatt: ${context.task}`);

        // Itt lehetne egy "Refinement" lépés, ahol a nyers STT szöveget javítjuk
        // pl. LLM segítségével, kontextus alapján.

        // Egyelőre egy egyszerű pass-through logikát valósítunk meg,
        // de az Auralia mintájára itt lehetne a "CommandProcessor" logika.

        const thoughts = `A hangutasítás szöveges átirata beérkezett. A felhasználó szándéka: "${context.task}". Ezt továbbítom a végrehajtóknak.`;

        return {
            success: true,
            message: `Értettem a hangutasítást: "${context.task}"`,
            thoughts: thoughts,
            metadata: {
                source: 'voice_input',
                original_transcript: context.task
            }
        };
    }
}

export default VoiceAgent;

