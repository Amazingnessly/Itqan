import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { Agent, run } from '@openai/agents';

const task = process.argv.slice(2).join(' ').trim();

if (!task) {
  console.error('Usage: npm run run -- "<task for Itqan>"');
  process.exit(1);
}

const repoRoot = resolve(import.meta.dirname, '../..');
const projectRules = await readFile(resolve(repoRoot, 'AGENTS.md'), 'utf8');

const sharedInstructions = `
You are working on Itqan.
The repository AGENTS.md below is authoritative and must never be weakened or bypassed.
Do not invent Arabic exercise content. Do not claim something was tested unless you actually tested it.
Return concise, implementation-oriented findings for the coordinator.

--- AGENTS.md ---
${projectRules}
--- end AGENTS.md ---
`;

const specialists = [
  new Agent({
    name: 'Itqan Pedagogy',
    instructions: `${sharedInstructions}\nFocus on pedagogical correctness, mastery policy, content integrity, and Arabic-source safety. Identify any proposal that conflicts with the locked learning method.`,
  }),
  new Agent({
    name: 'Itqan UX',
    instructions: `${sharedInstructions}\nFocus on mobile-first UX, visual hierarchy, lesson clarity, accessibility, RTL presentation, and consistency with Itqan's warm premium visual direction.`,
  }),
  new Agent({
    name: 'Itqan Engineering',
    instructions: `${sharedInstructions}\nFocus on architecture, React/TypeScript/Vite implementation, maintainability, data flow, testability, and the smallest safe change set.`,
  }),
  new Agent({
    name: 'Itqan QA',
    instructions: `${sharedInstructions}\nFocus on regressions, edge cases, required validators/tests, acceptance criteria, and claims that still need verification.`,
  }),
];

console.log(`Running ${specialists.length} Itqan specialists in parallel...`);

const specialistResults = await Promise.all(
  specialists.map(async (agent) => {
    const result = await run(agent, task);
    return {
      agent: agent.name,
      output: result.finalOutput ?? '(no output)',
    };
  }),
);

const coordinator = new Agent({
  name: 'Itqan Coordinator',
  instructions: `${sharedInstructions}
You are the final coordinator. Reconcile specialist outputs into one coherent execution brief.
Never trade precision for speed. Preserve all locked product and content rules.
Separate: verified facts, proposed implementation, validation required, and blockers.
When specialists disagree, choose the safer option and state the tradeoff.
Do not pretend code was changed or tests were run by this orchestration unless the provided evidence explicitly says so.`,
});

const evidence = specialistResults
  .map(({ agent, output }) => `\n## ${agent}\n${output}`)
  .join('\n');

const coordinationPrompt = `
Original task:
${task}

Specialist outputs:
${evidence}

Produce the final coordinated execution brief for Itqan.
`;

const coordinated = await run(coordinator, coordinationPrompt);

console.log('\n=== ITQAN COORDINATED BRIEF ===\n');
console.log(coordinated.finalOutput ?? '(no coordinator output)');
