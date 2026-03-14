#!/usr/bin/env node
import {
  collectCoordinationIssues,
  coordinationConfig,
  currentBranch,
  listChangedFiles,
  loadConfig,
  readClaims,
  resolveRootDir,
} from './coordination-lib.mjs';

const rootDir = resolveRootDir();
const config = loadConfig(rootDir);
const coordination = coordinationConfig(config);
const branch = currentBranch(rootDir);
const mainBranch = config.git?.mainBranch || 'main';
const claims = readClaims(rootDir);
const changedFiles = listChangedFiles(rootDir, mainBranch);
const branchClaims = claims.filter((claim) => claim.branch === branch);
const failures = [];

if (branch === mainBranch && changedFiles.length > 0) {
  failures.push(`primary branch \`${branch}\` has active changes; move agent work to an isolated \`codex/\` branch first`);
}

if (branch !== 'HEAD' && branch !== mainBranch && !branch.startsWith('codex/')) {
  failures.push(`agent work must run on a \`codex/\` branch, but current branch is \`${branch}\``);
}

if (branchClaims.length === 1 && branchClaims[0].worktree && branchClaims[0].worktree !== process.cwd()) {
  failures.push(`claim \`${branchClaims[0].workId}\` belongs to worktree \`${branchClaims[0].worktree}\`, not the current directory`);
}

const coordinationIssues = collectCoordinationIssues({
  claims,
  coordination,
  currentBranchName: branch,
  changedFiles,
});
failures.push(...coordinationIssues.failures);

if (failures.length > 0) {
  console.error('[agent:guard] blocked:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  console.error('[agent:guard] required pattern: one agent = one codex branch = one claim = one scoped path set');
  console.error('[agent:guard] completion rule: once scoped work is validated, merge it to the approved integration branch immediately and push immediately');
  console.error(`[agent:guard] next: npm run safe:worktree -- <task-slug> ${mainBranch}`);
  console.error('[agent:guard] next: npm run ctx:checkpoint -- --work-id "W-..." --surface "<surface>" --objective "<objective>"');
  console.error('[agent:guard] next: npm run coord:claim -- --work-id "W-..." --agent "<agent>" --surface "<surface>" --summary "<summary>" --path "<prefix>"');
  process.exit(1);
}

console.log(`[agent:guard] ok: ${branch}`);
console.log('[agent:guard] reminder: validate completed scoped work, then merge and push it immediately');
