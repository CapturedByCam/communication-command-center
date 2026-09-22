import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKBOOK_MANIFEST } from "../../src/adapters/sheets/workbook-manifest.js";
import { recordToRow } from "../../src/adapters/sheets/sheet-table.js";
import { readStudioContacts } from "../../src/apps-script/studio-native.js";
import type { TableGateway } from "../../src/apps-script/sheet-adapter.js";

afterEach(() => vi.unstubAllGlobals());

describe("Studio curated contact mapping", () => {
  it("retains exact RFC addresses and active status without inventing aliases", () => {
    const headers = [
      ...WORKBOOK_MANIFEST.find((sheet) => sheet.name === "Contacts")!.headers,
    ];
    const gateway: TableGateway = {
      acquire: vi.fn(),
      release: vi.fn(),
      commit: vi.fn(),
      read: vi.fn(() => ({
        headers,
        rows: [
          recordToRow(headers, {
            contact_id: "contact-1",
            name: "Known Person",
            email: "valid=tag@example.com",
            active: true,
          }),
        ],
      })),
    };
    expect(readStudioContacts(gateway, "book_abcdefghijklmnop")).toEqual([
      {
        contactId: "contact-1",
        name: "Known Person",
        emails: ["valid=tag@example.com"],
        approvedAliases: [],
        active: true,
      },
    ]);
    expect(gateway.commit).not.toHaveBeenCalled();
  });
});
