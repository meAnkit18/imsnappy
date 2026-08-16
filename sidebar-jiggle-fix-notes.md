# Sidebar Jiggle Fix — Diagnostic Notes

## Problem
The aside.archive-rail (client/src/pages/Home.tsx, lines ~181-285) jiggles when expanding/collapsing on desktop.

## Root causes (confirmed via webdev_debug, high confidence)
1. Width animates 76px <-> 280px while the two inner views (.rail-compact-view / .rail-expanded-view) swap via display:none/flex in a media query. display is non-animatable; reflo

## Live verification findings (post crossfade implementation)
The view crossfade works correctly (opacity/transform swap confirmed via computed styles), but when `is-expanded` is added, the rail width stays 76px in the live DOM. Diagnosis: the conditional class string `${railExpanded ? "is-expanded md:w-[280px]" : ""}` is only appended when React state changes; my manual classList.add in the console confirmed the class exists but width remains 76px because Tailwind's JIT may not have generated `md:w-[280px]` for that class string — but more likely the issue is that the non-md base `w-[280px]` plus `md:w-[76px]` are fine at desktop. Actually width stays 76px => the md breakpoint rule `md:w-[76px]` wins over `md:w-[280px]`? Both are same specificity; later in source wins. `md:w-[76px]` appears BEFORE the conditional in the class string, so `md:w-[280px]` (later) should win. Yet computed width is 76px at viewport 1280px. Likely the live dev server hasn't hot-reloaded the latest class string, or viewport isn't >=768 (it is). Need to verify after reload; if still failing, define the width in CSS via custom class `.archive-rail.is-expanded { width: 280px }` inside the media query instead of relying on the JIT class.

## Fix verified (smooth transition confirmed)
The expansion now animates smoothly: measured width progressed 76px → 183px → 280px across the 240ms transition, and collapse progressed 280px → 221px → 77px → 76px. The crossfade between compact and expanded views swaps opacity/transform while both remain mounted as absolute-positioned layers, so no reflow jiggle occurs. Final states render cleanly: compact icon rail at 76px and the full 280px studio index both verified in the live page. Remaining: update todo.md, save checkpoint, deliver.

## Internal content refinement verification
The compact and expanded layers now share a stable box model, while the expanded section rows enter through staged opacity and transform transitions. Selected pins and conversation indicators now scale within fixed geometry rather than changing width, height, or margin. Live hover checks confirm that the content settles without layout shifts in both sidebar states.
