import fs from "fs/promises";
import path from "path";

enum LogLevel {
  INFO = "INFO",
  ERROR = "ERROR",
  SUCCESS = "SUCCESS",
  WARNING = "WARNING",
}

export class Logger {
  private static readonly LOG_DIR = path.resolve(__dirname, "../../logs");
  private static readonly LOG_FILE = path.join(Logger.LOG_DIR, "allLogs.txt");

  static async clearLogs(): Promise<void> {
    try {
      await fs.mkdir(Logger.LOG_DIR, { recursive: true });
      await fs.unlink(Logger.LOG_FILE).catch(() => undefined);
      console.warn("[INFO] Logs cleared");
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  }

  private static async writeLog(
    level: LogLevel,
    message: string,
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const logMessage = `[${level}] ${timestamp} - ${message}\n`;

    console.warn(logMessage.trim());

    try {
      await fs.mkdir(Logger.LOG_DIR, { recursive: true });
      await fs.appendFile(Logger.LOG_FILE, logMessage, "utf-8");
    } catch (error) {
      console.error("Failed to write log:", error);
    }
  }

  static logInfo(message: string): void {
    void this.writeLog(LogLevel.INFO, message);
  }

  static logError(message: string): void {
    void this.writeLog(LogLevel.ERROR, message);
  }

  static logSuccess(message: string): void {
    void this.writeLog(LogLevel.SUCCESS, message);
  }

  static logWarning(message: string): void {
    void this.writeLog(LogLevel.WARNING, message);
  }

  static handleError(error: unknown, context: string): void {
    const errorMessage =
      error instanceof Error
        ? `${context} - ${error.message}${error.stack ? `\n${error.stack}` : ""}`
        : `${context} - ${String(error)}`;
    this.logError(errorMessage);
  }
}
