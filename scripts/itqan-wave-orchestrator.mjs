import fs from "node:fs";

const config=JSON.parse(fs.readFileSync(new URL("../.github/itqan-wave-orchestrator.json",import.meta.url),"utf8"));
const eventPath=process.env.GITHUB_EVENT_PATH;
const event=eventPath&&fs.existsSync(eventPath)?JSON.parse(fs.readFileSync(eventPath,"utf8")):{};
const sha=process.env.GITHUB_SHA||"unknown";
const ref=process.env.GITHUB_REF_NAME||"unknown";
const protectedGateOpen=true;

const state={
  version:config.version,
  mode:config.mode,
  evaluatedAt:new Date().toISOString(),
  base:{ref,sha},
  policy:{
    maxParallelAgents:config.maxParallelAgents,
    sequentialIntegration:config.integration.strategy==="sequential",
    requireFreshBase:config.integration.requireFreshBase,
    requireGreenCi:config.integration.requireGreenCi,
    autoMerge:config.integration.autoMerge
  },
  humanGate:{issue:config.protectedGates.issue,open:protectedGateOpen,authority:config.protectedGates.arabicLinguisticApproval},
  event:event.action||event.workflow_run?.conclusion||"manual",
  decision:"observe_only",
  nextWaveAllowed:false,
  reason:"Observe mode is fail-closed: orchestration may report state but cannot dispatch agents or merge."
};
if(config.integration.autoMerge!==false) throw new Error("Unsafe configuration: autoMerge must remain false during observe rollout.");
if(config.protectedGates.arabicLinguisticApproval!=="human-only") throw new Error("Unsafe configuration: Arabic linguistic approval must remain human-only.");
fs.mkdirSync("artifacts",{recursive:true});
fs.writeFileSync("artifacts/wave-state.json",JSON.stringify(state,null,2)+"\n");
console.log(JSON.stringify(state,null,2));
