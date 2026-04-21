import { Command } from "commander";
import { inventoryStatus, inventoryValuation, inventoryOrderReview, inventoryStocktake, inventoryForecast } from "./commands/inventory-hu.js";

export function registerInventoryCommands(program: Command): void {
  const inventory = program
    .command("inventory")
    .description("Autonóm Készlet- és Leltárkezelési Rendszer (KKV)");

  inventory
    .command("status")
    .description("Aktuális készlet állapotának és kritikus szintű termékek táblázatos megjelenítése")
    .action(async () => {
      await inventoryStatus();
    });

  inventory
    .command("valuation")
    .description("Helyzetelemzés: aktuális FIFO és WAC készletértékelés összesítése")
    .action(async () => {
      await inventoryValuation();
    });

  inventory
    .command("order-review")
    .description("Függő beszerzési rendelések (PO) listázása és interaktív jóváhagyása")
    .action(async () => {
      await inventoryOrderReview();
    });

  inventory
    .command("stocktake")
    .description("Fizikai leltárfelvétel indítása interaktív módon")
    .action(async () => {
      await inventoryStocktake();
    });

  inventory
    .command("forecast [sku]")
    .description("Kereslet-előrejelzés egy adott termékre (AI)")
    .action(async (sku: string | undefined) => {
      await inventoryForecast(sku);
    });
}
