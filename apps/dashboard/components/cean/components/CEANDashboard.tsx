import { useState } from 'react';
import { BarChart3, Zap, DollarSign, Settings, Beaker } from 'lucide-react';
import { OrchestratorMetrics } from './OrchestratorMetrics';
import { AgentStatusPanel } from './AgentStatusPanel';
import { CostTracker } from './CostTracker';
import LoadTestingDashboard from './LoadTestingDashboard';

type DashboardTab = 'metrics' | 'agents' | 'costs' | 'load-test' | 'settings';

/**
 * CEANDashboard Component
 * Integrated dashboard for CEAN Orchestrator monitoring
 *
 * Tabs:
 * - Metrics: Real-time task metrics and statistics
 * - Agents: Individual agent health and performance
 * - Costs: Cost tracking and optimization
 * - Settings: Dashboard configuration
 */
export const CEANDashboard = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('metrics');

  const tabs: Array<{
    id: DashboardTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'metrics',
      label: 'Mérőszámok',
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      id: 'agents',
      label: 'Ügynökök',
      icon: <Zap className="w-4 h-4" />,
    },
    {
      id: 'costs',
      label: 'Költségek',
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      id: 'load-test',
      label: 'Terhelési Teszt',
      icon: <Beaker className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Beállítások',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-950">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition
                  whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }
                `}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'metrics' && (
            <div className="animate-in fade-in-50 duration-200">
              <OrchestratorMetrics />
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="p-6 animate-in fade-in-50 duration-200">
              <AgentStatusPanel />
            </div>
          )}

          {activeTab === 'costs' && (
            <div className="p-6 animate-in fade-in-50 duration-200">
              <CostTracker />
            </div>
          )}

          {activeTab === 'load-test' && (
            <div className="p-6 animate-in fade-in-50 duration-200">
              <LoadTestingDashboard />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6 animate-in fade-in-50 duration-200">
              <SettingsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * SettingsPanel Component
 * Dashboard configuration options
 */
const SettingsPanel = () => {
  const [settings, setSettings] = useState({
    refreshInterval: 10,
    maxChartDataPoints: 100,
    darkMode: localStorage.getItem('theme') === 'dark',
    notifications: true,
    computeCostsLocally: false,
    estimatedCostPerInvocation: 0.0001,
  });

  const handleSettingChange = (key: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveSetting = (key: string) => {
    if (key === 'darkMode') {
      document.documentElement.classList.toggle('dark', settings.darkMode);
      localStorage.setItem('theme', settings.darkMode ? 'dark' : 'light');
    } else {
      localStorage.setItem(`cean_${key}`, String(settings[key as keyof typeof settings]));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Dashboard Beállítások
        </h2>
      </div>

      {/* Display Settings */}
      <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Megjelenítés
        </h3>

        <div className="space-y-4">
          {/* Refresh Interval */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Frissítési intervallum (másodperc)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Milyen gyakran frissüljenek a mérőszámok
              </p>
            </div>
            <input
              type="number"
              min="5"
              max="60"
              value={settings.refreshInterval}
              onChange={(e) =>
                handleSettingChange('refreshInterval', parseInt(e.target.value))
              }
              onBlur={() => saveSetting('refreshInterval')}
              className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Max Chart Points */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Max. diagram adatok
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximális adatpontok a diagramokon
              </p>
            </div>
            <input
              type="number"
              min="10"
              max="500"
              step="10"
              value={settings.maxChartDataPoints}
              onChange={(e) =>
                handleSettingChange(
                  'maxChartDataPoints',
                  parseInt(e.target.value)
                )
              }
              onBlur={() => saveSetting('maxChartDataPoints')}
              className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Dark Mode */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Sötét mód
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Sötét témás felhasználói felület
              </p>
            </div>
            <button
              onClick={() => {
                handleSettingChange('darkMode', !settings.darkMode);
                setTimeout(() => saveSetting('darkMode'), 0);
              }}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                settings.darkMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                  settings.darkMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Cost Settings */}
      <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Költség Beállítások
        </h3>

        <div className="space-y-4">
          {/* Estimated Cost Per Invocation */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Becsült költség/hívás (USD)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Cloudflare Worker hívás költsége
              </p>
            </div>
            <input
              type="number"
              min="0"
              step="0.00001"
              value={settings.estimatedCostPerInvocation}
              onChange={(e) =>
                handleSettingChange(
                  'estimatedCostPerInvocation',
                  parseFloat(e.target.value)
                )
              }
              onBlur={() => saveSetting('estimatedCostPerInvocation')}
              className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Local Cost Calculation */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Költségek helyi kiszámítása
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Költségek számítása az ügyfél oldalán
              </p>
            </div>
            <button
              onClick={() => {
                handleSettingChange(
                  'computeCostsLocally',
                  !settings.computeCostsLocally
                );
                setTimeout(() => saveSetting('computeCostsLocally'), 0);
              }}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                settings.computeCostsLocally
                  ? 'bg-blue-600'
                  : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                  settings.computeCostsLocally
                    ? 'translate-x-7'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Értesítések
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-white">
              Engedélyezze az értesítéseket
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Értesítések hibákról és riasztásokról
            </p>
          </div>
          <button
            onClick={() => {
              handleSettingChange('notifications', !settings.notifications);
              setTimeout(() => saveSetting('notifications'), 0);
            }}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
              settings.notifications ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                settings.notifications ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition font-medium">
          Mégsem
        </button>
        <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-medium">
          Mentés
        </button>
      </div>
    </div>
  );
};
