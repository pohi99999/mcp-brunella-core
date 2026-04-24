// packages/utils/events-shim.ts
// Browser-safe EventEmitter shim for Vite builds

export class EventEmitter {
  private listeners: Record<string, Function[]> = {};
  
  on(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
    return this;
  }
  
  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => {
        try { fn(...args); } catch (e) { console.error('Error in listener:', e); }
      });
    }
    return true;
  }
  
  removeListener(event: string, fn: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
    return this;
  }
  
  off(event: string, fn: Function) {
    return this.removeListener(event, fn);
  }
  
  once(event: string, fn: Function) {
    const wrapped = (...args: any[]) => {
      this.removeListener(event, wrapped);
      fn(...args);
    };
    this.on(event, wrapped);
    return this;
  }
  
  removeAllListeners() {
    this.listeners = {};
    return this;
  }
  
  setMaxListeners(n: number) {
    return this;
  }
}

export default { EventEmitter };
