import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import activeSessions from "../../../public/content/activation/active-sessions.json";
import unitsBlueprint from "../../../public/content/blueprints/units-batch01.json";
import vowelsBlueprint from "../../../public/content/blueprints/vowels_sukun-batch02.json";
import shaddahBlueprint from "../../../public/content/blueprints/shaddah-batch02.json";
import articleBlueprint from "../../../public/content/blueprints/article_al-batch02.json";
import linkingBlueprint from "../../../public/content/blueprints/linking-batch02.json";
import fluentBlueprint from "../../../public/content/blueprints/fluent_reading-batch02.json";
import batch01 from "../../../public/content/verified/s110-batch01.json";
import batch02 from "../../../public/content/verified/s110-batch02.json";

type ReviewItem = { id:string; arabicExact:string; source:{sourceId:string;pdfPage:number;printedPage:number}; integrity:{utf8Sha256:string}; verification:{visualPass1:boolean;visualPass2:boolean;ambiguous:boolean;evidence?:{full?:string;crop?:string}} };
type Interaction = { order:number; mode:string; itemId:string };
type Session = { id:string; interactions:Interaction[] };
type Blueprint = { category:string; sessions:Session[] };
const blueprints=[unitsBlueprint,vowelsBlueprint,shaddahBlueprint,articleBlueprint,linkingBlueprint,fluentBlueprint] as Blueprint[];
const verifiedItems=[...batch01.items,...batch02.items] as ReviewItem[];
const itemById=new Map(verifiedItems.map((item)=>[item.id,item]));
const activeIds=new Set(Object.values(activeSessions).flatMap((value)=>Array.isArray(value)?value:[]));
const sessions=blueprints.flatMap((blueprint)=>blueprint.sessions.filter((session)=>activeIds.has(session.id)).map((session)=>({...session,category:blueprint.category})));
const evidenceUrl=(value?:string)=>value?`/content/${value}`:undefined;
const hasEvidence=(item?:ReviewItem)=>Boolean(item?.verification.visualPass1&&item.verification.visualPass2&&!item.verification.ambiguous&&item.verification.evidence?.full&&item.verification.evidence?.crop&&item.verification.evidence.full!==item.verification.evidence.crop);

export function HumanReviewPage({onBack}:{onBack:()=>void}) {
 const [sessionIndex,setSessionIndex]=useState(0); const session=sessions[sessionIndex];
 const sessionHeadingRef=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{sessionHeadingRef.current?.focus();},[sessionIndex]);
 const rows=useMemo(()=>session.interactions.map((interaction)=>({interaction,item:itemById.get(interaction.itemId)})),[session]);
 const blocked=rows.some(({item})=>!hasEvidence(item));
 return <main className="page human-review-page"><header className="reviewer-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour aux sources"><ChevronLeft size={20}/></button><div><span className="section-kicker">Revue humaine qualifiée</span><h1>Contrôle des 21 séances</h1><p>Lecture seule : compare les formes contrôlées aux preuves visuelles. Cette vue ne valide aucune séance automatiquement.</p></div></header>
 <section className="reviewer-progress" aria-labelledby="reviewer-session-heading"><h2 id="reviewer-session-heading" tabIndex={-1} ref={sessionHeadingRef}>Séance {sessionIndex+1} sur {sessions.length}</h2><span>{session.id}</span></section>
 <section className={blocked?"reviewer-status is-blocked":"reviewer-status is-ready"} role="status" aria-live="polite">{blocked?<ShieldAlert size={18} aria-hidden="true"/>:<ShieldCheck size={18} aria-hidden="true"/>}<div><strong>{blocked?"Revue bloquée":"Preuves disponibles"}</strong><span>{blocked?"Au moins un élément ne possède pas les deux preuves visuelles requises.":"Chaque élément de cette séance possède deux preuves visuelles déclarées."}</span></div></section>
 <div className="reviewer-items">{rows.map(({interaction,item})=>{const ready=hasEvidence(item);return <article className="reviewer-item" key={`${session.id}-${interaction.order}`}><div className="reviewer-item__meta"><h3>{interaction.order}. {interaction.mode}</h3><span>{interaction.itemId}</span></div>{item?<><bdi className="reviewer-arabic" dir="rtl" lang="ar">{item.arabicExact}</bdi><div className="reviewer-source"><span>{item.source.sourceId} · PDF {item.source.pdfPage} · imprimée {item.source.printedPage}</span><small>SHA-256 {item.integrity.utf8Sha256.slice(0,12)}…</small></div>{ready?<div className="reviewer-evidence"><a href={evidenceUrl(item.verification.evidence?.full)} target="_blank" rel="noreferrer">Page source <span className="visually-hidden">(nouvel onglet)</span><ExternalLink size={13} aria-hidden="true"/></a><a href={evidenceUrl(item.verification.evidence?.crop)} target="_blank" rel="noreferrer">Zoom texte <span className="visually-hidden">(nouvel onglet)</span><ExternalLink size={13} aria-hidden="true"/></a></div>:<div className="reviewer-blocked" role="alert"><ShieldAlert size={14} aria-hidden="true"/>Preuves visuelles manquantes — validation interdite</div>}</>:<div className="reviewer-blocked" role="alert"><ShieldAlert size={14} aria-hidden="true"/>Item absent du manifeste vérifié — validation interdite</div>}</article>})}</div>
 <nav className="reviewer-pager" aria-label="Changer de séance"><button className="secondary-cta" type="button" disabled={sessionIndex===0} onClick={()=>setSessionIndex((v)=>v-1)}><ChevronLeft size={16}/>Précédente</button><button className="secondary-cta" type="button" disabled={sessionIndex===sessions.length-1} onClick={()=>setSessionIndex((v)=>v+1)}>Suivante<ChevronRight size={16}/></button></nav><p className="reviewer-footnote">Le verdict officiel, l’identité et la qualification du réviseur restent enregistrés dans le registre V1 contrôlé.</p></main>;
}
