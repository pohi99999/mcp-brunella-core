import { Button } from '@radix-ui/react-button';
import { ChevronDown } from 'lucide-react';
import { CEANTabId } from './types.js';
import { CEAN_TABS } from './utils/constants.js';

interface CEANNavBarProps {
  activeTab: CEANTabId;
  onTabChange: (tab: CEANTabId) => void;
}

export const CEANNavBar = ({ activeTab, onTabChange }: CEANNavBarProps) => {
  const tabs: Array<{ id: CEANTabId; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Irányítópult', icon: '📊' },
    { id: 'workers', label: 'Workers', icon: '⚙️' },
    { id: 'tasks', label: 'Feladatok', icon: '📋' },
    { id: 'data', label: 'D1/R1 Adatok', icon: '💾' },
    { id: 'settings', label: 'Beállítások', icon: '⚙️' },
  ];

  return (
    <nav className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
      {/* Top Bar */}
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            CEAN Operations Center
          </h1>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700 dark:text-gray-300">Pohánka Péter</span>
          <button
            className="text-sm px-3 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            onClick={() => {
              // TODO: logout handler
            }}
          >
            Kijelentkezés
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="px-6 py-0 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
