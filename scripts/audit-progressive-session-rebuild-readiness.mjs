import { auditProgressiveSessionRebuildReadiness } from "./progressive-session-rebuild-readiness-lib.mjs";

const audit = auditProgressiveSessionRebuildReadiness();
console.log(JSON.stringify(audit, null, 2));
