import fs from "node:fs";
const cfg=JSON.parse(fs.readFileSync(".github/itqan-wave-orchestrator.json","utf8"));
const planner=fs.readFileSync("scripts/itqan-wave-planner.mjs","utf8");
const contract=fs.readFileSync("docs/AUTOMATIC_WAVE_ACTIVATION.md","utf8");
const required=["current `main` SHA","exact candidate SHA","human-only","Automatic merging remains disabled"];
for(const x of required) if(!contract.includes(x)) throw new Error("Activation contract missing: "+x);
if(cfg.integration.autoMerge!==false) throw new Error("Auto merge cannot be activated.");
if(!planner.includes("dispatchEnabled:false")) throw new Error("Dispatch cannot activate without an authenticated reviewed runner.");
console.log("Automatic wave activation contract remains fail-closed.");
