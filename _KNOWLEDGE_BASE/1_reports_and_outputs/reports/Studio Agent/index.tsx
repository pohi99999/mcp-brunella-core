/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { marked } from 'marked';
import { GoogleGenAI, Chat } from '@google/genai';

// --- DOM ELEMENT REFERENCES ---
const footerStatus = document.getElementById('footer-status') as HTMLElement;
const memoryPanel = document.getElementById('memory-panel') as HTMLElement;
const agentPanel = document.getElementById('agent-panel') as HTMLElement;
const monitorPanel = document.getElementById('monitor-panel') as HTMLElement;

// --- STATE MANAGEMENT (SIMULATED) ---
type AgentStatus = 'Szabad' | 'Elfoglalt';
type ProcessStatus = 'Fut' | 'Siker' | 'Hiba';

interface Agent {
  name: string;
  status: AgentStatus;
}

interface Process {
  id: number;
  agentName: string;
  task: string;
  status: ProcessStatus;
}

let agents: Record<string, Agent> = {
  gemini: { name: 'Brunella (Gemini)', status: 'Szabad' },
  'qwen3-coder': { name: 'Qwen3-coder', status: 'Szabad' },
  langlow: { name: 'Langlow', status: 'Szabad' },
  jules: { name: 'Jules', status: 'Szabad' },
};

let processes: Process[] = [];
let processIdCounter = 0;
let lastMemorySave: Date | null = null;
let memorySaveState: 'Elmentve ✅' | 'Nincs mentve' | 'Mentés...' = 'Nincs mentve';

// --- GEMINI API INITIALIZATION ---
const API_KEY = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

const chat: Chat = ai.chats.create({
  model: 'gemini-2.5-flash',
  config: {
    systemInstruction: 'Te Brunella vagy, egy AI ügynök. A feladatod, hogy a felhasználó által kért parancsokat (pl. összefoglalás) végrehajtsd.',
  },
});

// --- CORE APPLICATION LOGIC ---

/**
 * Disables or enables key action buttons across the app.
 * @param isBusy - Whether the app is busy or not.
 */
function setAppBusy(isBusy: boolean) {
    document.querySelectorAll<HTMLButtonElement>('.action-button').forEach(button => {
        button.disabled = isBusy;
    });
    footerStatus.textContent = isBusy ? 'Status: Dolgozom...' : 'Status: Idle';
}

/**
 * Simulates running an agent task.
 * @param agentKey - The key of the agent to run.
 * @param task - The task description.
 */
async function runAgentTask(agentKey: string, task: string) {
  const agent = agents[agentKey];
  if (!agent || agent.status === 'Elfoglalt') {
    alert(`${agent.name} jelenleg el van foglalva.`);
    return;
  }

  setAppBusy(true);
  agent.status = 'Elfoglalt';

  processIdCounter++;
  const newProcess: Process = {
    id: processIdCounter,
    agentName: agent.name,
    task,
    status: 'Fut',
  };
  processes.unshift(newProcess);

  updateMonitoringWidgets();

  // Simulate API call (POST /agent/run) for 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  agent.status = 'Szabad';
  const completedProcess = processes.find(p => p.id === newProcess.id);
  if (completedProcess) {
    completedProcess.status = 'Siker';
  }
  
  setAppBusy(false);
  updateMonitoringWidgets();
}

// --- WIDGET CREATION FUNCTIONS ---

function createMemoryManagementWidget(container: HTMLElement) {
    container.innerHTML = `
        <h3>📂 Memóriakezelés</h3>
        <div id="memory-status-text" class="status-text"></div>
        <div class="widget-button-group">
            <button id="save-memory-button" class="action-button">💾 Mentés</button>
            <button id="restore-memory-button" class="action-button">📂 Visszaállítás</button>
        </div>
    `;

    const statusText = container.querySelector('#memory-status-text') as HTMLDivElement;
    
    const updateStatus = () => {
        const timeString = lastMemorySave ? lastMemorySave.toLocaleString() : 'Soha';
        statusText.innerHTML = `
            Utolsó mentés: <strong>${timeString}</strong><br>
            Állapot: <strong>${memorySaveState}</strong>
        `;
    };
    
    container.querySelector('#save-memory-button')?.addEventListener('click', () => {
        // Simulate POST /memory/save
        lastMemorySave = new Date();
        memorySaveState = 'Elmentve ✅';
        localStorage.setItem('brunella_memory_snapshot', JSON.stringify({ savedAt: lastMemorySave }));
        alert('Memória elmentve (szimulált)');
        updateStatus();
    });

    container.querySelector('#restore-memory-button')?.addEventListener('click', () => {
        // Simulate GET /memory/restore
        const savedData = localStorage.getItem('brunella_memory_snapshot');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            lastMemorySave = new Date(parsed.savedAt);
            memorySaveState = 'Elmentve ✅';
            alert(`Memória visszaállítva a ${lastMemorySave.toLocaleString()} állapotra.`);
        } else {
            alert('Nincs mentett memória, amit vissza lehetne állítani.');
        }
        updateStatus();
    });

    // Initial load from localStorage
    const savedData = localStorage.getItem('brunella_memory_snapshot');
    if (savedData) {
        lastMemorySave = new Date(JSON.parse(savedData).savedAt);
        memorySaveState = 'Elmentve ✅';
    }
    updateStatus();
}

