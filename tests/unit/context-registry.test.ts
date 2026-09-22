import { describe, expect, it } from "vitest";
import {
  resolveContact,
  resolveProject,
  suggestRegistryUpdate,
} from "../../src/services/context-registry.js";

const contacts = [
  {
    contactId: "contact_alex",
    name: "Alex Smith",
    emails: ["alex@example.com"],
    approvedAliases: ["Alex S."],
    active: true,
  },
  {
    contactId: "contact_alexa",
    name: "Alexa Smith",
    emails: ["alexa@example.com"],
    approvedAliases: [],
    active: true,
  },
];

describe("curated context registry", () => {
  it("resolves exact identifiers before approved aliases", () => {
    expect(
      resolveContact(contacts, { email: "ALEX@EXAMPLE.COM" }),
    ).toMatchObject({
      kind: "exact",
      contactId: "contact_alex",
    });
    expect(resolveContact(contacts, { name: "Alex S." })).toMatchObject({
      kind: "approved_alias",
      contactId: "contact_alex",
    });
  });

  it("leaves ambiguous or fuzzy context unresolved", () => {
    expect(resolveContact(contacts, { name: "Alex" })).toEqual({
      kind: "unresolved",
    });
    expect(
      resolveProject(
        [
          {
            projectId: "p1",
            name: "Spring Campaign",
            active: true,
            contactId: "contact_alex",
          },
          {
            projectId: "p2",
            name: "Summer Campaign",
            active: true,
            contactId: "contact_alex",
          },
        ],
        { name: "Campaign" },
        "contact_alex",
      ),
    ).toEqual({ kind: "unresolved" });
  });

  it("makes an unpersisted suggestion without adding an association", () => {
    expect(
      suggestRegistryUpdate({ email: "new@example.com", name: "New Person" }),
    ).toEqual({
      kind: "suggestion",
      proposedContact: { email: "new@example.com", name: "New Person" },
      persistence: "requires_manual_approval",
    });
  });
});
