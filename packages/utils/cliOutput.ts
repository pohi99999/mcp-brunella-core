import { format } from 'util';

export function writeLine(...values: unknown[]): void {
  console.info(format(...values));
}