function createQuickActionsWidget(container: HTMLElement) {
    container.innerHTML = '<h3>⚡ Gyorsműveletek</h3>';
    
    const actions = [
        { 
            text: 'Összegzés', 
            handler: async () => {
                alert('Memória összegzése... Ez eltarthat egy ideig.');
                setAppBusy(true);
                try {
                    const memoryResponse = await fetch('./brunella_memoria.md');
                    const memoryText = await memoryResponse.text();
                    const command = `Készíts egy tömör, kulcsszavas összefoglalót a következő szövegről:\n\n${memoryText}`;
                    
                    const response = await chat.sendMessage({ message: command });
                    alert(`Memória Összefoglaló:\n\n${response.text}`);
                } catch (e) {
                    console.error("Összegzési hiba:", e);
                    alert("Hiba történt az összegzés során.");
                } finally {
                    setAppBusy(false);
                }
            }
        },
        { 
            text: 'Frissítés', 
            handler: () => {
                window.location.reload();
            } 
        },
        { 
            text: 'Session törlés', 
            handler: () => {
                if (confirm('Biztosan törlöd a folyamatlistát és visszaállítod az ügynököket?')) {
                    processes = [];
                    Object.values(agents).forEach(agent => agent.status = 'Szabad');
                    updateMonitoringWidgets();
                    alert('Munkamenet törölve.');
                }
            }
        }
    ];

    actions.forEach(action => {
        const button = document.createElement('button');
        button.textContent = action.text;
        button.className = 'action-button';
        button.addEventListener('click', action.handler);
        container.appendChild(button);
    });
}

function createAgentLaunchWidget(): HTMLElement {
    const widget = document.createElement('div');
    widget.className = 'tool-widget';
    widget.innerHTML = `
        <h3>🤖 Ügynök Indítás</h3>
        <div class="agent-launch-form">
            <label for="agent-select">Válassz ügynököt:</label>
            <select id="agent-select">
                ${Object.entries(agents).map(([key, agent]) => `<option value="${key}">${agent.name}</option>`).join('')}
            </select>
            <label for="task-input">Feladat:</label>
            <textarea id="task-input" rows="4" placeholder="Írd le a feladatot..."></textarea>
            <button id="launch-agent-button" class="action-button">▶ Indítás</button>
        </div>
    `;
    
    widget.querySelector('#launch-agent-button')?.addEventListener('click', () => {
        const agentSelect = widget.querySelector('#agent-select') as HTMLSelectElement;
        const taskInput = widget.querySelector('#task-input') as HTMLTextAreaElement;
        const agentKey = agentSelect.value;
        const task = taskInput.value.trim();

        if (task) {
            runAgentTask(agentKey, task);
            taskInput.value = '';
        } else {
            alert('Kérlek, adj meg egy feladatot.');
        }
    });

    return widget;
}

function createProcessListWidget(): HTMLElement {
    const widget = document.createElement('div');
    widget.className = 'tool-widget';
    widget.innerHTML = `
        <h3>📊 Állapotfigyelő</h3>
        <h4>Folyamatok</h4>
        <ul id="process-list"></ul>
    `;
    return widget;
}

function createAgentStatusWidget(): HTMLElement {
    const widget = document.createElement('div');
    widget.className = 'tool-widget';
    widget.innerHTML = `
        <h4>Ügynökök Státusza</h4>
        <div id="agent-status-list"></div>
    `;
    return widget;
}

function createPlaceholderWidget(title: string, content: string): HTMLElement {
    const widget = document.createElement('div');
    widget.className = 'tool-widget';
    widget.innerHTML = `
        ${title ? `<h3>${title}</h3>` : ''}
        <p>${content}</p>
    `;
    return widget;
}

// --- UI UPDATE FUNCTIONS ---

function updateMonitoringWidgets() {
    const processList = document.getElementById('process-list') as HTMLUListElement | null;
    if (!processList) return;

    processList.innerHTML = processes.slice(0, 5).map(p => `
        <li>
            <span class="status-dot status-${p.status === 'Fut' ? 'running' : p.status === 'Siker' ? 'success' : 'error'}"></span>
            <strong>${p.agentName}:</strong> ${p.task.substring(0, 30)}...
            <em>(${p.status})</em>
        </li>
    `).join('');
    if (processes.length === 0) {
        processList.innerHTML = '<li>Nincsenek aktív folyamatok.</li>'
    }

    const agentStatusList = document.getElementById('agent-status-list') as HTMLDivElement | null;
    if (!agentStatusList) return;

    agentStatusList.innerHTML = Object.values(agents).map(agent => `
        <div class="agent-status-item">
            <span>${agent.name}</span>
            <span class="agent-status-value">
                <span class="status-dot status-${agent.status === 'Szabad' ? 'success' : 'running'}"></span>
                ${agent.status}
            </span>
        </div>
    `).join('');
}


// --- INITIALIZATION ---

function setupMemoryPanel() {
    const memoryManagementContainer = document.createElement('div');
    memoryManagementContainer.className = 'tool-widget';
    createMemoryManagementWidget(memoryManagementContainer);

    const quickActionsContainer = document.createElement('div');
    quickActionsContainer.className = 'tool-widget';
    createQuickActionsWidget(quickActionsContainer);
    
    memoryPanel.appendChild(memoryManagementContainer);
    memoryPanel.appendChild(quickActionsContainer);
}

function setupAgentPanel() {
    agentPanel.appendChild(createAgentLaunchWidget());
}

function setupMonitorPanel() {
    monitorPanel.appendChild(createProcessListWidget());
    monitorPanel.appendChild(createAgentStatusWidget());
    monitorPanel.appendChild(createPlaceholderWidget('⚙️ Rendszer Widgetek', 'Redis memória: 128 MB / 512 MB'));
    monitorPanel.appendChild(createPlaceholderWidget('', 'DB kapcsolat: Aktív'));
    updateMonitoringWidgets();
}

/**
 * Main function to initialize the application.
 */
function initializeApp() {
  setupMemoryPanel();
  setupAgentPanel();
  setupMonitorPanel();
}

// --- APP START ---
document.addEventListener('DOMContentLoaded', initializeApp);
