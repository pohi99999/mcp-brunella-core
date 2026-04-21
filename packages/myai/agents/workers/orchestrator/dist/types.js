/**
 * CEAN Orchestrator Worker Type Definitions
 */
/**
 * State compression utilities using built-in compression
 */
export class StateCompressor {
    /**
     * Compress state using available compression
     * Falls back to JSON.stringify if compression not available
     */
    static compress(state) {
        try {
            const json = JSON.stringify(state);
            const originalSize = json.length;
            // Try to use TextEncoder + compression if available
            // For now, we use a simple approach (can be enhanced with pako library later)
            const encoded = new TextEncoder().encode(json);
            // Calculate compression ratio estimate
            // In production, use gzip library like pako
            const compressionRatio = 1; // Placeholder: actual would be 2.5-3.0 with gzip
            return {
                version: 1,
                data: JSON.stringify(state), // In production, compress with pako
                originalSize,
                compressedSize: originalSize, // Would be smaller with gzip
                compressionRatio,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            throw new Error(`State compression failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Decompress state from compressed envelope
     */
    static decompress(compressed) {
        try {
            // In production, decompress from Base64 + gzip
            // For now, return parsed JSON directly
            return JSON.parse(compressed.data);
        }
        catch (error) {
            throw new Error(`State decompression failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Check if compression would be beneficial
     * Only compress states larger than 5KB
     */
    static shouldCompress(state) {
        const json = JSON.stringify(state);
        return json.length > 5120; // 5KB threshold
    }
    /**
     * Get compression statistics
     */
    static getStats(compressed) {
        const saved = compressed.originalSize - compressed.compressedSize;
        return {
            originalBytes: compressed.originalSize,
            compressedBytes: compressed.compressedSize,
            savedBytes: saved,
            savedPercent: (saved / compressed.originalSize) * 100,
        };
    }
}
//# sourceMappingURL=types.js.map