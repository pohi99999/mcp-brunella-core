import { Command } from "commander";

/**
 * Könyvelés Automatizálás CLI Regisztráció
 * Parancs: brunella bookkeeping
 */
export function registerBookkeepingCommands(program: Command): void {
  program
    .command("bookkeeping")
    .description("📊 Könyvelés automatizálás (Bank + NAV párosítás)")
    .action(async () => {
      const { bookkeepingCommand } = await import("./commands/bookkeeping-hu.js");
      await bookkeepingCommand();
    });
}
