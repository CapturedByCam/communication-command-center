# Context Registry Contract

`Contacts` and `Projects` are curated operational context. They are the only
canonical sources for persisted contact and project associations in V1.

## Contact resolution

`resolveContact(contacts, identifiers)` evaluates active contacts in this order:

1. exact normalized email, phone, or handle;
2. exact normalized approved alias;
3. unresolved.

An exact match is accepted only when it identifies one record. Names, partial
names, fuzzy similarity, model suggestions, Gmail inference, Drive inference,
and ChatGPT memory do not establish an association.

## Project resolution

`resolveProject(projects, hints, contactId)` evaluates active projects in this
order: exact `projectId`, exact name, exact approved alias, then a unique active
project for the already-resolved contact. Any tie is unresolved.

## Proposed records

`suggestRegistryUpdate()` returns a data-only proposal with
`persistence: "requires_manual_approval"`. It does not mutate a registry or
return a newly usable ID. A user must assign a deterministic identifier and
approve a Sheet update before a proposal becomes a curated record.

All identifier comparison is case-insensitive and trimmed. The service does not
read Gmail, Drive, Calendar, or ChatGPT memory and does not perform Sheet writes.
