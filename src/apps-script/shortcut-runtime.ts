import type {
  ShortcutStorage,
  ShortcutStorageRecord,
} from "../adapters/http/shortcut-handler.js";
import { CommunicationItemSchema } from "../domain/schemas.js";
import { assertHeaders, recordToRow } from "../adapters/sheets/sheet-table.js";
import { itemToRecord } from "../adapters/sheets/queue-repository.js";
import type { TableGateway } from "./sheet-adapter.js";

/** The canonical Queue source ID is the durable UUID ledger: no second mutable copy. */
export function createShortcutStorage(
  gateway: TableGateway,
  id: string,
): ShortcutStorage {
  const find = (key: string) => {
    const table = gateway.read(id, "Queue");
    const headers = assertHeaders("Queue", table.headers);
    const sourceIndex = headers.indexOf("source_thread_id"),
      idIndex = headers.indexOf("item_id");
    const matches = table.rows.filter(
      (row) => row[sourceIndex] === `shortcut:${key}`,
    );
    if (matches.length > 1) throw new Error("DUPLICATE_LEDGER");
    return matches[0] ? { itemId: String(matches[0][idIndex]) } : null;
  };
  return {
    createIfAbsent(
      record: ShortcutStorageRecord,
      stillAuthorized: () => boolean,
    ) {
      gateway.acquire();
      try {
        if (!stillAuthorized()) return "authorization_lost";
        if (find(record.idempotencyKey)) return "duplicate";
        const before = gateway.read(id, "Queue");
        const headers = assertHeaders("Queue", before.headers);
        const item = CommunicationItemSchema.parse(record.item);
        if (item.source_thread_id !== `shortcut:${record.idempotencyKey}`)
          throw new Error("SOURCE_MISMATCH");
        const after = {
          headers: [...before.headers],
          rows: [...before.rows, recordToRow(headers, itemToRecord(item))],
        };
        gateway.commit(id, [{ sheetName: "Queue", before, after }]);
        return "created";
      } finally {
        gateway.release();
      }
    },
    findByIdempotencyKey: find,
  };
}
