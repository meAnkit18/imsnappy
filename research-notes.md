# I’m Snappy Interface Research Notes

## Sources Consulted

| Product | Finding | Interface implication |
|---|---|---|
| [OpenAI ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/) | An agent can blend browsing, analysis, code, and connected-app work within a single conversation, while retaining a clear user-control boundary for consequential actions. | Include a visible mode control in the composer, a compact live-work card, and a clear “pause / stop” control in the activity surface. |
| [Anthropic Claude Projects](https://www.anthropic.com/news/projects) | Long-running work benefits from a project container that keeps contextual knowledge, chats, and side-by-side work products together. | Organize the sidebar into a project label and recent conversations; reserve a contextual side area for output, task state, and source awareness. |
| [Google Gemini Canvas](https://blog.google/products-and-platforms/products/gemini/gemini-collaboration-features/) | Creation and revision feel more natural when a prompt-bar action can open a dedicated canvas for documents or code. | Add a Canvas switch in the composer and an optional side-panel preview state, rather than treating every response as plain chat. |

## Prototype Scope

I’m Snappy models the interaction language of contemporary AI assistants without impersonating or connecting to any of those products. It is a frontend-only, local prototype.

| Area | Included behavior |
|---|---|
| Archive rail | Create a new task, select a recent conversation, inspect a project label, or open a compact profile menu. |
| Conversation | A welcoming empty state transitions into a composed request and a structured agent response with an expandable work trace. |
| Composer | Multiline request field, attachment affordance, Canvas mode toggle, agent-mode control, voice placeholder, and submit interaction. |
| Activity strip | A visual project note plus contextual status and source-aware microcopy. It collapses at smaller breakpoints. |
| Feedback | Buttons that imply future service integrations return an explicit “Coming soon” toast; controls remain keyboard accessible. |

## Visual Translation

The supplied ElevenLabs design system governs the off-white canvas, warm ink, light editorial display typography, white card surfaces, hairline rules, pill actions, and pastel atmospheric hues. In lieu of image assets, I’m Snappy uses native radial-gradient blooms so the visual system remains purposeful and performant.
