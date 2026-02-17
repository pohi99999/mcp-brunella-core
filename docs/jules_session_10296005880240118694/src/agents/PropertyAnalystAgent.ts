import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { globalPythonShell } from "../utils/pythonShell.js";
import { propertyDb } from "../utils/propertyDb.js";
import { PropertyAsset, PropertyValuation, PropertyType, PropertyCondition } from "../types/property.js";
import { randomUUID } from "crypto";

export class PropertyAnalystAgent extends BaseAgent {
  name = "PropertyAnalystAgent";
  description = "Analyzes property images and documents to extract features and estimate value.";
  role = "Real Estate Analyst";
  capabilities = ["vision", "ocr", "property-analysis", "valuation"];

  async initialize(): Promise<void> {
    await propertyDb.init();
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task || "";
    
    // 1. Extract Image Source
    const imageSource = this.extractImageSource(task, context);
    if (!imageSource) {
      return {
        success: false,
        message: "No image source found in task or context.",
      };
    }

    // 2. Call Vision Worker
    try {
      const analysis = await this.analyzeImage(imageSource);
      
      if (analysis.error) {
        return {
          success: false,
          message: `Vision analysis failed: ${analysis.error}`,
        };
      }

      // 3. Process and Save Data
      const { asset, valuation } = this.mapAnalysisToPropertyData(analysis, imageSource);
      
      await propertyDb.addValuation(valuation, asset);

      return {
        success: true,
        message: `Property analysis complete. Estimated Value: ${valuation.estimatedValue} ${valuation.currency}.`,
        data: { asset, valuation },
        metadata: { source: imageSource }
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Error during property analysis: ${error.message}`,
      };
    }
  }

  private extractImageSource(task: string, context: AgentContext): string | null {
    // Check context first
    if (context.imageSource && typeof context.imageSource === 'string') {
      return context.imageSource;
    }
    
    // Regex for URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urlMatch = task.match(urlRegex);
    if (urlMatch) return urlMatch[0];

    // Regex for file path (simple)
    const tokens = task.split(/\s+/);
    for (const token of tokens) {
        if (token.match(/\.(jpg|jpeg|png|webp)$/i)) {
            // Remove quotes if present
            return token.replace(/^['"]|['"]$/g, '');
        }
    }

    return null;
  }

  private async analyzeImage(imageSource: string): Promise<any> {
    const prompt = `
    Analyze this real estate property image.
    Extract the following details:
    - Property Type (Apartment, House, Commercial, etc.)
    - Condition (New, Excellent, Good, Fair, Poor, Renovation Required)
    - Key Features (list with name and value)
    - Estimated Value range (min, max, average) in USD (or likely currency based on context/location if visible)
    - Detailed market analysis (trends, demand, supply)
    
    Output structured JSON matching this schema:
    {
      "address": "inferred or 'Unknown Address'",
      "type": "...",
      "condition": "...",
      "features": [{"name": "...", "value": "..."}],
      "valuation": {
        "estimatedValue": number,
        "currency": "USD",
        "min": number,
        "max": number,
        "confidence": number (0-1),
        "methodology": "..."
      },
      "marketAnalysis": {
        "trends": ["..."],
        "demandLevel": "High/Medium/Low",
        "supplyLevel": "High/Medium/Low",
        "priceTrend": "Rising/Stable/Falling"
      }
    }
    `;

    const pythonCode = `
import sys
import json
import os

try:
    from myai.core.vision_worker import GeminiVisionWorker
except ImportError:
    sys.path.append(os.getcwd())
    try:
        from myai.core.vision_worker import GeminiVisionWorker
    except ImportError:
        print(json.dumps({"error": "Could not import GeminiVisionWorker"}))
        sys.exit(0)

# context is injected by PythonShell wrapper
image_source = context.get('imageSource')
prompt = context.get('prompt')

if not image_source:
    print(json.dumps({"error": "No image source provided in context"}))
    sys.exit(0)

worker = GeminiVisionWorker()
if not worker.model:
    print(json.dumps({"error": "Gemini API Key not found"}))
    sys.exit(0)

result = worker.analyze_image(image_source, prompt)
print(json.dumps(result))
    `;

    // Pass inputs safely via context object instead of string interpolation
    const output = await globalPythonShell.run(pythonCode, { imageSource, prompt });
    
    try {
        return JSON.parse(output);
    } catch (e) {
        throw new Error(`Failed to parse Python output: ${output}`);
    }
  }

  private mapAnalysisToPropertyData(analysis: any, imageSource: string): { asset: PropertyAsset, valuation: PropertyValuation } {
    const assetId = randomUUID();
    const valuationId = randomUUID();
    const now = new Date().toISOString();

    const type: PropertyType = (["Apartment", "House", "Commercial", "Land", "Industrial", "Other"].includes(analysis.type) ? analysis.type : "Other") as PropertyType;
    const condition: PropertyCondition = (["New", "Excellent", "Good", "Fair", "Poor", "Renovation Required"].includes(analysis.condition) ? analysis.condition : "Good") as PropertyCondition;

    const asset: PropertyAsset = {
      id: assetId,
      address: analysis.address || "Unknown Address",
      type: type,
      condition: condition,
      features: analysis.features || [],
      images: [imageSource],
      createdAt: now,
      updatedAt: now,
      metadata: { source: "GeminiVision" }
    };

    const valData = analysis.valuation || {};
    const valuation: PropertyValuation = {
      id: valuationId,
      propertyId: assetId,
      valuationDate: now,
      estimatedValue: valData.estimatedValue || 0,
      currency: valData.currency || "USD",
      confidenceScore: valData.confidence || 0.5,
      range: {
        min: valData.min || 0,
        max: valData.max || 0
      },
      comparables: [],
      marketAnalysis: analysis.marketAnalysis || { trends: [], demandLevel: "Medium", supplyLevel: "Medium", priceTrend: "Stable" },
      methodology: valData.methodology || "AI Estimate",
      notes: "Generated by PropertyAnalystAgent via Gemini Vision"
    };

    return { asset, valuation };
  }
}
