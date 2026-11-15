# GitHub repository settings — owner approval required

Every command below is externally visible. Nothing here has been run.
Prereq: `gh auth login` (this machine currently has no gh session).

## 1. One-time settings

```powershell
# Sharper description (front-page of the repo; verified features only)
gh repo edit mrcbrbn5361/SyncytiumMD --description `
  "AI agent workspace infrastructure: one canonical .syncytium/ context, adapters for 10+ AI coding tools, handoff baton, lease lock, CI drift gate, 3D knowledge graph and a 23-tool MCP server."

# Topics that match what the tool actually is
gh repo edit mrcbrbn5361/SyncytiumMD --add-topic agents-md --add-topic coding-agents --add-topic agent-coordination

# Homepage: point at npm until a docs site exists (then swap)
gh repo edit mrcbrbn5361/SyncytiumMD --homepage https://www.npmjs.com/package/syncytium-md

# Enable GitHub Discussions
gh api graphql -f query='
mutation {
  enableDiscussions(input: { repositoryId: "R_kgDOUhPTUw" }) { repository { hasDiscussionsEnabled } }
}'

# Pin the repo on the owner profile (profile-level action)
gh api graphql -f query='
mutation($uid: ID!, $sub: PinnableItem!) {
  pinItem(input: { userId: $uid, itemId: $sub }) { pinnedItem { id } }
}' -f uid=<user-node-id> -f itemId=R_kgDOUhPTUw
# owner node id: gh api users/mrcbrbn5361 --jq .node_id
```

## 2. Labels

```powershell
foreach ($l in @(
  'good first issue,7057ff', 'help wanted,008672', 'area: cli,ededed',
  'area: mcp,ededed', 'area: adapters,ededed', 'area: ui,ededed',
  'area: docs,0075ca', 'area: ci,fbca04', 'bug,d73a4a', 'enhancement,a2eeef'
)) {
  $n, $c = $l -split ','
  gh label create $n --color $c --repo mrcbrbn5361/SyncytiumMD --force
}
```

## 3. Good-first-issues

Titles/bodies: `docs/good-first-issues.md`, one `## N. <title>` section per
issue. Publish:

```powershell
$doc = Get-Content docs/good-first-issues.md -Raw
$doc -split "`n## " | Select-Object -Skip 1 | ForEach-Object {
  $lines = $_ -split "`n"
  $title = $lines[0].Trim()
  $body  = ($lines[1..($lines.Count-1)] -join "`n").Trim()
  gh issue create --repo mrcbrbn5361/SyncytiumMD --title $title --label "good first issue" --body $body
}
```

## 4. Release notes rewrite

```powershell
gh release edit v0.3.1 --repo mrcbrbn5361/SyncytiumMD --notes-file docs/release-notes/v0.3.1.md
gh release edit v0.3.0 --repo mrcbrbn5361/SyncytiumMD --notes-file docs/release-notes/v0.3.0.md
gh release edit v0.2.3 --repo mrcbrbn5361/SyncytiumMD --notes-file docs/release-notes/v0.2.3.md
```

## 5. Dependabot

Merge the open, green minor/patch PRs one at a time after CI is green
(`gh pr check`, then `gh pr merge --squash`). Never merge the zod 3→4 or
commander 13→15 majors without a code audit — those are breaking.
