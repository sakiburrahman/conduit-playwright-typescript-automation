import fs from "fs";
import path from "path";

import { Logger } from "./logger";

const HAR_DIR = path.resolve(process.cwd(), "har-recordings");

export class HarHelper {
  static clearHarRecordings(): void {
    try {
      if (!fs.existsSync(HAR_DIR)) {
        return;
      }

      const harFiles = fs
        .readdirSync(HAR_DIR)
        .filter((file) => file.endsWith(".har"));

      if (harFiles.length === 0) {
        return;
      }

      for (const file of harFiles) {
        try {
          fs.unlinkSync(path.join(HAR_DIR, file));
        } catch (error) {
          Logger.handleError(error, `Failed to delete HAR file: ${file}`);
        }
      }
    } catch (error) {
      Logger.handleError(error, "Failed to clear HAR folder");
      throw error instanceof Error
        ? error
        : new Error("Failed to clear HAR folder");
    }
  }
}
