import fs from "node:fs";
import { execFileSync } from "node:child_process";

const cfg=JSON.parse(fs.readFileSync(".github/itqan-wave-orchestrator.json","utf8"));
const allowed=["ui","qa","accessibility","performance","release-audit","tooling"];
const requested=(process.env.ITQAN_WAVE_TASKS||"ui,qa,accessibility,release-audit").split(",").map(x=>x.trim()).filter(Boolean);
const selected=requested.filter(x=>allowed.includes(x)).slice(0,cfg.maxParallelAgents);
const blocked=requested.filter(x=>!allowed.includes(x));
const baseSha=process.env.GITHUB_SHA||execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const waveId=(process.env.GITHUB_RUN_ID||baseSha.slice(0,12));
const constraints=[
 "Do not author, normalize, correct, or replace Arabic exercise content.",
 "Do not weaken validators, content guards, mastery rules, or the human-only gate #152.",
 "Work from the exact base SHA below on an isolated branch and open a PR; never push directly to main.",
 "Run the repository validation suite relevant to your changes and report only verified results.",
 "If the task requires Arabic linguistic judgment, stop that part and report it as human-review blocked."
];
const taskPrompt=(kind,i)=>[
 `Itqān controlled wave ${waveId} — task ${i+1}/${selected.length}: ${kind}.`,
 `Exact base SHA: ${baseSha}.`,
 `Branch suggestion: codex/wave-${waveId}-${kind}.`,
 ...constraints,
 `Scope: improve ${kind} only where supported by the current repository state. Inspect before editing; keep changes minimal and auditable.`
].join("\n");
const handoff={version:1,waveId,baseSha,dispatchMode:"manual-codex-no-api",autoMerge:false,selected,blocked,tasks:selected.map((kind,i)=>({kind,branch:`codex/wave-${waveId}-${kind}`,prompt:taskPrompt(kind,i)}))};
fs.mkdirSync("artifacts",{recursive:true});
fs.writeFileSync("artifacts/codex-wave-handoff.json",JSON.stringify(handoff,null,2)+"\n");
let md=`# Codex wave handoff — ${waveId}\n\nBase SHA: \`${baseSha}\`\n\nLaunch each task manually in Codex. No API key is required by this handoff.\n\n`;
for(const [i,t] of handoff.tasks.entries()) md+=`## Task ${i+1}: ${t.kind}\n\nBranch: \`${t.branch}\`\n\n\`\`\`text\n${t.prompt}\n\`\`\`\n\n`;
if(blocked.length) md+=`Blocked task kinds: ${blocked.join(", ")}\n`;
fs.writeFileSync("artifacts/CODEX_WAVE_HANDOFF.md",md);
console.log(`Prepared ${handoff.tasks.length} manual Codex tasks for wave ${waveId}.`);
