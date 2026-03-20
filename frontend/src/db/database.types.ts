export type DbRunResult = {
  changes: number;
};

export interface DatabaseAdapter {
  execSync(sql: string): void;
  withTransactionSync(fn: () => void): void;
  runSync(sql: string, args?: unknown[]): DbRunResult;
  getFirstSync<T>(sql: string, args?: unknown[]): T | null;
  getAllSync<T>(sql: string, args?: unknown[]): T[];
}
