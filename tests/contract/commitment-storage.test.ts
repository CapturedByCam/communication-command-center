import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CommitmentRepository,
  commitmentFromStorageRow,
  commitmentToStorageRow,
  commitmentStorageToCommitment,
  type CommitmentStorageRecord,
} from "../../src/adapters/sheets/commitment-repository.js";
import { CommitmentStorageSchema } from "../../src/domain/commitment-schema.js";
import { FakeSheetTableAdapter } from "../helpers/fake-sheet-table.js";

const spreadsheetId = "synthetic-sheet";

const record: CommitmentStorageRecord = {
  commitment_id: "com_outbound_001",
  item_id: "cc_abcdefghijkl",
  source_thread_id: "thread-1",
  promise_text: "Send the approved estimate.",
  deadline_at: "2026-09-23T17:00:00-04:00",
  deadline_text: "tomorrow",
  status: "open",
  fulfilled_at: null,
  fulfillment_evidence_id: null,
  manual_override: false,
  updated_at: "2026-09-22T14:00:00-04:00",
  schema_version: "1.1",
  source_message_id: "outbound-message-1",
  source_evidence_id: "gmail:contact@elev8mediaky.com:outbound-message-1",
  observed_at: "2026-09-22T14:00:00-04:00",
  resolved_by: null,
  needs_date_review: false,
};

describe("Commitments storage 1.1", () => {
  it("strictly round-trips immutable outbound provenance and maps it to the briefing contract", () => {
    expect(
      JSON.parse(
        readFileSync(
          new URL(
            "../fixtures/commitments/outbound-promise-v1.1.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    ).toEqual(record);
    expect(CommitmentStorageSchema.parse(record)).toEqual(record);
    expect(
      commitmentStorageToCommitment(
        commitmentFromStorageRow(Object.keys(record), Object.values(record)),
      ),
    ).toMatchObject({
      commitmentId: record.commitment_id,
      sourceEvidenceId: record.source_evidence_id,
      observedAt: record.observed_at,
      resolvedBy: null,
    });
    expect(() =>
      CommitmentStorageSchema.parse({ ...record, private_body: "no" }),
    ).toThrow();
    expect(() =>
      CommitmentStorageSchema.parse({
        ...record,
        status: "fulfilled",
        fulfilled_at: record.updated_at,
      }),
    ).toThrow();
    expect(() =>
      CommitmentStorageSchema.parse({
        ...record,
        deadline_at: "2026-09-23T17:00:00+24:00",
      }),
    ).toThrow();
    expect(() =>
      CommitmentStorageSchema.parse({
        ...record,
        updated_at: "2026-09-22T13:59:00-04:00",
      }),
    ).toThrow();
  });

  it("suppresses exact evidence, rejects conflicting identities, and preserves manual or fulfilled records", async () => {
    const adapter = new FakeSheetTableAdapter();
    adapter.initializeManifest();
    const repository = new CommitmentRepository(adapter, spreadsheetId);

    await expect(repository.upsert(record)).resolves.toMatchObject({
      outcome: "created",
    });
    await expect(repository.upsert(record)).resolves.toMatchObject({
      outcome: "duplicate_suppressed",
    });
    await expect(
      repository.upsert({
        ...record,
        promise_text: "A later model interpretation must not replace this.",
        updated_at: "2026-09-22T14:05:00-04:00",
      }),
    ).resolves.toMatchObject({
      outcome: "duplicate_suppressed",
      record: { promise_text: record.promise_text },
    });
    await expect(
      repository.upsert({ ...record, commitment_id: "com_outbound_002" }),
    ).rejects.toThrow("conflicting immutable evidence");

    const manual = {
      ...record,
      manual_override: true,
      updated_at: "2026-09-22T14:05:00-04:00",
    } as const;
    const table = adapter.tables.get("Commitments")!;
    table.rows[0] = commitmentToStorageRow(table.headers, manual);
    await expect(
      repository.upsert({ ...record, promise_text: "Changed by provider." }),
    ).resolves.toMatchObject({ outcome: "manual_override_preserved" });
    await expect(repository.upsert(manual)).rejects.toThrow(
      "open and unmodified",
    );

    await expect(
      repository.resolve(record.commitment_id, {
        actor: "cam",
        resolvedAt: "2026-09-22T14:04:00-04:00",
      }),
    ).rejects.toThrow("Resolution cannot precede the latest update");

    const resolved = await repository.resolve(record.commitment_id, {
      actor: "cam",
      resolvedAt: "2026-09-22T15:00:00-04:00",
    });
    expect(resolved.record).toMatchObject({
      status: "fulfilled",
      resolved_by: "cam",
      fulfillment_evidence_id: null,
      manual_override: true,
    });
    const fulfilled = {
      ...record,
      commitment_id: "com_outbound_003",
      source_message_id: "outbound-message-3",
      source_evidence_id: "gmail:contact@elev8mediaky.com:outbound-message-3",
      status: "fulfilled",
      fulfilled_at: "2026-09-22T15:00:00-04:00",
      fulfillment_evidence_id: "inbound-message-3",
      updated_at: "2026-09-22T15:00:00-04:00",
    } as const;
    table.rows.push(commitmentToStorageRow(table.headers, fulfilled));
    await expect(
      repository.upsert({
        ...fulfilled,
        status: "open",
        fulfilled_at: null,
        fulfillment_evidence_id: null,
      }),
    ).resolves.toMatchObject({
      outcome: "fulfilled_preserved",
    });
  });
});
