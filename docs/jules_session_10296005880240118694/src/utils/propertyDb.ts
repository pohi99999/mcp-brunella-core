import * as lancedb from "@lancedb/lancedb";
import { PropertyValuation, PropertyAsset } from "../types/property.js";
import { llmEmbeddings } from "./aiGateway.js";
import path from "path";
import fs from "fs/promises";
import { logInfo, logError } from "./logger.js";

const DB_PATH = "./data/brunella_lancedb";
const TABLE_NAME = "property_valuations";
const EMBEDDING_MODEL = "nomic-embed-text"; 

export class PropertyDb {
  private dbPath: string;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
  }

  private async getDb(): Promise<lancedb.Connection> {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true }).catch(() => {});
    return await lancedb.connect(this.dbPath);
  }

  async init(): Promise<void> {
    try {
        const db = await this.getDb();
        const tableNames = await db.tableNames();
        if (!tableNames.includes(TABLE_NAME)) {
        logInfo("PropertyDb", `Table ${TABLE_NAME} does not exist, will be created on first insert.`);
        }
    } catch (error) {
        logError("PropertyDb", `Failed to init: ${error}`);
    }
  }

  /**
   * Adds a property valuation to the database.
   * Generates an embedding for the valuation summary/description.
   */
  async addValuation(valuation: PropertyValuation, asset: PropertyAsset): Promise<void> {
    const db = await this.getDb();
    const tableNames = await db.tableNames();

    // Create a text representation for embedding
    const textToEmbed = `
      Property: ${asset.address}
      Type: ${asset.type}
      Condition: ${asset.condition}
      Valuation: ${valuation.estimatedValue} ${valuation.currency}
      Range: ${valuation.range.min} - ${valuation.range.max}
      Features: ${asset.features.map(f => `${f.name}: ${f.value}`).join(", ")}
      Market Analysis: ${valuation.marketAnalysis.trends.join(", ")}
    `.trim();

    const vector = await llmEmbeddings(textToEmbed, { model: EMBEDDING_MODEL });

    const record = {
      id: valuation.id,
      propertyId: valuation.propertyId,
      address: asset.address,
      type: asset.type,
      condition: asset.condition,
      estimatedValue: valuation.estimatedValue,
      valuationJson: JSON.stringify(valuation),
      assetJson: JSON.stringify(asset),
      text: textToEmbed,
      vector: vector,
      createdAt: new Date().toISOString(),
    };

    if (tableNames.includes(TABLE_NAME)) {
      const table = await db.openTable(TABLE_NAME);
      await table.add([record]);
    } else {
      await db.createTable(TABLE_NAME, [record]);
      logInfo("PropertyDb", `Created table ${TABLE_NAME}`);
    }
  }

  /**
   * Search valuations by semantic query (e.g. "modern apartments under 500k")
   */
  async searchValuations(query: string, limit = 5): Promise<Array<{ valuation: PropertyValuation, asset: PropertyAsset, score: number }>> {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return [];

    const table = await db.openTable(TABLE_NAME);
    const queryVector = await llmEmbeddings(query, { model: EMBEDDING_MODEL });

    const results = await table.vectorSearch(queryVector).limit(limit).toArray();

    return results.map((r: any) => ({
      valuation: JSON.parse(r.valuationJson),
      asset: JSON.parse(r.assetJson),
      score: r._distance,
    }));
  }

  async getAllValuations(): Promise<Array<{ valuation: PropertyValuation, asset: PropertyAsset }>> {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return [];

    const table = await db.openTable(TABLE_NAME);
    const results = await table.query().limit(1000).toArray();

    return results.map((r: any) => ({
      valuation: JSON.parse(r.valuationJson),
      asset: JSON.parse(r.assetJson),
    }));
  }
}

export const propertyDb = new PropertyDb();
