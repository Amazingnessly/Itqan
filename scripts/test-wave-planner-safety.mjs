import fs from "node:fs"; const s=fs.readFileSync("scripts/itqan-wave-planner.mjs","utf8");
for(const token of ["dispatchEnabled:false","autoMerge:false","no-arabic-authoring","no-guard-weakening","fresh-main-required"]) if(!s.includes(token)) throw new Error("Missing fail-closed planner invariant: "+token);
if(s.includes('"content-authoring"')) throw new Error("Content authoring must not be an automated wave kind.");
console.log("Wave planner safety policy passed.");
