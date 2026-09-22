import fs from "node:fs";
const cfg=JSON.parse(fs.readFileSync(".github/itqan-wave-orchestrator.json","utf8"));
const allowed=new Set(["ui","qa","accessibility","performance","release-audit","tooling"]);
const requested=(process.env.ITQAN_WAVE_TASKS||"ui,qa,accessibility,release-audit").split(",").map(v=>v.trim()).filter(Boolean);
const tasks=requested.filter(v=>allowed.has(v)).slice(0,cfg.maxParallelAgents).map((kind,index)=>({
 id:`wave-task-${index+1}`,kind,
 constraints:["no-arabic-authoring","no-guard-weakening","branch-and-pr-only","fresh-main-required"]
}));
const plan={version:1,mode:cfg.mode,dispatchEnabled:false,autoMerge:false,humanGate:cfg.protectedGates,tasks,
 blockedRequested:requested.filter(v=>!allowed.has(v)),decision:"plan_only"};
if(cfg.mode!=="observe") throw new Error("Planner activation requires a separately reviewed mode change.");
fs.mkdirSync("artifacts",{recursive:true});
fs.writeFileSync("artifacts/wave-plan.json",JSON.stringify(plan,null,2)+"\n");
console.log(JSON.stringify(plan,null,2));
