"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg">A</div>
          <h1 className="text-xl font-semibold">Igényfelmérő Ügynök - Atlas</h1>
        </div>
        <div className="text-sm text-slate-400">Sólyom Daru Kft. Projekt</div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-4 text-blue-800">Üdvözöllek, Gábor!</h2>
        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          Én vagyok <strong>Atlas</strong>, az AI stratégiai tanácsadód. <br />
          Azért vagyok itt, hogy a következő napokban segítsek felmérni a vállalkozásod folyamatait,
          és megtaláljuk azokat a pontokat, ahol az automatizáció a legtöbbet segíthet.
        </p>
        
        <div className="bg-white p-6 rounded-lg shadow-lg border border-slate-200 w-full max-w-2xl text-left">
          <h3 className="font-semibold text-slate-800 mb-2">Miről fogunk beszélgetni?</h3>
          <ul className="list-disc list-inside text-slate-600 space-y-2">
            <li><strong>1. Nap:</strong> Áttekintjük a cég működését és a kulcsembereket.</li>
            <li><strong>2. Nap:</strong> Megkeressük a "fájdalompontokat" és a favágó munkákat.</li>
            <li><strong>3. Nap:</strong> Megtervezzük a jövőt és a digitális fejlesztéseket.</li>
          </ul>
        </div>

        <p className="mt-8 text-slate-500 text-sm">
          Kezdjük el a beszélgetést a jobb oldali sávban! 👉
        </p>
      </main>

      <CopilotSidebar
        labels={{
          initial: "Sziia! Miben segíthetek ma?",
          title: "Atlas AI Asszisztens",
          placeholder: "Írj egy üzenetet...",
          error: "Hiba történt. Kérlek próbáld újra.",
        }}
        defaultOpen={true}
        clickOutsideToClose={false}
      />
    </div>
  );
}
