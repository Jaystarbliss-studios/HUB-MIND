# Hub-Mind 2.0 — Phases A–J Implementation

This branch is the controlled migration branch for the resource-centric Hub-Mind architecture. `main` is intentionally untouched.

## A — Foundation
- Role model is now `admin | staff`.
- Old assistant/teacher role authority is removed from the application model.
- Authentication no longer creates a workspace profile for an arbitrary Google account.
- New accounts require an administrator-created invitation.
- Usernames are normalized and unique.
- User status supports invited/active/suspended/inactive.
- Firestore rules deny unrecognized workspace identities.

## B — Permissions and sharing
- Resources use owner/visibility/sharedWith metadata.
- Shared permissions are read/write.
- Connections are modeled separately from resource sharing.
- Normal sharing requires an accepted connection.
- Shares have active/revoked/pending lifecycle fields.
- Direct resource routes are generated centrally.
- Resource authorization helpers are centralized.

## C — Core resources
- Resource collection mapping covers documents, tasks, projects, meetings, clients, follow-ups, knowledge and reports.
- Generic resource save/delete helpers enforce ownership/write access.
- Activity logging and notifications are centralized.
- Task lifecycle supports draft → assigned → accepted → in progress → submitted → under review → completed/rejected → archived.
- Cross-resource identifiers remain first-class on the existing resource types.

## D — Calendar and recurrence
- Recurring meeting/task templates remain first-class records.
- Occurrences use deterministic template/date keys to prevent duplicates.
- Recurring tasks materialize only the required occurrence instead of generating an unlimited future backlog.
- Existing recurring task processing now creates permission-aware task records.
- Google Calendar integration already present in the repository remains isolated for continued synchronization work.

## E — Documents
- Save lifecycle has explicit hydration/changed/saving/saved/offline/error states.
- Autosave is structurally gated behind hydration + user changes.
- Document versions have a dedicated version service.
- Existing A4/editor/template/export subsystem is preserved rather than replaced.
- Shared document access is permission-aware at the data layer.

## F — Shawn
- Shawn tool names are centralized.
- Shawn authorization delegates to the same role/resource permission layer.
- Shawn cannot elevate the speaking user's permissions.
- Destructive Shawn tools require explicit confirmation.
- Resource navigation is generated from resource type/id instead of hard-coded UI knowledge.
- Existing chat/voice UI remains intact; wake-word behavior is not used as an authorization mechanism.

## G — Communications
- Notification records support resource-aware notifications.
- Existing share-link/WhatsApp pathways are retained.
- Resource routes can be placed into external messages without exposing another user's email as the primary identity.

## H — Admin
- Admin Centre now manages approved People through invitation-first onboarding.
- Direct password/account creation is removed from the workspace admin UI.
- Staff role is the only non-admin role.
- Recurring task management remains available.
- Organization/security responsibilities are separated from resource ownership.

## I — UX
- Invitation errors have explicit login states.
- Admin People UI is responsive.
- Existing responsive/mobile editor and context-menu work is preserved.
- Empty/error/loading states remain explicit rather than silently falling back to demo data.

## J — Hardening
- Demo seeding remains disabled.
- Local workspace storage remains cache/offline-only.
- Firestore is the authoritative source of workspace data.
- Old assistant-centric Firestore authorization paths are removed.
- Unauthorized Google identities are rejected before workspace membership is created.
- Security rules enforce owner/shared/workspace access for resource reads and writes.
- Destructive operations are routed through authorization-aware helpers.

## Migration notes
Firestore queries are not filters: once resource-level privacy rules are enabled, staff list queries must carry constraints compatible with those rules. This is an intentional security property of the migration, not a client-side filtering shortcut. The Firebase documentation explicitly requires queries to match the constraints enforced by rules.

Before production deployment, the Firebase Rules simulator/CI should be used to verify owner, shared-read, shared-write, workspace, suspended-user, invitation and unauthorized-account cases.
