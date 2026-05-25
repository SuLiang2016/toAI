# AI Chat Public Distribution Ownership

Date: 2026-05-24
Status: internal-only release remains blocked

This file is the repo-local contract for the external prerequisites that still block public distribution. It does not approve release by itself. It records what must be owned, what is still `TBD`, and what repo-local evidence already exists.

## Current Boundary

Repo-local verification is complete for the current `1.0.1` internal RC lane:

- static verification passed,
- packaging passed,
- browser smoke passed,
- packaged desktop smoke passed,
- real `1.0.0 -> 1.0.1` installer upgrade evidence exists.

Public distribution is still blocked because the external ownership and infrastructure below are not fully assigned.

## Blocking Matrix

| Item | Status | Owner | Notes |
| --- | --- | --- | --- |
| Signing certificate ownership | `BLOCKED` | `TBD` | Needs certificate owner, secret storage owner, and signing workflow owner. |
| Timestamp server | `BLOCKED` | `TBD` | Needs selected timestamp authority plus operational fallback. |
| Update metadata hosting | `BLOCKED` | `TBD` | Needs a public or controlled host for channel metadata and downloadable artifacts. |
| Rollback policy | `BLOCKED` | `TBD` | Needs authority for rollback decisions, retention, and emergency disable flow. |
| Trust-policy owner | `BLOCKED` | `TBD` | Needs explicit owner for user-facing trust posture and unsigned/internal-only boundaries. |

## Item 1: Signing Certificate Ownership

### Target Result

Assign the owner and storage path for Windows signing so public installers are not distributed as unsigned binaries.

### Required Owner Fields

- Certificate owner: `TBD`
- Signing secret storage owner: `TBD`
- Signing workflow owner: `TBD`
- Certificate renewal owner: `TBD`
- Revocation contact: `TBD`

### Done Criteria

Item 1 is complete only when:

- the certificate owner is explicitly named,
- secret storage for signing material is explicitly named,
- build/publish ownership for signing is assigned,
- renewal and revocation responsibility are assigned.

## Item 2: Timestamp Server

### Target Result

Select the timestamp authority and fallback policy used during signing so signatures remain valid after certificate expiry.

### Required Owner Fields

- Primary timestamp authority: `TBD`
- Fallback timestamp authority: `TBD`
- Operational owner: `TBD`
- Failure escalation owner: `TBD`

### Done Criteria

Item 2 is complete only when:

- a primary timestamp authority is documented,
- fallback behavior is documented,
- operational ownership is assigned,
- failure escalation is assigned.

## Item 3: Update Metadata Hosting

### Target Result

Define the hosting surface that will publish update metadata and downloadable release artifacts after a build is signed and approved.

### Repo-Local Evidence Already Available

- `dist/AI Chat Setup 1.0.1.exe`
- `dist/AI Chat Setup 1.0.1.exe.blockmap`
- `pnpm verify:release`
- `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`

These artifacts prove local packaging and validation only. They do not define where public clients would fetch update metadata.

### Required Hosting Contract

Before public rollout, the metadata host decision must define all of the following:

1. Canonical base URL for release artifacts and channel metadata.
2. Channel model for at least `stable`, optional `beta`, and a rollback-capable previous-good path.
3. Immutable versioned artifact paths so a published `1.0.1` installer cannot be silently replaced.
4. Metadata publication path for the chosen update mechanism.
5. Access policy:
   internal-only, staged, or public.
6. Retention policy:
   current release, previous known-good release, and rollback metadata.
7. Promotion flow:
   how an internal RC becomes a public channel update.
8. Emergency disable path:
   who can pull or freeze metadata if a bad release escapes.

### Required Owner Fields

Record these values before changing release state from internal-only:

- Metadata host owner: `TBD`
- Infrastructure/service: `TBD`
- Base URL: `TBD`
- Channel namespace: `TBD`
- Publish operator or automation owner: `TBD`
- Artifact retention owner: `TBD`
- Emergency revoke owner: `TBD`

### Done Criteria

Item 3 is complete only when:

- the metadata host and URL are explicitly named,
- the channel and rollback model are documented,
- the operator or automation owner is assigned,
- retention and revoke authority are assigned,
- public distribution docs no longer describe metadata hosting as undefined.

## Item 4: Rollback Policy

### Target Result

Define who can roll back a bad release, what artifacts must remain available, and how update metadata is frozen or reverted.

### Required Owner Fields

- Rollback decision owner: `TBD`
- Previous-known-good artifact retention owner: `TBD`
- Metadata freeze/revert operator: `TBD`
- Incident communication owner: `TBD`

### Done Criteria

Item 4 is complete only when:

- rollback authority is assigned,
- previous-good artifact retention is assigned,
- metadata freeze/revert steps have an owner,
- incident communication ownership is assigned.

## Item 5: Trust-Policy Owner

### Target Result

Define who owns the user-facing trust posture for internal-only versus public builds, including unsigned build boundaries and release language.

### Required Owner Fields

- Public trust-policy owner: `TBD`
- Internal-only release approver: `TBD`
- User-facing release-notes owner: `TBD`
- Installer warning/communication owner: `TBD`

### Done Criteria

Item 5 is complete only when:

- the trust-policy owner is assigned,
- internal-only approval authority is assigned,
- release communication ownership is assigned,
- installer warning language has a named owner.

## Repo-Local Stop Condition

The repo-local public-distribution lane is complete only when:

- all five blocker items have explicit non-`TBD` owners,
- public distribution docs no longer describe signing, timestamping, metadata hosting, rollback, or trust policy as undefined,
- the release state can move from `internal-only` without contradicting repo docs.

## Related Docs

- `docs/NEXT_EXECUTION_PLAN.md`
- `docs/PENDING_RELEASE_HANDOFF_2026-05-24.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/RELEASE_RC_EVIDENCE_2026-05-23.md`
