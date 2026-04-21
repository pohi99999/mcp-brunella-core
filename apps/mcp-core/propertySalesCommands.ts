import { Command } from "commander";

export function registerPropertySalesCommands(program: Command): void {
  program
    .command("ingatlan-ertekesites")
    .description("🏢 Ingatlanértékesítési track és dashboard eszközök")
    .action(async () => {
      const { propertySalesCommand } = await import("./commands/property-sales-hu.js");
      await propertySalesCommand();
    });
}
