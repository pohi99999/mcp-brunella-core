/**
 * Track TODO Checkbox Parser
 *
 * Parses markdown checkbox items from track.md files
 * and provides functionality to toggle their state.
 */

export interface TrackTodoItem {
  id: string;         // stable identifier (line-index + hash)
  text: string;       // checkbox text content
  completed: boolean; // checkbox state
  lineNumber: number; // line number in file (1-indexed)
}

export interface TrackTodoView {
  trackId: string;
  trackTitle: string;
  status: string;
  todos: TrackTodoItem[];
  progress: number; // 0-100
}

/**
 * Parse markdown checkbox items from content
 */
export function parseTrackTodos(content: string, trackId: string): TrackTodoView {
  const lines = content.split('\n');
  const todos: TrackTodoItem[] = [];

  // Extract track title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const trackTitle = titleMatch ? titleMatch[1] : trackId;

  // Extract status
  const statusMatch = content.match(/\*\*Status:\*\*\s+(.+)$/m);
  const status = statusMatch ? statusMatch[1].trim() : 'unknown';

  // Parse checkbox items
  lines.forEach((line, index) => {
    const checkboxMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      const [, , state, text] = checkboxMatch;
      const lineNumber = index + 1;

      // Generate stable ID (line number + text hash for uniqueness)
      const id = `todo-${lineNumber}-${simpleHash(text)}`;

      todos.push({
        id,
        text: text.trim(),
        completed: state.toLowerCase() === 'x',
        lineNumber,
      });
    }
  });

  // Calculate progress
  const completedCount = todos.filter(t => t.completed).length;
  const progress = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  return {
    trackId,
    trackTitle,
    status,
    todos,
    progress,
  };
}

/**
 * Toggle checkbox state at specific line number
 */
export function toggleTodoInContent(content: string, lineNumber: number): string {
  const lines = content.split('\n');

  if (lineNumber < 1 || lineNumber > lines.length) {
    throw new Error(`Invalid line number: ${lineNumber}`);
  }

  const line = lines[lineNumber - 1];
  const checkboxMatch = line.match(/^(\s*-\s+\[)([ xX])(\]\s+.+)$/);

  if (!checkboxMatch) {
    throw new Error(`No checkbox found at line ${lineNumber}`);
  }

  const [, prefix, state, suffix] = checkboxMatch;
  const newState = state.toLowerCase() === 'x' ? ' ' : 'x';
  lines[lineNumber - 1] = `${prefix}${newState}${suffix}`;

  return lines.join('\n');
}

/**
 * Find TODO by ID and return line number
 */
export function findTodoLineNumber(content: string, todoId: string): number {
  const parsed = parseTrackTodos(content, '');
  const todo = parsed.todos.find(t => t.id === todoId);

  if (!todo) {
    throw new Error(`TODO not found: ${todoId}`);
  }

  return todo.lineNumber;
}

/**
 * Simple hash function for stable IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
