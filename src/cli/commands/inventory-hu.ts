/**
 * inventory-hu.ts — Magyar nyelvű, interaktív Inventory menürendszer és CLI műveletek
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import {
  getAllItems,
  getValuationSummary,
  getPendingPurchaseOrders,
  updatePurchaseOrderStatus,
  createStocktake
} from '../../utils/inventoryDb.js';
import { DemandForecastAgent, type DemandForecastTask } from '../../agents/DemandForecastAgent.js';
import { writeLine } from '../../utils/cliOutput.js';

export async function inventoryStatus(): Promise<void> {
  const spinner = ora('Készletadatok betöltése...').start();
  try {
    const items = await getAllItems();
    spinner.stop();

    if (items.length === 0) {
      writeLine(chalk.yellow('Nincs megjeleníthető termék az adatbázisban.'));
      return;
    }

    writeLine(
      boxen(chalk.blue.bold('📦 Aktuális Készlet Állapot'), {
        padding: 1,
        borderColor: 'cyan',
        borderStyle: 'round'
      })
    );

    writeLine(
      chalk.bold.gray('SKU'.padEnd(15)) +
      chalk.bold.gray('NÉV'.padEnd(30)) +
      chalk.bold.gray('KÉSZLET'.padEnd(15)) +
      chalk.bold.gray('ROP (Min)'.padEnd(15)) +
      chalk.bold.gray('ÉRTÉKELÉS'.padEnd(10))
    );
    writeLine(chalk.gray('-'.repeat(85)));

    items.forEach(item => {
      const stockStr = `${item.current_stock} ${item.unit}`;
      const critStr = `${item.reorder_point} ${item.unit}`;
      
      let stockColor = chalk.green;
      if (item.current_stock <= item.min_stock) stockColor = chalk.red.bold;
      else if (item.current_stock <= item.reorder_point) stockColor = chalk.yellow;

      writeLine(
        chalk.cyan(item.sku.padEnd(15)) +
        chalk.white(item.name.substring(0, 28).padEnd(30)) +
        stockColor(stockStr.padEnd(15)) +
        chalk.gray(critStr.padEnd(15)) +
        chalk.magenta(item.valuation_method.padEnd(10))
      );
    });
    writeLine('\n');
  } catch (error) {
    spinner.fail(chalk.red('Hiba a készlet lekérdezésekor.'));
    console.error(error);
  }
}

export async function inventoryValuation(): Promise<void> {
  const spinner = ora('Értékelési szummák betöltése...').start();
  try {
    const summary = await getValuationSummary();
    spinner.stop();

    if (summary.length === 0) {
      writeLine(chalk.yellow('Nincsenek értékelt termékek az adatbázisban.'));
      return;
    }

    writeLine(
      boxen(chalk.magenta.bold('📊 Készletértékelés Összesítő (ELÁBÉ / FIFO & WAC)'), {
        padding: 1,
        borderColor: 'magenta',
        borderStyle: 'round'
      })
    );

    writeLine(
      chalk.bold.gray('SKU'.padEnd(15)) +
      chalk.bold.gray('ÖSSZ DB'.padEnd(15)) +
      chalk.bold.gray('FIFO ÉRTÉK'.padEnd(20)) +
      chalk.bold.gray('WAC ÉRTÉK'.padEnd(20))
    );
    writeLine(chalk.gray('-'.repeat(70)));

    let totalFifo = 0;
    let totalWac = 0;

    summary.forEach(row => {
      totalFifo += row.fifo_stock_value;
      totalWac += row.wac_stock_value;
      writeLine(
        chalk.cyan(row.sku.padEnd(15)) +
        chalk.white(row.current_stock.toString().padEnd(15)) +
        chalk.green(`${row.fifo_stock_value.toLocaleString('hu-HU')} Ft`.padEnd(20)) +
        chalk.yellow(`${row.wac_stock_value.toLocaleString('hu-HU')} Ft`.padEnd(20))
      );
    });

    writeLine(chalk.gray('-'.repeat(70)));
    writeLine(
      chalk.bold.white('MINDÖSSZESEN:'.padEnd(30)) +
      chalk.bold.green(`${totalFifo.toLocaleString('hu-HU')} Ft (FIFO) / `) +
      chalk.bold.yellow(`${totalWac.toLocaleString('hu-HU')} Ft (WAC)`)
    );
    writeLine('\n');
  } catch (error) {
    spinner.fail(chalk.red('Hiba az értékelés lekérdezésekor.'));
    console.error(error);
  }
}

export async function inventoryOrderReview(): Promise<void> {
  const spinner = ora('Függő beszerzési rendelések keresése...').start();
  try {
    const pendingOrders = await getPendingPurchaseOrders();
    spinner.stop();

    if (pendingOrders.length === 0) {
      writeLine(chalk.green('Nincs jelenleg jóváhagyásra váró (függő) beszerzési rendelés.'));
      return;
    }

    writeLine(chalk.blue.bold(`\n📝 ${pendingOrders.length} db jóváhagyásra váró rendelés található.\n`));

    for (const order of pendingOrders) {
      writeLine(chalk.bgGray.black.bold(` RENDELÉS ID: ${order.id} | SKU: ${order.sku} `));
      writeLine(chalk.white(`Javasolt mennyiség: ${chalk.bold.green(order.order_qty)} dB`));
      writeLine(chalk.gray('--- Tervezett E-mail Szövege ---'));
      writeLine(chalk.italic.cyan(order.email_draft || 'Nincs email tartalom'));
      writeLine(chalk.gray('--------------------------------\n'));

      const { action } = await inquirer.prompt<{ action: string }>([
        {
          type: 'list',
          name: 'action',
          message: `Mi legyen a ${order.sku} rendelés sorsa?`,
          choices: [
            { name: '✅ Jóváhagyás (Elküldés a szállítónak)', value: 'APPROVED' },
            { name: '❌ Elutasítás (Törlés/Mentés draftként)', value: 'CANCELLED' },
            { name: '⏳ Későbbre hagyás (Ugrás a következőre)', value: 'SKIP' }
          ]
        }
      ]);

      if (action === 'APPROVED' || action === 'CANCELLED') {
        const updateSpinner = ora('Állapot frissítése...').start();
        await updatePurchaseOrderStatus(order.id, action as 'APPROVED' | 'CANCELLED', 'CLI (Human-in-Loop)');
        updateSpinner.succeed(chalk.green(`Rendelés státusza sikeresen frissítve erre: ${action}.`));
      } else {
        writeLine(chalk.yellow('Rendelés átugorva.'));
      }
      writeLine('\n');
    }
    writeLine(chalk.green.bold('Vége a rendelések listájának.'));
  } catch (error) {
    spinner.fail(chalk.red('Hiba a rendelések lekérdezésekor.'));
    console.error(error);
  }
}

export async function inventoryStocktake(): Promise<void> {
  writeLine(
    boxen(chalk.yellow.bold('🕵️ Interaktív Leltárfelvétel'), {
      padding: 1,
      borderColor: 'yellow',
      borderStyle: 'round'
    })
  );

  try {
    const items = await getAllItems();
    if (items.length === 0) {
      writeLine(chalk.red('Nincs termék az adatbázisban a leltározáshoz.'));
      return;
    }

    const { selectedSku } = await inquirer.prompt<{ selectedSku: string }>([
      {
        type: 'list',
        name: 'selectedSku',
        message: 'Válaszd ki a leltározandó terméket:',
        choices: items.map(i => ({ name: `${i.sku} - ${i.name} (Rendszer: ${i.current_stock} ${i.unit})`, value: i.sku }))
      }
    ]);

    const item = items.find(i => i.sku === selectedSku)!;

    const { physicalCount, location, countedBy } = await inquirer.prompt([
      {
        type: 'number',
        name: 'physicalCount',
        message: `Fizikai darabszám (Rendszer szerint: ${item.current_stock}):`,
        validate: (input: number) => !isNaN(input) && input >= 0 ? true : 'Kérlek adj meg egy érvényes >= 0 számot.'
      },
      {
        type: 'input',
        name: 'location',
        message: 'Leltár helyszíne (pl. Polc 3A):',
      },
      {
        type: 'input',
        name: 'countedBy',
        message: 'Leltározó azonosítója (neve):',
      }
    ]);

    const spinner = ora('Leltáreltérés rögzítése...').start();
    const discrepancy = physicalCount - item.current_stock;
    
    await createStocktake({
      item_id: item.id,
      physical_count: physicalCount,
      system_count: item.current_stock,
      discrepancy,
      location,
      counted_by: countedBy
    });

    spinner.succeed(chalk.green('Leltárfelvétel sikeresen elmentve.'));
    if (discrepancy !== 0) {
      writeLine(chalk.red.bold(`⚠️ Eltérés észlelve: ${discrepancy > 0 ? '+' : ''}${discrepancy} db.`));
      writeLine(chalk.gray('Megjegyzés: A "StocktakeReconciliationAgent" a háttérben/végponton kivizsgálhatja az okot.'));
    } else {
      writeLine(chalk.green.bold('Pipa! A fizikai és rendszerkészlet egyezik.'));
    }
  } catch (error) {
    console.error(chalk.red('Hiba a leltárfelvétel közben:'), error);
  }
}

export async function inventoryForecast(sku?: string): Promise<void> {
  let targetSku = sku;

  try {
    if (!targetSku) {
      const items = await getAllItems();
      if (items.length === 0) {
        writeLine(chalk.red('Nincs termék az adatbázisban az előrejelzéshez.'));
        return;
      }
      
      const { selectedSku } = await inquirer.prompt<{ selectedSku: string }>([
        {
          type: 'list',
          name: 'selectedSku',
          message: 'Melyik termékre kérsz AI Kereslet-előrejelzést (Forecast)?',
          choices: items.map(i => ({ name: `${i.sku} - ${i.name}`, value: i.sku }))
        }
      ]);
      targetSku = selectedSku;
    }

    const spinner = ora(`AI Előrejelzés (Forecast) készítése a(z) ${targetSku} termékre...`).start();
    
    const forecastAgent = new DemandForecastAgent();
    const taskObj: DemandForecastTask = { action: 'forecast', sku: targetSku };
    
    const response = await forecastAgent.execute(JSON.stringify(taskObj));
    
    if (response.status === 'success' && response.data) {
      spinner.succeed(chalk.green('Előrejelzés elkészült!'));
      
      const data = response.data as any; // The DemandForecastResult typing
      
      writeLine(
        boxen(chalk.magenta.bold('🔮 AI Kereslet-Előrejelzés / Forecast Summary'), {
          padding: 1,
          borderColor: 'magenta',
          borderStyle: 'round'
        })
      );
      
      writeLine(chalk.bold.white(`Termék: `) + chalk.cyan(`${data.sku} - ${data.name}`));
      writeLine(chalk.bold.white(`Trend és szezonalitás detektálva: `));
      writeLine(chalk.italic.gray(` ${data.trend_description}`));
      writeLine(chalk.bold.white(`Becsült várható kereslet (következő 30 nap): `) + chalk.yellow.bold(`${data.predicted_demand_30d} db`));
      writeLine(chalk.bold.white(`Ajánlott azonnali utánpótlás (rendelés): `) + chalk.green.bold(`${data.recommended_order_qty} db`));
      writeLine(chalk.bold.white(`AI Konfidencia Szint: `) + chalk.gray(`${(data.confidence * 100).toFixed(0)}%`));
      writeLine('\n');

    } else {
      spinner.fail(chalk.red('Hiba a forecast készítésekor.'));
      console.error(response.error);
    }
  } catch (error) {
    console.error(chalk.red('Váratlan hiba történt a forecast hívásakor:'), error);
  }
}
