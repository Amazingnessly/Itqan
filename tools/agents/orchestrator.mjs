import { readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import process from 'node:process';
import { Agent, run } from '@openai/agents';

const task = process.argv.slice(2).join(' ').trim();

if (!task) {
  console.error('Usage: npm run run -- "<task for Itqan>"');
  process.exit(1);
}

const repoRoot = resolve(import.meta.dirname, '../..');
const projectRules = await readFile(resolve(repoRoot, 'AGENTS.md'), 'utf8');

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', '.vite', '.wrangler', 'coverage']);
const allowedExtensions = new Set(['.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.yml', '.yaml']);
const maxFileBytes = 120_000;
const maxContextChars = 240_000;

const priorityPrefixes = [
  'src/',
  'public/content/activation/',
  'public/content/verified/',
  'public/content/blueprints/',
  'scripts/',
  '.github/workflows/',
  'docs/',
  'tools/agents/',
];

function extensionOf(path) {
  const match = path.match(/(\.[^.\/]+)$/);
  return match?.[1]?.toLowerCase() ?? '';
}

function contextPriority(repoPath) {
  const index = priorityPrefixes.findIndex((prefix) => repoPath.startsWith(prefix));
  return index === -1 ? priorityPrefixes.length : index;
}

async function collectRepositoryFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'AGENTS.md') continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectRepositoryFiles(absolutePath));
      continue;
    }
    if (!entry.isFile()) continue;

    const repoPath = relative(repoRoot, absolutePath).replaceAll('\\', '/');
    if (!allowedExtensions.has(extensionOf(repoPath))) continue;
    const metadata = await stat(absolutePath);
    if (metadata.size > maxFileBytes) continue;
    files.push({ absolutePath, repoPath });
  }

  return files;
}

async function buildRepositoryContext() {
  const files = await collectRepositoryFiles(repoRoot);
  files.sort((a, b) => {
    const priorityDelta = contextPriority(a.repoPath) - contextPriority(b.repoPath);
    return priorityDelta || a.repoPath.localeCompare(b.repoPath);
  });

  const sections = [];
  const includedPaths = [];
  const omittedPaths = [];
  let usedChars = 0;

  for (const file of files) {
    const content = await readFile(file.absolutePath, 'utf8');
    const section = `\n--- ${file.repoPath} ---\n${content}\n`;
    if (usedChars + section.length > maxContextChars) {
      omittedPaths.push(file.repoPath);
      continue;
    }
    sections.push(section);
    includedPaths.push(file.repoPath);
    usedChars += section.length;
  }

  const inventory = `\n--- SNAPSHOT INVENTORY ---\nIncluded files (${includedPaths.length}):\n${includedPaths.join('\n')}\n\nOmitted by context cap (${omittedPaths.length}):\n${omittedPaths.join('\n') || '(none)'}\n--- END SNAPSHOT INVENTORY ---\n`;
  return `${inventory}${sections.join('')}`;
}

const repositoryContext = await buildRepositoryContext();

const sharedInstructions = `
You are working on Itqan.
The repository AGENTS.md below is authoritative and must never be weakened or bypassed.
Do not invent Arabic exercise content. Do not claim something was tested unless you actually tested it.
The repository snapshot below is read-only evidence from the checked-out GitHub Actions workspace. Runtime implementation and controlled-content paths are intentionally prioritized before documentation. Cite repository paths when making implementation findings. Use the snapshot inventory to distinguish included evidence from files omitted by the context cap. If relevant evidence is absent, say so instead of guessing.
Return concise, implementation-oriented findings for the coordinator.

--- AGENTS.md ---
${projectRules}
--- end AGENTS.md ---

--- READ-ONLY REPOSITORY SNAPSHOT ---
${repositoryContext}
--- end repository snapshot ---
`;

const specialists = [
  new Agent({ name: 'Itqan Pedagogy', instructions: `${sharedInstructions}\nFocus on pedagogical correctness, mastery policy, content integrity, and Arabic-source safety. Identify any proposal that conflicts with the locked learning method.` }),
  new Agent({ name: 'Itqan UX', instructions: `${sharedInstructions}\nFocus on mobile-first UX, visual hierarchy, lesson clarity, accessibility, RTL presentation, and consistency with Itqan's warm premium visual direction.` }),
  new Agent({ name: 'Itqan Engineering', instructions: `${sharedInstructions}\nFocus on architecture, React/TypeScript/Vite implementation, maintainability, data flow, testability, and the smallest safe change set.` }),
  new Agent({ name: 'Itqan QA', instructions: `${sharedInstructions}\nFocus on regressions, edge cases, required validators/tests, acceptance criteria, and claims that still need verification.` }),
];

console.log(`Running ${specialists.length} Itqan specialists in parallel with prioritized read-only repository context...`);

const specialistResults = await Promise.all(specialists.map(async (agent) => {
  const result = await run(agent, task);
  return { agent: agent.name, output: result.finalOutput ?? '(no output)' };
}));

const coordinator = new Agent({
  name: 'Itqan Coordinator',
  instructions: `${sharedInstructions}
You are the final coordinator. Reconcile specialist outputs into one coherent execution brief.
Never trade precision for speed. Preserve all locked product and content rules.
Separate: verified facts, proposed implementation, validation required, and blockers.
When specialists disagree, choose the safer option and state the tradeoff.
Do not pretend code was changed or tests were run by this orchestration unless the provided evidence explicitly says so.`,
});

const evidence = specialistResults.map(({ agent, output }) => `\n## ${agent}\n${output}`).join('\n');
const coordinated = await run(coordinator, `\nOriginal task:\n${task}\n\nSpecialist outputs:\n${evidence}\n\nProduce the final coordinated execution brief for Itqan.\n`);

console.log('\n=== ITQAN COORDINATED BRIEF ===\n');
console.log(coordinated.finalOutput ?? '(no coordinator output)');
