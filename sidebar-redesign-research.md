# I’m Snappy Sidebar Redesign Research

## Design-System Findings

Material Design 3 treats **collapsed and expanded rails as visual counterparts**, rather than a narrow sidebar with clipped full-sidebar content. It recommends a stable rail placement, a small number of primary destinations, and a clear active-state indicator. Its current pattern explicitly supports transitioning between collapsed and expanded rails on larger screens. [1]

Carbon’s UI-shell guidance frames the left panel as **secondary navigation**, distinct from global actions and contextual content. It recommends using the panel for frequent switching among a limited number of secondary items, while avoiding deep navigation hierarchies. Its shell model also treats header, left panel, and right panel as coordinated but independent regions. [2]

## Applied Rules for I’m Snappy

The compact state will be a deliberately designed **icon rail** with a signature mark, a clear New Focus action, one workspace affordance, recent-work access, and an account control. It will not show cut-off words, letter fragments, or shrunken versions of full rows.

The expanded state will be a **studio index**: a brand/control header, a labeled primary action, a current-workspace card, and a concise recent-work list. It will use simple sections, a single active indicator, and one-level navigation only. The desktop rail will expand on hover and remain open when focus is inside; mobile will retain its explicit drawer model.

## Verification Notes

The rebuilt desktop rail now renders as a true icon-only rail when compact and reveals a coherent studio index on hover. The two states use separate compositions rather than clipping the same rows, so neither state exposes partial labels or cramped controls.

## References

[1]: https://m3.material.io/components/navigation-rail/overview "Material Design 3 — Navigation rail"
[2]: https://carbondesignsystem.com/components/UI-shell-left-panel/usage/ "Carbon Design System — UI shell left panel"
