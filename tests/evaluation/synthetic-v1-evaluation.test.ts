import { describe, expect, it } from "vitest";
import {
  classifyDraftRisk,
  type ClassifyDraftRiskInput,
} from "../../src/domain/risk.js";
import {
  deriveWaitingOn,
  type DeriveWaitingOnInput,
} from "../../src/domain/state-machine.js";
import type { DraftRisk, WaitingOn } from "../../src/domain/types.js";

interface SyntheticEvaluationCase {
  readonly id: string;
  /** Semantic labels only; this suite contains no message text or identifiers. */
  readonly communicationType:
    | "client_lead"
    | "active_project"
    | "aviation"
    | "business_admin"
    | "personal";
  readonly scenario: string;
  readonly chronology: DeriveWaitingOnInput;
  readonly expectedWaitingOn: WaitingOn;
  readonly draft: ClassifyDraftRiskInput;
  readonly expectedDraftRisk: DraftRisk;
}

const requiredInbound: DeriveWaitingOnInput = {
  latestMessage: { direction: "inbound", requiresResponse: true },
};

const examples: readonly SyntheticEvaluationCase[] = [
  {
    id: "SYN-01",
    communicationType: "client_lead",
    scenario: "latest inbound question",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-02",
    communicationType: "active_project",
    scenario: "latest inbound file request",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-03",
    communicationType: "business_admin",
    scenario: "latest outbound question",
    chronology: {
      latestMessage: { direction: "outbound", expectsResponse: true },
    },
    expectedWaitingOn: "them",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-04",
    communicationType: "active_project",
    scenario: "latest outbound follow-up",
    chronology: {
      latestMessage: { direction: "outbound", expectsResponse: true },
    },
    expectedWaitingOn: "them",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-05",
    communicationType: "personal",
    scenario: "inbound acknowledgement",
    chronology: {
      latestMessage: { direction: "inbound", isAcknowledgement: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "closed_acknowledgement",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-06",
    communicationType: "business_admin",
    scenario: "outbound acknowledgement",
    chronology: {
      latestMessage: { direction: "outbound", isAcknowledgement: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "closed_acknowledgement",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-07",
    communicationType: "business_admin",
    scenario: "inbound informational notice",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "information_only",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-08",
    communicationType: "active_project",
    scenario: "outbound informational update",
    chronology: {
      latestMessage: { direction: "outbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "information_only",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-09",
    communicationType: "aviation",
    scenario: "ambiguous chronology",
    chronology: { latestMessage: { direction: "inbound", isAmbiguous: true } },
    expectedWaitingOn: "unknown",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      modelUncertain: true,
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-10",
    communicationType: "personal",
    scenario: "no meaningful message",
    chronology: {},
    expectedWaitingOn: "unknown",
    draft: { knownContact: false, directResponseRequested: true },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-11",
    communicationType: "active_project",
    scenario: "overdue Cam promise after acknowledgement",
    chronology: {
      hasOverdueUnresolvedPromise: true,
      latestMessage: { direction: "inbound", isAcknowledgement: true },
    },
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-12",
    communicationType: "client_lead",
    scenario: "overdue Cam promise after informational reply",
    chronology: {
      hasOverdueUnresolvedPromise: true,
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-13",
    communicationType: "business_admin",
    scenario: "manual waiting-on-them override",
    chronology: {
      manualOverride: "them",
      latestMessage: { direction: "inbound", requiresResponse: true },
    },
    expectedWaitingOn: "them",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-14",
    communicationType: "personal",
    scenario: "manual none override over overdue promise",
    chronology: { manualOverride: "none", hasOverdueUnresolvedPromise: true },
    expectedWaitingOn: "none",
    draft: { knownContact: true, directResponseRequested: false },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-15",
    communicationType: "aviation",
    scenario: "manual unknown override",
    chronology: {
      manualOverride: "unknown",
      latestMessage: { direction: "outbound", expectsResponse: true },
    },
    expectedWaitingOn: "unknown",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      modelUncertain: true,
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-16",
    communicationType: "client_lead",
    scenario: "inbound with no response signal",
    chronology: { latestMessage: { direction: "inbound" } },
    expectedWaitingOn: "none",
    draft: { knownContact: true, directResponseRequested: false },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-17",
    communicationType: "active_project",
    scenario: "outbound with no expected response",
    chronology: { latestMessage: { direction: "outbound" } },
    expectedWaitingOn: "none",
    draft: { knownContact: true, directResponseRequested: false },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-18",
    communicationType: "business_admin",
    scenario: "acknowledgement takes precedence over inbound response flag",
    chronology: {
      latestMessage: {
        direction: "inbound",
        requiresResponse: true,
        isAcknowledgement: true,
      },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "closed_acknowledgement",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-19",
    communicationType: "active_project",
    scenario: "informational status takes precedence over outbound expectation",
    chronology: {
      latestMessage: {
        direction: "outbound",
        expectsResponse: true,
        isInformational: true,
      },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "information_only",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-20",
    communicationType: "active_project",
    scenario: "overdue promise takes precedence over ambiguity",
    chronology: {
      hasOverdueUnresolvedPromise: true,
      latestMessage: { direction: "inbound", isAmbiguous: true },
    },
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-21",
    communicationType: "client_lead",
    scenario: "routine known-contact response",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-22",
    communicationType: "active_project",
    scenario: "routine project response",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-23",
    communicationType: "aviation",
    scenario: "routine non-employment response",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-24",
    communicationType: "business_admin",
    scenario: "routine administrative response",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-25",
    communicationType: "personal",
    scenario: "routine personal response",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-26",
    communicationType: "client_lead",
    scenario: "unknown contact",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: false, directResponseRequested: true },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-27",
    communicationType: "active_project",
    scenario: "uncertain model interpretation",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      modelUncertain: true,
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-28",
    communicationType: "client_lead",
    scenario: "pricing discussion",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["pricing"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-29",
    communicationType: "client_lead",
    scenario: "negotiation",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["negotiation"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-30",
    communicationType: "active_project",
    scenario: "complaint",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["complaint"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-31",
    communicationType: "active_project",
    scenario: "scope dispute",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["scope_dispute"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-32",
    communicationType: "business_admin",
    scenario: "contract",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["contract"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-33",
    communicationType: "business_admin",
    scenario: "payment",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["payment"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-34",
    communicationType: "business_admin",
    scenario: "refund",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["refund"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-35",
    communicationType: "business_admin",
    scenario: "legal issue",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["legal"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-36",
    communicationType: "aviation",
    scenario: "aviation employment",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["aviation_employment"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-37",
    communicationType: "active_project",
    scenario: "external schedule commitment",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["external_schedule_commitment"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-38",
    communicationType: "personal",
    scenario: "sensitive personal topic",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["sensitive_personal"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-39",
    communicationType: "business_admin",
    scenario: "receipt",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "receipt",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-40",
    communicationType: "business_admin",
    scenario: "newsletter",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "newsletter",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-41",
    communicationType: "business_admin",
    scenario: "automated notice",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "automated_notice",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-42",
    communicationType: "personal",
    scenario: "spam",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "spam",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-43",
    communicationType: "personal",
    scenario: "closed acknowledgement",
    chronology: {
      latestMessage: { direction: "inbound", isAcknowledgement: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "closed_acknowledgement",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-44",
    communicationType: "business_admin",
    scenario: "information-only message",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "information_only",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-45",
    communicationType: "client_lead",
    scenario: "no direct response requested",
    chronology: {
      latestMessage: { direction: "inbound", isInformational: true },
    },
    expectedWaitingOn: "none",
    draft: { knownContact: true, directResponseRequested: false },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-46",
    communicationType: "active_project",
    scenario: "pricing and schedule consequence",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["pricing", "external_schedule_commitment"],
    },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-47",
    communicationType: "active_project",
    scenario: "ordinary promise follow-up",
    chronology: {
      hasOverdueUnresolvedPromise: true,
      latestMessage: { direction: "outbound", expectsResponse: true },
    },
    expectedWaitingOn: "me",
    draft: { knownContact: true, directResponseRequested: true },
    expectedDraftRisk: "routine",
  },
  {
    id: "SYN-48",
    communicationType: "active_project",
    scenario: "unknown contact project question",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: { knownContact: false, directResponseRequested: true },
    expectedDraftRisk: "review_only",
  },
  {
    id: "SYN-49",
    communicationType: "client_lead",
    scenario: "lead acknowledgement",
    chronology: {
      latestMessage: { direction: "inbound", isAcknowledgement: true },
    },
    expectedWaitingOn: "none",
    draft: {
      knownContact: true,
      directResponseRequested: false,
      messageKind: "closed_acknowledgement",
    },
    expectedDraftRisk: "no_draft",
  },
  {
    id: "SYN-50",
    communicationType: "aviation",
    scenario: "aviation scheduling commitment",
    chronology: requiredInbound,
    expectedWaitingOn: "me",
    draft: {
      knownContact: true,
      directResponseRequested: true,
      consequences: ["external_schedule_commitment"],
    },
    expectedDraftRisk: "review_only",
  },
];

describe("synthetic V1 policy evaluation", () => {
  it("contains 50 explicitly labeled, text-free examples spanning required pilot themes", () => {
    expect(examples).toHaveLength(50);
    expect(new Set(examples.map(({ id }) => id)).size).toBe(50);
    expect(
      new Set(examples.map(({ communicationType }) => communicationType)),
    ).toEqual(
      new Set([
        "client_lead",
        "active_project",
        "aviation",
        "business_admin",
        "personal",
      ]),
    );
  });

  it("matches independently labeled waiting-state and draft-suppression outcomes", () => {
    const results = examples.map((example) => ({
      id: example.id,
      expectedWaitingOn: example.expectedWaitingOn,
      actualWaitingOn: deriveWaitingOn(example.chronology),
      expectedDraftRisk: example.expectedDraftRisk,
      actualDraftRisk: classifyDraftRisk(example.draft),
    }));

    expect(
      results.filter(
        (result) => result.actualWaitingOn === result.expectedWaitingOn,
      ),
    ).toHaveLength(50);
    expect(
      results.filter(
        (result) => result.actualDraftRisk === result.expectedDraftRisk,
      ),
    ).toHaveLength(50);
    expect(
      results.filter((result) => result.actualDraftRisk === "no_draft"),
    ).toHaveLength(17);
    expect(
      results.filter((result) => result.actualDraftRisk === "review_only"),
    ).toHaveLength(19);
    expect(
      results.filter((result) => result.actualDraftRisk === "routine"),
    ).toHaveLength(14);
  });
});
