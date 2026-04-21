/**
 * R2 Artifact Storage — Agent futási eredmények, logok, generált kód perzisztálása
 *
 * Struktúra: {R2_PREFIX}/{agentId}/{taskId}/{artifactType}/{filename}
 * Pl: Brunella-core/CoderAgent/task_123/code/main.ts
 *
 * @track cf_r2_artifact_storage_20260323
 */

import { safeJsonParse } from './utils/aiHelpers.js';

export interface ArtifactMetadata {
  agentId: string;
  taskId: string;
  artifactType: "code" | "log" | "screenshot" | "data" | "report" | "config";
  filename: string;
  contentType: string;
  size: number;
  createdAt: string;
  tags?: string[];
}

export interface ArtifactUploadResult {
  key: string;
  size: number;
  etag: string;
  url: string;
}

/**
 * R2 Artifact Manager — CRUD az agent artifact-okhoz
 */
export class R2ArtifactManager {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly prefix: string = "Brunella-core",
  ) {}

  /**
   * Build R2 key from metadata
   */
  private buildKey(meta: Pick<ArtifactMetadata, "agentId" | "taskId" | "artifactType" | "filename">): string {
    return `${this.prefix}/${meta.agentId}/${meta.taskId}/${meta.artifactType}/${meta.filename}`;
  }

  /**
   * Upload an artifact to R2
   */
  async upload(
    meta: Omit<ArtifactMetadata, "size" | "createdAt">,
    content: string | ArrayBuffer | ReadableStream,
  ): Promise<ArtifactUploadResult> {
    const key = this.buildKey(meta);
    const customMetadata: Record<string, string> = {
      agentId: meta.agentId,
      taskId: meta.taskId,
      artifactType: meta.artifactType,
      createdAt: new Date().toISOString(),
    };

    if (meta.tags?.length) {
      customMetadata.tags = JSON.stringify(meta.tags);
    }

    const result = await this.bucket.put(key, content, {
      httpMetadata: { contentType: meta.contentType },
      customMetadata,
    });

    return {
      key,
      size: result?.size || 0,
      etag: result?.etag || "",
      url: `r2://${key}`,
    };
  }

  /**
   * Download an artifact from R2
   */
  async download(key: string): Promise<{ content: ReadableStream | null; metadata: R2ObjectBody | null }> {
    const object = await this.bucket.get(key);
    if (!object) return { content: null, metadata: null };

    return {
      content: object.body,
      metadata: object,
    };
  }

  /**
   * List artifacts for a specific agent/task
   */
  async listArtifacts(
    agentId: string,
    taskId?: string,
    artifactType?: string,
  ): Promise<ArtifactMetadata[]> {
    let prefix = `${this.prefix}/${agentId}`;
    if (taskId) prefix += `/${taskId}`;
    if (artifactType) prefix += `/${artifactType}`;

    const listed = await this.bucket.list({ prefix, limit: 100 });

    return listed.objects.map((obj) => ({
      agentId: obj.customMetadata?.agentId || agentId,
      taskId: obj.customMetadata?.taskId || taskId || "unknown",
      artifactType: (obj.customMetadata?.artifactType as ArtifactMetadata["artifactType"]) || "data",
      filename: obj.key.split("/").pop() || "",
      contentType: obj.httpMetadata?.contentType || "application/octet-stream",
      size: obj.size,
      createdAt: obj.customMetadata?.createdAt || obj.uploaded.toISOString(),
      tags: obj.customMetadata?.tags ? safeJsonParse<string[]>(obj.customMetadata.tags, []) : undefined,
    }));
  }

  /**
   * Delete an artifact
   */
  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /**
   * Delete all artifacts for a task
   */
  async deleteTaskArtifacts(agentId: string, taskId: string): Promise<number> {
    const prefix = `${this.prefix}/${agentId}/${taskId}`;
    const listed = await this.bucket.list({ prefix });

    if (listed.objects.length === 0) return 0;

    const keys = listed.objects.map((obj) => obj.key);
    await this.bucket.delete(keys);
    return keys.length;
  }

  /**
   * Store agent execution log
   */
  async storeLog(
    agentId: string,
    taskId: string,
    logContent: string,
    filename?: string,
  ): Promise<ArtifactUploadResult> {
    return this.upload(
      {
        agentId,
        taskId,
        artifactType: "log",
        filename: filename || `${new Date().toISOString().replace(/[:.]/g, "-")}.log`,
        contentType: "text/plain",
        tags: ["auto-generated"],
      },
      logContent,
    );
  }

  /**
   * Store generated code
   */
  async storeCode(
    agentId: string,
    taskId: string,
    code: string,
    filename: string,
  ): Promise<ArtifactUploadResult> {
    const ext = filename.split(".").pop() || "txt";
    const contentTypes: Record<string, string> = {
      ts: "text/typescript",
      js: "text/javascript",
      py: "text/x-python",
      json: "application/json",
      md: "text/markdown",
      html: "text/html",
      css: "text/css",
    };

    return this.upload(
      {
        agentId,
        taskId,
        artifactType: "code",
        filename,
        contentType: contentTypes[ext] || "text/plain",
        tags: ["generated"],
      },
      code,
    );
  }

  /**
   * Get storage stats for an agent
   */
  async getStats(agentId: string): Promise<{ totalFiles: number; totalSize: number; byType: Record<string, number> }> {
    const prefix = `${this.prefix}/${agentId}`;
    const listed = await this.bucket.list({ prefix, limit: 1000 });

    const stats = {
      totalFiles: listed.objects.length,
      totalSize: 0,
      byType: {} as Record<string, number>,
    };

    for (const obj of listed.objects) {
      stats.totalSize += obj.size;
      const type = obj.customMetadata?.artifactType || "unknown";
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return stats;
  }
}
