# weekly-metrics.ps1 — pulls what can be pulled honestly, rest is manual.
$ProgressPreference = 'SilentlyContinue'
$repo = 'mrcbrbn5361/SyncytiumMD'
$r = curl.exe -s "https://api.github.com/repos/$repo" | ConvertFrom-Json
$n = curl.exe -s "https://api.npmjs.org/downloads/point/last-month/syncytium-md" | ConvertFrom-Json
$hn = curl.exe -s "https://hn.algolia.com/api/v1/search?query=syncytiummd&tags=story" | ConvertFrom-Json
"date              : {0}" -f (Get-Date -Format 'yyyy-MM-dd')
"stars             : {0}" -f $r.stargazers_count
"forks             : {0}" -f $r.forks_count
"subscribers       : {0}" -f $r.subscribers_count
"open_issues(incl PRs): {0}" -f $r.open_issues_count
"npm last-month    : {0}" -f $n.downloads
"HN stories found  : {0}" -f $hn.nbHits
"manual next       : MCP installs, community issue count, channel ledger -> docs/metrics.md"
