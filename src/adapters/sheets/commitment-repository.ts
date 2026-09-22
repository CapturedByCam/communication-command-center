import {
  CommitmentResolutionInputSchema,
  CommitmentStorageSchema,
  type CommitmentResolutionInput,
  type CommitmentStorageRecord,
} from "../../domain/commitment-schema.js";
import {
  assertHeaders,
  recordToRow,
  rowToRecord,
  type CellValue,
  type SheetTableAdapter,
} from "./sheet-table.js";

export { commitmentStorageToCommitment } from "../../domain/commitment-schema.js";
export type {
  CommitmentResolutionInput,
  CommitmentStorageRecord,
} from "../../domain/commitment-schema.js";

const sheetName = "Commitments";

export interface CommitmentStorageEntry {
  readonly record: CommitmentStorageRecord;
  readonly rowIndex: number;
  readonly expectedRow: readonly CellValue[];
}

export interface CommitmentStorageUpsertResult {
  readonly outcome:
    | "created"
    | "duplicate_suppressed"
    | "manual_override_preserved"
    | "fulfilled_preserved";
  readonly record: CommitmentStorageRecord;
}

export class CommitmentIdentityConflictError extends Error {
  constructor() {
    super("Commitment has conflicting immutable evidence.");
  }
}

function toRecord(
  commitment: CommitmentStorageRecord,
): Record<string, CellValue> {
  return commitment;
}

export function commitmentFromStorageRow(
  headers: readonly string[],
  row: readonly CellValue[],
): CommitmentStorageRecord {
  return CommitmentStorageSchema.parse(rowToRecord(headers, row));
}

export function commitmentToStorageRow(
  headers: readonly string[],
  commitment: CommitmentStorageRecord,
): CellValue[] {
  return recordToRow(
    headers,
    toRecord(CommitmentStorageSchema.parse(commitment)),
  );
}

function equalImmutableIdentity(
  left: CommitmentStorageRecord,
  right: CommitmentStorageRecord,
): boolean {
  return (
    left.commitment_id === right.commitment_id &&
    left.item_id === right.item_id &&
    left.source_thread_id === right.source_thread_id &&
    left.source_message_id === right.source_message_id &&
    left.source_evidence_id === right.source_evidence_id &&
    left.observed_at === right.observed_at
  );
}

export class CommitmentRepository {
  constructor(
    private readonly adapter: SheetTableAdapter,
    private readonly spreadsheetId: string,
  ) {}

  async runTransaction<T>(operation: () => Promise<T>): Promise<T> {
    return this.adapter.runTransaction(this.spreadsheetId, operation);
  }

  async verifyHeaders(): Promise<void> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    assertHeaders(sheetName, table.headers);
  }

  async list(): Promise<CommitmentStorageRecord[]> {
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    return table.rows.map((row) => commitmentFromStorageRow(headers, row));
  }

  async upsert(
    record: CommitmentStorageRecord,
  ): Promise<CommitmentStorageUpsertResult> {
    return this.runTransaction(() => this.upsertWithinTransaction(record));
  }

  /** Caller holds the shared transaction with source validation and audit persistence. */
  async upsertWithinTransaction(
    rawRecord: CommitmentStorageRecord,
  ): Promise<CommitmentStorageUpsertResult> {
    const record = CommitmentStorageSchema.parse(rawRecord);
    if (
      record.status !== "open" ||
      record.manual_override ||
      record.fulfilled_at !== null ||
      record.fulfillment_evidence_id !== null ||
      record.resolved_by !== null
    ) {
      throw new Error("Commitment observations must be open and unmodified.");
    }
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    const entries = table.rows.map((row, rowIndex) => ({
      record: commitmentFromStorageRow(headers, row),
      rowIndex,
      expectedRow: row,
    }));
    const sameId = entries.filter(
      (entry) => entry.record.commitment_id === record.commitment_id,
    );
    const sameEvidence = entries.filter(
      (entry) => entry.record.source_evidence_id === record.source_evidence_id,
    );

    if (sameId.length > 1 || sameEvidence.length > 1) {
      throw new CommitmentIdentityConflictError();
    }
    const existing = sameId[0] ?? sameEvidence[0];
    if (!existing) {
      await this.adapter.appendRow(
        this.spreadsheetId,
        sheetName,
        commitmentToStorageRow(headers, record),
      );
      return { outcome: "created", record };
    }
    if (!equalImmutableIdentity(existing.record, record)) {
      throw new CommitmentIdentityConflictError();
    }
    if (existing.record.manual_override) {
      return { outcome: "manual_override_preserved", record: existing.record };
    }
    if (existing.record.status === "fulfilled") {
      return { outcome: "fulfilled_preserved", record: existing.record };
    }
    return { outcome: "duplicate_suppressed", record: existing.record };
  }

  async resolve(
    commitmentId: string,
    resolution: CommitmentResolutionInput,
  ): Promise<{ readonly record: CommitmentStorageRecord }> {
    return this.runTransaction(() =>
      this.resolveWithinTransaction(commitmentId, resolution),
    );
  }

  /** Caller holds the shared transaction with source validation and audit persistence. */
  async resolveWithinTransaction(
    commitmentId: string,
    rawResolution: CommitmentResolutionInput,
  ): Promise<{ readonly record: CommitmentStorageRecord }> {
    const resolution = CommitmentResolutionInputSchema.parse(rawResolution);
    const table = await this.adapter.readTable(this.spreadsheetId, sheetName);
    const headers = assertHeaders(sheetName, table.headers);
    const matches = table.rows
      .map((row, rowIndex) => ({
        record: commitmentFromStorageRow(headers, row),
        rowIndex,
        expectedRow: row,
      }))
      .filter((entry) => entry.record.commitment_id === commitmentId);
    if (matches.length !== 1) throw new CommitmentIdentityConflictError();
    const existing = matches[0]!;
    if (existing.record.status === "fulfilled")
      return { record: existing.record };
    if (
      Date.parse(resolution.resolvedAt) < Date.parse(existing.record.updated_at)
    ) {
      throw new Error("Resolution cannot precede the latest update.");
    }
    const next = CommitmentStorageSchema.parse({
      ...existing.record,
      status: "fulfilled",
      fulfilled_at: resolution.resolvedAt,
      fulfillment_evidence_id: resolution.fulfillmentEvidenceId ?? null,
      manual_override: resolution.actor
        ? true
        : existing.record.manual_override,
      resolved_by: resolution.actor ?? null,
      updated_at: resolution.resolvedAt,
    });
    await this.adapter.updateRow(
      this.spreadsheetId,
      sheetName,
      existing.rowIndex,
      commitmentToStorageRow(headers, next),
      existing.expectedRow,
    );
    return { record: next };
  }
}
