# Project context for Claude Code

This is **Axes-co/prediction-market**, a fork of `kuestcom/prediction-market` running on Vercel Pro. We're on Next.js 16.2.4 with Cache Components enabled.

If you are starting a fresh session: read this file end-to-end before touching anything. It exists so the human does not have to re-explain the same constraints every conversation.

## Repository layout

- `origin` (`Axes-co/prediction-market`) is our production fork.
- `upstream` (`kuestcom/prediction-market`) is the source we periodically pull from.
- We are typically tens to hundreds of commits ahead of `upstream/main` because we ship features and refactors on top.

The user also keeps a clone of the kuest fork at `~/Desktop/Projects/Kuest/prediction-market` (`khaleel737/prediction-market`, with `upstream` set to `kuestcom/prediction-market`). That second clone is where contributions back to kuest get prepared and PR'd. Do **not** use Axes-specific code or commit messages when sending patches to that clone.

## Critical Axes customizations (NEVER silently revert these)

When merging from upstream, these must be preserved. If a kuest change directly replaces one of these, stop and ask the user before proceeding.

1. **18 i18n locales.** Kuest only translates `de/en/es/fr/pt/zh`. We add `ar, hi, id, it, ja, ko, ms, ru, th, tr, uk, vi`. When kuest adds new keys to their 6 locales, **mirror those keys into all 18 of ours** with the English value as a fallback (so the UI never shows a missing-key error). All locale files must end up with the same key count.
2. **Monolithic `src/app/[locale]/admin/(general)/_components/AdminGeneralSettingsForm.tsx`.** Kuest split it into `BrandIdentitySection`, `GlobalAnnouncementSection`, `IntegrationsSection`, `LegalSection`, `MarketFeeSection`, `SocialCommunitySection`. We rejected the split because we have whatsapp/telegram/reddit/footer-disclaimer fields the split version doesn't accommodate cleanly. On merge, kuest's split files appear as new untracked deletions; remove them and keep the monolithic file.
3. **`Footer year={new Date().getFullYear()}` in `(platform)/layout.tsx`.** This is our pattern; kuest periodically removes the year prop entirely. Keep it.
4. **Stricter `src/app/robots.ts` disallow list.** We disallow `/api/, /admin/, /embed/, /settings/, /portfolio/, /2fa/`. Kuest only disallows `/api/`. Always keep ours.
5. **Hero carousel on `/`.** Lives in our home page; kuest does not have it. See `feedback_hero_carousel.md` in your auto-memory if you have one.
6. **Embed dialog rewrite.** Two-view architecture (preview + code), rewritten to match Polymarket's pattern. See `project_embed_dialog_rewrite.md` if you have memory access.
7. **Cache tag scoping (`cacheTags.sportsMenu`, `cacheTags.sitemap`).** We split these out from `cacheTags.eventsList` to stop ISR write fan-out. **Already upstreamed in kuest PR #940 (commit `519a37ce`).** If you see the same fix arrive from upstream, accept it as a no-op — both sides have the same code.
8. **Upstash Redis `withCache` wrapper** in `src/lib/redis.ts` and used in `src/lib/db/queries/settings.ts`. Don't replace with raw queries.
9. **Wagmi/AppKit/Reown deps** (`@wagmi/core@2.22.1`, `@upstash/ratelimit`, `@upstash/redis`). Pinned by us; kuest doesn't need them.
10. **`@reown/appkit-adapter-wagmi` nested override** in `package.json`:
    ```
    "overrides": { "@reown/appkit-adapter-wagmi": { "@wagmi/connectors": "8.0.1" } }
    ```
    Without this, npm picks `@wagmi/connectors@8.0.3` which imports `@wagmi/core/tempo` (only exists in `@wagmi/core@3.x`) and breaks the Vercel build.

## Merge strategy when pulling from `upstream/main`

Default: **integrate both sides, do not abort and ask.**

```
git fetch upstream
git status                                  # ensure clean tree (or stash)
git merge upstream/main --no-edit --no-commit
```

Conflict resolution heuristics:
- Code that both sides modified: keep kuest's refactor structure AND wire in our customization. The two are almost never true semantic replacements.
- i18n conflicts: take kuest's diff for the 6 kuest locales, then run a small node script that mirrors any new keys from `en.json` into the other 12 locale files using English fallback values. All 18 files must end up with the same key set.
- Untracked admin section files appearing (BrandIdentitySection etc.): they belong to the rejected split. `git rm` them.
- `revalidatePath('/[locale]', 'layout')` calls reappearing in admin actions: kuest sometimes regresses on this. Remove them — they're already covered by scoped `updateTag` calls.

Only stop and ask the user if a conflict represents kuest **intentionally removing or replacing** a feature we depend on.

## Validation gates before committing a merge or refactor

Run all four. If any fails, fix before committing.

```
rm -rf .next && npx next typegen          # regenerate route types after structural changes
npx tsc --noEmit                          # type check
npx eslint <changed files>                # lint changed source files
npx vitest run                            # full unit test suite (currently ~507 tests)
```

For meaningful UI/architecture changes also run `npx next build` to catch prerender errors that don't surface in tsc.

## Commit and push conventions

- **Author must be `Khaleel Musleh <khaleelmusleh@gmail.com>` only.** Never include `Co-Authored-By: Claude…` trailers anywhere — not in commits, not in PR bodies, not in branch names. The user wants full authorship credit on the public history.
- Commit messages are technical and conversational. No mention of Claude, AI, code review bots, or "I built this with X". Describe the change.
- Use `git commit --no-verify` only when the husky pre-push hook fails on flaky test timeouts you've already verified pass on a clean run.
- For destructive git ops (`reset --hard`, `push --force`, branch deletions), confirm with the user first.

## Where past work is documented

- `docs/adr/0001-caching-strategy-for-live-event-pages.md` — full architectural decision record for the cache tag scoping work (issue #939, kuest PR #940). Includes evidence audit, considered alternatives, and risk register.
- Commit history: scoped commits with detailed messages explaining the why for each change. `git log --oneline upstream/main..HEAD` shows everything we've added on top of kuest.
- Recent cache work commits to know about:
  - `7713fa8f` — Tag scoping (eventsList split into eventsList + sportsMenu + sitemap)
  - `7c335dd9` — Sitemap freshness fix on new event creation
  - `04cc333f` — Removed 8 redundant nuclear `revalidatePath` calls
  - `f81e1394` — Expanded `urlSetChanged` to cover existing-event mutations (markets added, slug changes, status flips)
  - `b79f32d9` — Latest upstream merge (through PR #948)

## Things the user has been clear about

- **Senior code, not patches.** No `if (someEdgeCase) doFix()` to mask a bug. Fix the underlying cause and prove it with evidence (file:line refs, doc quotes, test output). Read the code before changing it.
- **Brutally honest confidence.** Do not say "100% sure" or "1000% sure" — those numbers don't exist in software. Give a verifiable claim or admit uncertainty.
- **No JSDoc bloat.** Don't write multi-line comment blocks explaining what a field is for unless the meaning genuinely cannot be inferred from the name.
- **No em-dashes** in user-facing writing (commit messages, PR bodies, GitHub comments). Use commas, periods, or parens.
- **Stop asking permission for read-only investigation.** Just go look at the code first, then propose.
- **When the user says they don't trust you, stop coding and audit.** Don't ship more code under conditions of distrust; validate what's already shipped against production data first.
