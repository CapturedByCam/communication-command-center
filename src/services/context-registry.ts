export interface CuratedContact {
  readonly contactId: string;
  readonly name: string;
  readonly emails?: readonly string[];
  readonly phones?: readonly string[];
  readonly handles?: readonly string[];
  readonly approvedAliases: readonly string[];
  readonly active: boolean;
}

export interface ContactIdentifiers {
  readonly email?: string;
  readonly phone?: string;
  readonly handle?: string;
  readonly name?: string;
}

export type ContactResolution =
  | { readonly kind: "exact" | "approved_alias"; readonly contactId: string }
  | { readonly kind: "unresolved" };

export interface CuratedProject {
  readonly projectId: string;
  readonly name: string;
  readonly active: boolean;
  readonly contactId?: string;
  readonly approvedAliases?: readonly string[];
}

export interface ProjectHints {
  readonly projectId?: string;
  readonly name?: string;
}

export type ProjectResolution =
  | {
      readonly kind: "exact" | "approved_alias" | "unique_contact_mapping";
      readonly projectId: string;
    }
  | { readonly kind: "unresolved" };

export interface RegistrySuggestion {
  readonly kind: "suggestion";
  readonly proposedContact: ContactIdentifiers;
  readonly persistence: "requires_manual_approval";
}

function normalized(value: string | undefined): string | null {
  const result = value?.trim().toLocaleLowerCase("en-US");
  return result ? result : null;
}

function matches(
  values: readonly string[] | undefined,
  candidate: string | null,
): boolean {
  return (
    candidate !== null &&
    (values ?? []).some((value) => normalized(value) === candidate)
  );
}

function unique<T>(values: readonly T[]): T | null {
  return values.length === 1 ? values[0]! : null;
}

/** Curated identifiers only; name fragments and fuzzy similarity never route work. */
export function resolveContact(
  contacts: readonly CuratedContact[],
  identifiers: ContactIdentifiers,
): ContactResolution {
  const active = contacts.filter((contact) => contact.active);
  const exact = unique(
    active.filter(
      (contact) =>
        matches(contact.emails, normalized(identifiers.email)) ||
        matches(contact.phones, normalized(identifiers.phone)) ||
        matches(contact.handles, normalized(identifiers.handle)),
    ),
  );
  if (exact) return { kind: "exact", contactId: exact.contactId };

  const alias = unique(
    active.filter((contact) =>
      matches(contact.approvedAliases, normalized(identifiers.name)),
    ),
  );
  return alias
    ? { kind: "approved_alias", contactId: alias.contactId }
    : { kind: "unresolved" };
}

/** Project names must be exact curated names or aliases; contact fallback must be unique. */
export function resolveProject(
  projects: readonly CuratedProject[],
  hints: ProjectHints,
  contactId?: string,
): ProjectResolution {
  const active = projects.filter((project) => project.active);
  const exactId = unique(
    active.filter((project) => project.projectId === hints.projectId),
  );
  if (exactId) return { kind: "exact", projectId: exactId.projectId };
  const exactName = unique(
    active.filter(
      (project) => normalized(project.name) === normalized(hints.name),
    ),
  );
  if (exactName) return { kind: "exact", projectId: exactName.projectId };
  const alias = unique(
    active.filter((project) =>
      matches(project.approvedAliases, normalized(hints.name)),
    ),
  );
  if (alias) return { kind: "approved_alias", projectId: alias.projectId };
  const contactProjects = contactId
    ? unique(active.filter((project) => project.contactId === contactId))
    : null;
  return contactProjects
    ? { kind: "unique_contact_mapping", projectId: contactProjects.projectId }
    : { kind: "unresolved" };
}

/** Callers must present this proposal to a human before changing the Sheet registry. */
export function suggestRegistryUpdate(
  proposedContact: ContactIdentifiers,
): RegistrySuggestion {
  return {
    kind: "suggestion",
    proposedContact,
    persistence: "requires_manual_approval",
  };
}
