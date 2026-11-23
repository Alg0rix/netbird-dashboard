# Fork upgrade guide for agents (dashboard)

Read this file before you merge upstream into this fork.
The full guide, with the Go side and the rules, is in `Alg0rix/netbird` at `docs/fork/UPGRADE-GUIDE.md`.

## What this fork is

- Repository `Alg0rix/netbird-dashboard`, branch `feat/relay-groups-pair-policies`. Upstream: `netbirdio/dashboard` (git remote `origin`).
- The fork adds the Relays page, the relay card on the peer page, and the Advanced rules editor.
- Fork code is in `src/modules/relay-control/` and `src/modules/relay-policies/`.
- The fork edits only three upstream files: `src/layouts/Navigation.tsx`, `src/app/(dashboard)/peer/page.tsx`, `src/app/(dashboard)/relays/page.tsx`. Only these can conflict.

## Procedure

1. Run `git fetch origin`, then `git merge origin/main`.
2. Known conflict: `src/layouts/Navigation.tsx`. Take the upstream file. Add the Relays item back after Peers:
   - import `RadioTowerIcon` from `lucide-react`;
   - import `useRelayPolicyConfiguration` from `@/modules/relay-policies/useRelayPolicyConfiguration`;
   - read `supported: relayPoliciesSupported` with `!!permission.relays?.read`;
   - add a `SidebarItem` with `href="/relays"` and `visible={!!permission.relays?.read && relayPoliciesSupported}`.
3. Run `npm ci`, then `npx tsc --noEmit -p .`.
4. Run `npx vitest run src/modules/relay-policies src/modules/relay-control src/modules/peer src/modules/navigation src/layouts`.
5. Run `npm run build`. The build can stop once with a Next.js security notice. Run the same command again. Do not run `next upgrade` unless the owner asks.
6. Commit the merge. Push with `git push fork feat/relay-groups-pair-policies` (remote `fork` is `Alg0rix/netbird-dashboard`).

## Rules

- Never force push.
- Use NetBird components (`Card`, `Badge`, `Callout`, `DataTable`, `Button`) for new screens. Do not add plain unstyled HTML.
- The Relays page works without the relay monitor. Keep it that way.
