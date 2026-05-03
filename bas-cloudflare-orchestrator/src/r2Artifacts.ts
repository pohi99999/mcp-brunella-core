export class R2ArtifactManager {
  constructor(private readonly env: unknown) {}

  async storeArtifact(): Promise<{ success: true }> {
    void this.env;
    return { success: true };
  }
}
