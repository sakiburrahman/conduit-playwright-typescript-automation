import * as fs from "fs/promises";
import * as path from "path";

import { Logger } from "./logger";

export class StorageStateHelper {
  private static readonly AUTH_DIR = path.join(
    process.cwd(),
    "playwright",
    ".auth",
  );
  private static readonly PLAYWRIGHT_DIR = path.join(
    process.cwd(),
    "playwright",
  );
  private static readonly AUTH_FILE = "auth.json";
  private static readonly ENV_MARKER_FILE = "env-marker.txt";

  static getAuthFilePath(): string {
    return path.join(this.AUTH_DIR, this.AUTH_FILE);
  }

  static getEnvMarkerFilePath(): string {
    return path.join(this.AUTH_DIR, this.ENV_MARKER_FILE);
  }

  static async ensureAuthDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.AUTH_DIR, { recursive: true });
      Logger.logInfo(`Auth directory ensured: ${this.AUTH_DIR}`);
    } catch (error) {
      const errorMessage = "Failed to create auth directory";
      Logger.handleError(error, errorMessage);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  static async updateEnvMarker(environment: string): Promise<void> {
    try {
      await this.ensureAuthDirectoryExists();

      const envMarkerPath = this.getEnvMarkerFilePath();
      await fs.writeFile(envMarkerPath, environment, "utf-8");
      Logger.logInfo(`Updated environment marker to: ${environment}`);
    } catch (error) {
      const errorMessage = "Failed to update environment marker";
      Logger.handleError(error, errorMessage);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  static async deleteAuthFile(): Promise<void> {
    try {
      try {
        const stats = await fs.stat(this.PLAYWRIGHT_DIR);
        if (stats.isDirectory()) {
          await fs.rm(this.PLAYWRIGHT_DIR, { recursive: true, force: true });
          Logger.logInfo(
            `Deleted playwright folder and all contents: ${this.PLAYWRIGHT_DIR}`,
          );
        }
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          Logger.logInfo("Playwright folder does not exist, skipping deletion");
        } else {
          throw error;
        }
      }
    } catch (error) {
      const errorMessage = "Failed to delete playwright folder";
      Logger.handleError(error, errorMessage);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  static async cleanupRuntimeAuthArtifacts(): Promise<void> {
    const files = [
      this.getAuthFilePath(),
      this.getEnvMarkerFilePath(),
      path.join(this.AUTH_DIR, "generated-user.json"),
    ];

    for (const filePath of files) {
      try {
        await fs.unlink(filePath);
        Logger.logInfo(
          `Removed runtime auth artifact: ${path.basename(filePath)}`,
        );
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          continue;
        }
        throw error;
      }
    }
  }
}
