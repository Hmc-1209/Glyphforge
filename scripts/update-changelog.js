#!/usr/bin/env node
/**
 * scripts/update-changelog.js
 *
 * Reads the most recent commit, extracts a "Changelog:" block from its message,
 * and prepends an entry to app/src/data/changelog.json (grouped by date).
 *
 * Expected commit message format:
 *
 *   type(scope): subject
 *
 *   Body text...
 *
 *   Changelog:
 *   - type: feat|fix|refactor|chore|security|perf|docs|style
 *   - message: User-facing one-line summary
 *   - hidden: true   (optional — exclude from public Changelog tab)
 *
 * If `hidden: true` is set, the entry is written to changelog.json but flagged
 * so the frontend can filter it out (chore/internal items).
 *
 * Usage:
 *   node scripts/update-changelog.js              # process HEAD
 *   node scripts/update-changelog.js <sha>        # process a specific commit
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'app', 'src', 'data', 'changelog.json');

const VALID_TYPES = new Set([
  'feat', 'fix', 'refactor', 'chore', 'security', 'perf', 'docs', 'style', 'test', 'build',
]);

function getCommitInfo(ref) {
  const sha = execSync(`git rev-parse --short ${ref}`, { cwd: REPO_ROOT }).toString().trim();
  const date = execSync(`git show -s --format=%cs ${ref}`, { cwd: REPO_ROOT }).toString().trim(); // YYYY-MM-DD
  const message = execSync(`git show -s --format=%B ${ref}`, { cwd: REPO_ROOT }).toString();
  return { sha, date, message };
}

function parseChangelogBlock(message) {
  const lines = message.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^changelog:\s*$/i.test(l.trim()));
  if (startIdx < 0) return [];

  const entries = [];
  let current = null;

  for (let i = startIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    // Stop at the next non-list section (any line not starting with "-" or whitespace continuation)
    if (!line.startsWith('-') && !raw.startsWith(' ')) break;

    const m = line.match(/^-\s*(type|message|hidden)\s*:\s*(.+)$/i);
    if (m) {
      const key = m[1].toLowerCase();
      const value = m[2].trim();
      if (key === 'type') {
        if (current) entries.push(current);
        current = { type: value, message: '', hidden: false };
      } else if (key === 'message' && current) {
        current.message = value;
      } else if (key === 'hidden' && current) {
        current.hidden = /^(true|yes|1)$/i.test(value);
      }
    }
  }
  if (current) entries.push(current);

  return entries.filter((e) => e.type && e.message);
}

function loadChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) return [];
  const raw = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveChangelog(data) {
  fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function upsert(changelog, date, entries, sha) {
  // Newest first.
  let day = changelog.find((d) => d.date === date);
  if (!day) {
    day = { date, changes: [] };
    changelog.unshift(day);
    // Keep sort: newest dates first.
    changelog.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  for (const e of entries) {
    // Idempotency: skip if same sha + same message already exists.
    const dup = day.changes.find((c) => c.hash === sha && c.message === e.message);
    if (dup) continue;
    if (!VALID_TYPES.has(e.type)) {
      console.warn(`[changelog] unknown type "${e.type}", keeping anyway`);
    }
    const entry = { hash: sha, type: e.type, message: e.message };
    if (e.hidden) entry.hidden = true;
    day.changes.push(entry);
  }
}

function main() {
  const ref = process.argv[2] || 'HEAD';
  const { sha, date, message } = getCommitInfo(ref);
  const entries = parseChangelogBlock(message);

  if (entries.length === 0) {
    console.error(`[changelog] commit ${sha} has no Changelog: block — skipping`);
    process.exit(0);
  }

  const changelog = loadChangelog();
  upsert(changelog, date, entries, sha);
  saveChangelog(changelog);

  // Stage the file so the next commit (e.g. amend) picks it up.
  try {
    execSync(`git add "${CHANGELOG_PATH}"`, { cwd: REPO_ROOT });
  } catch (_) { /* ignore in dirty trees */ }

  console.log(`[changelog] updated ${date} from ${sha}: ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
}

main();
