// Ambient declarations for packages without TypeScript type definitions
declare module 'marked-terminal' {
  import { Renderer } from 'marked';

  export default class TerminalRenderer extends Renderer {}
}
declare module 'python-shell';
