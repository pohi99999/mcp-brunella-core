/**
 * Hooks pipeline – Gemini-style: BeforeTool, AfterTool, SessionStart, SessionEnd, etc.
 * Hooks are registered by name; runHooks(name, context) runs enabled handlers.
 * Enable/disable via config hooksConfig.enabled and hooksConfig.disabled.
 */
export type HookName =
  | 'BeforeTool'
  | 'AfterTool'
  | 'BeforeAgent'
  | 'AfterAgent'
  | 'Notification'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreCompress'
  | 'BeforeModel'
  | 'AfterModel'
  | 'BeforeToolSelection';

export type HookHandler<T = unknown> = (context: T) => void | Promise<void>;

const registry = new Map<HookName, HookHandler[]>();

export function registerHook(name: HookName, handler: HookHandler): void {
  const list = registry.get(name) ?? [];
  list.push(handler);
  registry.set(name, list);
}

export function listHooks(): Array<{ name: HookName; count: number }> {
  return Array.from(registry.entries()).map(([name, list]) => ({ name, count: list.length }));
}

/** Run all handlers for a hook. disabledNames: from config hooksConfig.disabled. */
export async function runHooks(
  name: HookName,
  context: unknown,
  options: { disabled?: string[]; enabled?: boolean } = {}
): Promise<void> {
  if (options.enabled === false) return;
  const disabled = new Set(options.disabled ?? []);
  if (disabled.has(name)) return;
  const list = registry.get(name) ?? [];
  for (const h of list) {
    try {
      await h(context);
    } catch (_) {
      /* log and continue */
    }
  }
}

export function clearHooks(name?: HookName): void {
  if (name) registry.delete(name);
  else registry.clear();
}
