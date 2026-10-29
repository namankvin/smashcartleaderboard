import { AsyncLocalStorage } from "node:async_hooks";
import { ClientSession, Db } from "mongodb";

declare global { var _arenaTransactionContext: AsyncLocalStorage<ClientSession> | undefined; }
export const arenaTransaction = globalThis._arenaTransactionContext ||= new AsyncLocalStorage<ClientSession>();

// Existing repository calls share the transaction that owns the arena mutation.
// This includes reads after inserting a guest, queue transfers and lap writes.
export function databaseInTransaction(db: Db): Db {
  const session = arenaTransaction.getStore();
  if (!session) return db;
  const optionPosition: Record<string, number> = { find: 1, findOne: 1, countDocuments: 1, insertOne: 1, insertMany: 1, deleteOne: 1, deleteMany: 1, updateOne: 2, updateMany: 2, replaceOne: 2, bulkWrite: 1 };
  return new Proxy(db, { get(target, property) {
    if (property === "collection") return (name: string) => {
      const collection = target.collection(name);
      return new Proxy(collection, { get(source, method) {
        const value = Reflect.get(source, method);
        if (typeof method === "string" && method in optionPosition) return (...args: unknown[]) => {
          const index = optionPosition[method];
          args[index] = { ...(args[index] as object || {}), session };
          return Reflect.apply(value, source, args);
        };
        return typeof value === "function" ? value.bind(source) : value;
      } });
    };
    const value = Reflect.get(target, property);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}
