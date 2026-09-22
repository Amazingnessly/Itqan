import fs from "node:fs";
const s=fs.readFileSync("scripts/generate-codex-wave-handoff.mjs","utf8");
for(const token of ["manual-codex-no-api","autoMerge:false","Exact base SHA","human-only gate #152","never push directly to main"]) if(!s.includes(token)) throw new Error("Missing handoff invariant: "+token);
for(const forbidden of ["OPENAI_API_KEY","codex-action","api.openai.com"]) if(s.includes(forbidden)) throw new Error("Zero-API handoff must not depend on "+forbidden);
console.log("Zero-API Codex wave handoff policy passed.");
