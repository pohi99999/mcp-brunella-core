import React, { createContext, useContext, useState, useEffect } from "react";

type ExperimentVariant = "A" | "B";

interface ExperimentContextType {
  layoutDensity: ExperimentVariant;
  aiResponseStyle: ExperimentVariant;
}

const ExperimentContext = createContext<ExperimentContextType | undefined>(undefined);

export const ExperimentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [variants, setVariants] = useState<ExperimentContextType>({
    layoutDensity: "A",
    aiResponseStyle: "A"
  });

  useEffect(() => {
    // Randomly assign variants if not already set
    const saved = localStorage.getItem("bas-experiments");
    if (saved) {
      setVariants(JSON.parse(saved));
    } else {
      const newVariants: ExperimentContextType = {
        layoutDensity: Math.random() > 0.5 ? "A" : "B",
        aiResponseStyle: Math.random() > 0.5 ? "A" : "B"
      };
      setVariants(newVariants);
      localStorage.setItem("bas-experiments", JSON.stringify(newVariants));
      console.info("BAS VCC Experiments Initialized:", newVariants);
    }
  }, []);

  return (
    <ExperimentContext.Provider value={variants}>
      {children}
    </ExperimentContext.Provider>
  );
};

export const useExperiments = () => {
  const context = useContext(ExperimentContext);
  if (!context) {
    throw new Error("useExperiments must be used within an ExperimentProvider");
  }
  return context;
};
