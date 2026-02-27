import { useSystemSignalStore } from "../store/systemSignalStore";
import { useShallow } from "zustand/react/shallow";
import { useSocket } from "../context/SocketContext";

export function useSystemSignal() {
  const { socket } = useSocket();
  
  // Return state and actions from the store, or specific derived values
  // useShallow is REQUIRED: without it, the selector returns a new object every render,
  // causing useSyncExternalStore (Zustand v5) to trigger an infinite re-render loop
  // ("Maximum update depth exceeded").
  return {
    ...useSystemSignalStore(useShallow((state) => ({
      isConnected: state.isConnected,
      logs: state.logs,
      agents: state.agents,
      chatter: state.chatter,
      robotkezPlan: state.robotkezPlan,
      robotkezSteps: state.robotkezSteps,
      tasks: state.tasks,
      taskStats: state.taskStats,
      healthStatus: state.healthStatus,
      developerMetrics: state.developerMetrics,
      error: state.error,
      isLoading: state.isLoading,
    }))),
    socket,
  };
}
  
