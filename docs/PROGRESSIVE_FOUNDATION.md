# Progressive foundation source plan

This document records the approved early-reading sequence from the new progressive support without copying Arabic exercise strings out of screenshots.

## Foundation substages

The `reading_units` stage is progressively decomposed into:

1. Fathah;
2. Kasrah;
3. Dammah;
4. mixed short vowels;
5. madd with Alif;
6. a limited madd-with-Ya substage;
7. a limited madd-with-Waw substage;
8. mixed-madd consolidation.

Every active item in these substages must be an isolated controlled word and must remain free of observed Sukūn, Shaddah, definite-article behavior, and multi-word structure.

The canonical PDF now resolves the Tanwīn/Sukūn block directly from the source: page 39 introduces Tanwīn with Fatḥah on letter forms; pages 40–42 cover Tanwīn with Kasrah; pages 43–45 cover Tanwīn with Ḍammah and general reading; page 46 is an open-letter recap/reference page; and pages 47–49 introduce and exercise Sukūn. Page 46 is not a learner substage and no separate mixed-Tanwīn stage is inferred.

The canonical machine-readable plan is `public/content/curriculum/progressive-foundation.json`.

## Two-word material

The progressive support also contains two-word practice. It is source material for `linking`, not for `reading_units`. This preserves the product invariant that multi-word structures begin only at `linking`.

## Source strategy

The new progressive support is the canonical source for the early learner path. The richer supports already supplied remain useful for later controlled reading, especially `linking`, `fluent_reading`, and advanced consolidation.

## Source intake status

The human source holder has now supplied the full canonical PDF for this intake wave. The Baghdadiyyah reading-support block is pages 22–62 of that PDF. The repository records the document identity, SHA-256, page mapping and pedagogical placement without treating extracted/model text as authoritative. The PDF itself is still conversation-backed and must be imported as repository evidence before any new item can become active.

The source-led continuation after mixed madd is: Tanwīn-with-Fatḥah source introduction → Tanwīn with Kasrah → Tanwīn with Ḍammah → page-46 source recap → Sukūn, all under `vowels_sukun`. Two-word material remains reserved for `linking`; longer reading remains reserved for `fluent_reading` / advanced consolidation; and the later Shaddah source block is filtered item-by-item against the locked Shaddah-stage purity rules.

## Current activation status

This plan does not itself activate new Arabic content. The default human task is now verification rather than retyping: an agent may prepare a non-authoritative transcription candidate, but new Arabic items still require the controlled source workflow:

- exact source traceability;
- provisional candidate or human exact entry;
- human visual pass 1;
- human visual pass 2;
- no ambiguity;
- no silent normalization;
- category authorization;
- explicit eligibility before activation.

Until that intake is complete, the existing production sessions are not evidence that the corrected progressive curriculum has been implemented. Issue #208 tracks the rebuild and the later qualified-human re-review.
