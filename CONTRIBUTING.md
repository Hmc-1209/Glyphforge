# Contributing to Glyphforge

This guide is **mandatory reading** before opening a PR or pushing
to `main`. It exists because the codebase has accumulated specific
conventions (security helpers, atomic writes, automated changelog)
that are not obvious from a quick read.

If you are an AI coding agent: load the Hermes skill
`glyphforge-development` for the same content in skill form.

---

## 1. One feature = one commit

- Each user-meaningful change is a **single commit on `main`**.
- Use `git commit --amend` while iterating; squash before pushing.
- Trivial fixups (typos, formatting) can be folded into the parent
  commit with `--amend` rather than added as separate commits.

## 2. Commit message template

```
type(scope): short imperative subject

Body — what changed and *why*. Wrap at ~72 cols. Link issues if any.

Changelog:
- type: feat|fix|refactor|chore|security|perf|docs|style|test|build
- message: One-line user-facing summary of the change
- hidden: true   (optional — exclude from public Changelog tab)

Verification:
- node --check app/server.js
- npm run lint
- (anything else you actually ran)
```

### Type semantics

| type       | use when                                                | hidden default |
|------------|---------------------------------------------------------|----------------|
| `feat`     | new user-visible feature                                | false          |
| `fix`      | user-visible bug fix                                    | false          |
| `security` | security hardening — **do not leak attack details**     | false          |
| `perf`     | observable performance improvement                      | false          |
| `refactor` | internal restructure, no behavior change                | true           |
| `chore`    | deps, tooling, repo hygiene                             | true           |
| `build`    | build pipeline / lint / CI config                       | true           |
| `docs`     | docs only                                               | true           |
| `style`    | whitespace, formatting                                  | true           |
| `test`     | test-only changes                                       | true           |

### Security commits

For `type: security`, the `message:` field **must not** describe the
attack surface. Bad: *"Fix path traversal in /api/workflows"*. Good:
*"Hardened file-handling routes against unsafe paths"*.

The detailed rationale belongs in the commit **body**, where it is
not auto-published to the user-facing Changelog tab.

## 3. Automated Changelog

A post-commit hook runs `scripts/update-changelog.js` after every
commit. It:

1. Parses the `Changelog:` block from the commit message.
2. Appends an entry to `app/src/data/changelog.json` (grouped by date).
3. Stages `changelog.json` and amends it back into the commit so
   the SHA in the entry matches the final commit SHA.

If the hook prints `commit <sha> has no Changelog: block — skipping`,
your message did not match the template — fix it with `git commit --amend`.

You should **never edit `app/src/data/changelog.json` by hand**.

## 4. Required pre-commit checks

Before each commit:

```bash
cd app
node --check server.js          # syntax
npm run lint                    # 0 errors required; warnings ok
```

For changes that touch HTTP routes, also run a manual smoke test
against a local server (`npm run server` + curl).

## 5. Server.js conventions (Express backend)

`app/server.js` has invariants that **must be preserved**:

### a. Use existing helpers, never roll your own

| concern                | helper                                         |
|------------------------|------------------------------------------------|
| validate slug          | `isSafeSlug(s)` / `requireSlug(req,res)`       |
| validate gallery type  | `requireGalleryType(req,res)`                  |
| join paths safely      | `safeResolveUnder(baseDir, ...parts)`          |
| write JSON to disk     | `writeJsonAtomic(filePath, obj)`               |
| validate path params   | `validatePathParams(req,res)` middleware       |

**Never** do `path.join(BASE_DIR, req.params.x)` directly. Always
`safeResolveUnder` — it rejects `..`, NUL bytes, and absolute paths.

**Never** do `fs.writeFileSync(p, JSON.stringify(...))`. Always
`writeJsonAtomic(p, obj)` — writes to a tmp sibling and renames,
preventing torn writes and lost-update corruption under concurrency.

### b. Auth secrets are validated at boot

`server.js` fail-fasts on startup if any of these are missing or
malformed: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` (bcrypt format),
`JWT_SECRET`. Do not reintroduce fallbacks.

### c. Body validation: allowlist, never spread

```js
// BAD — accepts any field, including future privileged ones
const item = { id: nextId, ...req.body };

// GOOD — explicit allowlist
const { title, description, link } = req.body;
const item = { id: nextId, title, description, link };
```

### d. Rate limiting

Login, write endpoints, and counter endpoints use `express-rate-limit`.
Add new limiters for any new write endpoint that takes user input.

## 6. .env / secrets

- `app/.env` is git-ignored. Never commit it.
- `app/.env.example` is the template — keep it in sync with required vars.
- bcrypt hashes in `.env` start with `$2b$`. **Do not** double them
  to `$$2b$$` — that was an old escaping mistake; current code reads
  the value as-is.
- Never paste a secret into a commit message, log, or test file.

## 7. Deletions

Do not `rm` files inside the repo. Move them to a trash directory
outside the worktree:

```bash
mkdir -p ~/.trash-glyphforge-$(date +%Y%m%d-%H%M%S)/
mv path/to/junk ~/.trash-glyphforge-*/
git rm path/to/junk    # if it was tracked
```

This keeps an out-of-tree backup in case the deletion was wrong.

## 8. Config files

- `app/config.json` — production / Docker paths. **This is what gets
  committed.** The Dockerfile builds against it directly.
- `app/config.windows.example.json` — template for local Windows
  development. Copy to `config.json` locally if needed; do not commit
  the modified copy.
- `docker-compose.nas.yml` — NAS deployment. Keep port mappings unique;
  do not duplicate.

## 9. Frontend (React)

- `app/src/data/changelog.json` is auto-generated. Never edit by hand.
- Existing components use a flat structure under `src/components/<area>/`.
- The build is Vite + React 18 with the new JSX transform — no
  `import React from 'react'` needed at the top of JSX files.

## 10. Tests / smoke checks

The repo currently has no formal test suite. For changes to:

- **HTTP routes**: hit the endpoint with curl, confirm status + payload.
- **Concurrency-sensitive writes**: run N parallel requests and confirm
  no JSON corruption (see commit 7cb0ab6 for the pattern).
- **Auth/rate limits**: confirm 401/429 actually fire.

If you add real tests, put them under `app/test/` and add an `npm test`
script.

## 11. When in doubt

Read `git log --oneline` for the last ~20 commits. The recent history
is the most up-to-date reference for "how things are done here".
