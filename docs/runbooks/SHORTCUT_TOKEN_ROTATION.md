# Shortcut token rotation

Decision [101](../wayfinder/tickets/101-shortcut-authentication.md) uses one high-entropy shared secret for the single-owner Shortcut pilot. Rotation is assisted, content-free, and event-driven: suspected exposure, device loss, scope expansion, or pre-production hardening require it. It is not routine maintenance. Move to signed or OAuth authentication before unattended or multi-user ingestion.

This procedure changes private Script Properties and the private Shortcut only. Do not put a token in this repository, a fixture, a screenshot, a Sheet, a log, or an operational note. It does not create a deployment, change web-app access, install a trigger, send a message, or capture source content.

## Preconditions

- Confirm the approved owner, bound workbook, and intended private Apps Script deployment.
- Read the current safety posture and evidence in [V1 execution](../implementation/V1_EXECUTION.md) and [PMC Current State](../../PMC/Current%20State.md). The local Shortcut/device acceptance gate remains separate from this procedure.
- Have the exact private Shortcut to update available. Its endpoint and authentication posture must already be eligible for the device; an owner-only deployment is not automatically phone-ready.
- Preserve the old token only in its existing private location until the replacement has been entered in both required private locations. Do not copy either value into a diagnostic artifact.

## Assisted rotation

1. In the authenticated Apps Script project, run `cccDisableAll()` and verify the controlled result has no enabled flags and no managed triggers remaining. Keep `CCC_SHORTCUT_INTAKE` false.
2. Create the replacement with at least 256 bits of cryptographic randomness (for example, 32 random bytes encoded as 64 hexadecimal characters) through an approved private mechanism. Do not generate it in the repository or paste it into a terminal command, fixture, or note.
3. Replace only `CCC_SHORTCUT_TOKEN` in Script Properties. Do not alter the workbook binding, deployment access, other flags, or unrelated properties.
4. Update the same private Shortcut configuration with the replacement value. Do not export a token-bearing Shortcut or capture/share test content.
5. With Shortcut intake still disabled, use only synthetic requests to verify that both the retired and replacement tokens receive the fixed `disabled` response and create no Queue or audit mutation.
6. If the endpoint/device acceptance gate is already satisfied, temporarily enable only `CCC_SHORTCUT_INTAKE` for the controlled synthetic acceptance: the retired token must receive `unauthorized`; the replacement token must create once and report `duplicate` on the same idempotency UUID. Inspect only bounded operational metadata to confirm no token or selected text was retained.
7. Run `cccDisableAll()` again and verify the controlled all-disabled result. Record only version/commit, timestamps, fixed status codes, counts, and pass/fail evidence in the private execution record.
8. Verify no remaining authorized Shortcut/device configuration still uses the retired value. If any check is indeterminate or any client cannot be updated, keep intake disabled and treat the result as an incident.

## Incident and recovery boundary

For suspected exposure, disable first and do not attempt a live replay, blind retry, deployment-access change, or bulk cleanup. Preserve minimal content-free evidence, rotate using the steps above, and investigate from source systems and bounded metadata. A missing device, uncertain property save, unauthorized result from the replacement token, or any retained secret/source text blocks re-enablement.

The handler validates the currently injected token for every request. Rotation therefore takes effect without a code change: a retired token is rejected, the replacement token can reuse the same UUID safely, and the disabled flag rejects both before persistence. The local regression is in `tests/integration/shortcut-runtime.test.ts`; it is implementation evidence, not device or live endpoint acceptance.
