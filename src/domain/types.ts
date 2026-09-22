import type { z } from "zod";
import type {
  CategorySchema,
  CommunicationItemSchema,
  DraftRiskSchema,
  DraftStatusSchema,
  NextActionTypeSchema,
  ShortcutIntakeSchema,
  SourceSchema,
  StatusSchema,
  StudioStagingSchema,
  UrgencySchema,
  WaitingOnSchema,
} from "./schemas.js";

export type Source = z.infer<typeof SourceSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type WaitingOn = z.infer<typeof WaitingOnSchema>;
export type Urgency = z.infer<typeof UrgencySchema>;
export type NextActionType = z.infer<typeof NextActionTypeSchema>;
export type DraftStatus = z.infer<typeof DraftStatusSchema>;
export type DraftRisk = z.infer<typeof DraftRiskSchema>;
export type CommunicationItem = z.infer<typeof CommunicationItemSchema>;
export type ShortcutIntake = z.infer<typeof ShortcutIntakeSchema>;
export type StudioStagingRecord = z.infer<typeof StudioStagingSchema>;
