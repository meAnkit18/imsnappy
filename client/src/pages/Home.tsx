/**
 * I’m Snappy — Quiet Intelligence design reminder
 * Editorial off-white worktable, warm ink controls, low-saturation atmospheric blooms,
 * Cormorant Garamond for display, Inter for utility, and no hard chromatic accents.
 */
import { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  ArrowUp,
  AtSign,
  Bot,
  BrainCircuit,
  ChevronDown,
  Clock3,
  FilePlus2,
  Globe2,
  LayoutPanelTop,
  Menu,
  Mic,
  Paperclip,
  Calendar as CalendarIcon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  UserRound,
  X,
} from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type AgentMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  isWorking?: boolean;
};

type AgentCalendarNote = {
  id: string;
  date: Date;
  note: string;
};

type Conversation = {
  id: string;
  title: string;
  time: string;
  tone: "mint" | "peach" | "lavender";
};

const conversations: Conversation[] = [
  { id: "brief", title: "A thoughtful launch brief", time: "Now", tone: "mint" },
  { id: "atlas", title: "Atlas research synthesis", time: "Yesterday", tone: "peach" },
  { id: "grid", title: "Grid systems for a new journal", time: "Thu", tone: "lavender" },
  { id: "letters", title: "Three partner letters", time: "Tue", tone: "mint" },
];

function PulseMark({ size = "default" }: { size?: "default" | "small" }) {
  const dimensions = size === "small" ? "h-6 w-6" : "h-9 w-9";
  return (
    <span className={`pulse-mark ${dimensions}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function IconButton({
  label,
  children,
  onClick,
  active = false,
  className = "",
  tooltipSide = "bottom",
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={`icon-button ${active ? "icon-button-active" : ""} ${className}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

function Bloom({ className }: { className: string }) {
  return <div className={`bloom pointer-events-none absolute rounded-full blur-3xl ${className}`} aria-hidden="true" />;
}

export default function Home() {
  const [selectedConversation, setSelectedConversation] = useState("brief");
  const [draft, setDraft] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [traceExpanded, setTraceExpanded] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const [canvasMode, setCanvasMode] = useState(false);
  const [conversationPanelOpen, setConversationPanelOpen] = useState(true);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [calendarDraft, setCalendarDraft] = useState("");
  const [calendarNotes, setCalendarNotes] = useState<AgentCalendarNote[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isWorking) return;
    const timer = window.setTimeout(() => {
      setIsWorking(false);
      setShowResponse(true);
      setMessages((history) => history.map((entry) => (entry.isWorking ? { ...entry, isWorking: false } : entry)));
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [isWorking]);

  const resetConversation = () => {
    setDraft("");
    setSubmittedPrompt("");
    setMessages([]);
    setShowResponse(false);
    setIsWorking(false);
    setTraceExpanded(false);
    setSelectedConversation("brief");
    setMobileRailOpen(false);
  };

  const submitPrompt = (prompt = draft) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      toast.message("Give the agent a little direction first.");
      return;
    }
    setSubmittedPrompt(cleanPrompt);
    setDraft("");
    setMessages((history) => [
      ...history.filter((entry) => !entry.isWorking),
      { id: `${Date.now()}`, role: "user", text: cleanPrompt },
      { id: `${Date.now()}-working`, role: "agent", text: cleanPrompt, isWorking: true },
    ]);
    setIsWorking(true);
    setShowResponse(false);
    setTraceExpanded(false);
    setSelectedConversation("brief");
  };

  const chooseConversation = (id: string) => {
    setSelectedConversation(id);
    setMobileRailOpen(false);
    if (id === "brief") return;
    setSubmittedPrompt(conversations.find((conversation) => conversation.id === id)?.title ?? "");
    setShowResponse(true);
    setIsWorking(false);
  };

  const activatePlaceholder = (feature: string) => {
    toast.message(`${feature} is ready for a connected agent service.`, {
      description: "This front-end prototype keeps the interaction local for now.",
    });
  };

  const activeTitle =
    selectedConversation === "brief"
      ? showResponse || isWorking
        ? "A thoughtful launch brief"
        : "New Focus"
      : conversations.find((conversation) => conversation.id === selectedConversation)?.title ?? "New Focus";

  const dateLabel = useMemo(
    () => now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    [now],
  );
  const timeLabel = useMemo(() => now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), [now]);

  const addCalendarNote = () => {
    const cleanNote = calendarDraft.trim();
    if (!cleanNote) {
      toast.message("Write a short note for the agent first.");
      return;
    }
    setCalendarNotes((notes) => [
      ...notes,
      { id: `${Date.now()}`, date: selectedDate ?? new Date(), note: cleanNote },
    ]);
    setCalendarDraft("");
    setCalendarOpen(false);
    toast.message("Note added to the agent calendar.", {
      description: "I’m Snappy will keep it in view when the day arrives.",
    });
  };

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-[#f5f5f5] text-[#0c0a09]">
      <Bloom className="-left-32 top-28 h-72 w-72 bg-[#a7e5d3]/45" />
      <Bloom className="right-[20%] top-[-5rem] h-80 w-80 bg-[#c8b8e0]/30" />

      <div className="md:hidden absolute left-4 top-4 z-40 flex items-center gap-2">
        <IconButton label="Open task archive" onClick={() => setMobileRailOpen(true)}>
          <Menu size={18} strokeWidth={1.8} />
        </IconButton>
        <button type="button" onClick={resetConversation} className="brand-lockup">
          <PulseMark size="small" />
          <span>I’m Snappy</span>
        </button>
      </div>

      <Sidebar
        conversations={conversations}
        selectedConversation={selectedConversation}
        onNewFocus={resetConversation}
        onChooseConversation={chooseConversation}
        onSearchRecent={() => activatePlaceholder("Conversation search")}
        onProfileClick={() => activatePlaceholder("Settings")}
        currentRoute="/"
      />

      {mobileRailOpen && <button type="button" aria-label="Close task archive overlay" onClick={() => setMobileRailOpen(false)} className="fixed inset-0 z-40 bg-[#0c0a09]/20 backdrop-blur-[1px] md:hidden" />}

      <section className="relative z-10 flex min-w-0 flex-1 flex-col md:min-h-dvh">
        <header className="hidden h-[76px] shrink-0 items-center justify-between px-5 md:flex md:px-8">
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="hidden text-[13px] text-[#292524] xl:inline">
              {dateLabel} <span className="text-[#8a857d]">·</span> {timeLabel}
            </span>
            <span className="hidden h-3 w-px bg-[#d6d3d1] lg:block" />
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button type="button" className="task-title-button">
                  <CalendarIcon size={14} strokeWidth={1.8} />
                  <span>Calendar</span>
                  <ChevronDown size={14} strokeWidth={1.8} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-[300px] border-[#e7e5e4] bg-white p-4 shadow-[0_12px_40px_rgba(12,10,9,0.12)]">
                <p className="rail-section-label mb-3">A note for the agent</p>
                <div className="calendar-mini">
                  <DayPicker mode="single" selected={selectedDate} onSelect={setSelectedDate} />
                </div>
                <textarea
                  value={calendarDraft}
                  onChange={(event) => setCalendarDraft(event.target.value)}
                  placeholder="Leave a reminder, a handover, anything I should know…"
                  rows={3}
                  className="w-full resize-none rounded-[9px] border border-[#e7e5e4] bg-[#fafafa] p-2.5 text-[13px] text-[#292524] placeholder:text-[#a8a29e] focus:outline-none focus:ring-2 focus:ring-[#292524]/10"
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" onClick={addCalendarNote} className="flex-1 rounded-[9px] bg-[#292524] text-[13px] hover:bg-[#0c0a09]">
                    Add to agent calendar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCalendarOpen(false)} className="rounded-[9px] border-[#e7e5e4] bg-white text-[13px] text-[#4e4e4e] hover:bg-[#f5f4f2]">
                    Close
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          {canvasMode && (
            <div className="flex items-center gap-2">
              <IconButton label={conversationPanelOpen ? "Collapse conversation panel" : "Expand conversation panel"} onClick={() => setConversationPanelOpen((current) => !current)} className="hidden xl:inline-flex">
                {conversationPanelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
              </IconButton>
            </div>
          )}
        </header>

        <div className={`relative flex min-h-0 flex-1 overflow-hidden ${canvasMode ? "canvas-mode-layout" : ""}`}>
          <section className={`relative flex min-w-0 flex-1 flex-col overflow-y-auto px-5 pb-6 pt-7 md:px-10 lg:px-14 ${canvasMode ? "canvas-center-column" : ""}`}>
            <div className={`relative mx-auto flex w-full flex-1 flex-col justify-center py-2 ${canvasMode ? "max-w-[1020px]" : "max-w-[780px]"}`}>
              {canvasMode ? (
                <CanvasWorkspace submittedPrompt={submittedPrompt} working={isWorking} />
              ) : (
                <>
                  {(showResponse || isWorking) && (
                    <ConversationView
                      submittedPrompt={submittedPrompt}
                      working={isWorking}
                      traceExpanded={traceExpanded}
                      onToggleTrace={() => setTraceExpanded((current) => !current)}
                      onTryAgain={() => submitPrompt(submittedPrompt)}
                      messages={messages}
                    />
                  )}
                </>
              )}
            </div>
            <div className={`relative mx-auto w-full pt-5 ${canvasMode ? "max-w-[1020px]" : "max-w-[780px]"}`}>
              <Composer
                draft={draft}
                setDraft={setDraft}
                onSubmit={() => submitPrompt()}
                onAttachment={() => activatePlaceholder("File attachment")}
                onVoice={() => activatePlaceholder("Voice input")}
                agentMode={agentMode}
                setAgentMode={setAgentMode}
                canvasMode={canvasMode}
                setCanvasMode={setCanvasMode}
                disabled={isWorking}
                pinned
              />
            </div>
          </section>

          {canvasMode && conversationPanelOpen && (
            <CanvasConversationPanel
              messages={messages}
              traceExpanded={traceExpanded}
              onToggleTrace={() => setTraceExpanded((current) => !current)}
              onTryAgain={() => submitPrompt(submittedPrompt)}
              onAction={activatePlaceholder}
              onClose={() => setConversationPanelOpen(false)}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function ConversationView({
  submittedPrompt,
  working,
  traceExpanded,
  onToggleTrace,
  onTryAgain,
  messages = [],
}: {
  submittedPrompt: string;
  working: boolean;
  traceExpanded: boolean;
  onToggleTrace: () => void;
  onTryAgain: () => void;
  messages?: AgentMessage[];
}) {
  return (
    <div className="animate-editorial-in mx-auto w-full max-w-[700px] pb-10 pt-4">
      <div className="flex items-start gap-4">
        <span className="user-message-avatar">AM</span>
        <div className="rounded-2xl rounded-tl-sm bg-white px-5 py-4 text-[15px] leading-7 text-[#292524] shadow-[0_4px_16px_rgba(0,0,0,0.035)] ring-1 ring-[#e7e5e4]">
          {submittedPrompt}
        </div>
      </div>

      <div className="mt-10 flex gap-4">
        <PulseMark />
        <div className="min-w-0 flex-1 pt-1">
          {working ? (
            <WorkingTrace />
          ) : (
            <>
              <p className="agent-response-label">I’m Snappy</p>
              <h2 className="display-subtitle mt-3">Here’s the shape I’d give this work.</h2>
              <p className="mt-5 max-w-[600px] text-[15px] leading-7 text-[#4e4e4e]">
                I’d start by separating the useful signal from the surrounding noise, then structure the result as a brief with evidence, choices, and an actionable next move.
              </p>

              <button type="button" onClick={onToggleTrace} className="work-trace-button mt-7">
                <span className="trace-live-dot" />
                <span>Work trace</span>
                <span className="ml-auto text-[#777169]">3 steps</span>
                <ChevronDown size={15} className={`transition-transform duration-200 ${traceExpanded ? "rotate-180" : ""}`} />
              </button>
              {traceExpanded && <WorkTrace />}

              <div className="mt-9 rounded-2xl border border-[#e7e5e4] bg-[#fff]/85 p-5">
                <p className="eyebrow">Proposed direction</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {[
                    ["Frame", "Clarify the decision this work has to support."],
                    ["Gather", "Collect grounded notes, sources, and constraints."],
                    ["Deliver", "Turn the pattern into a clean, revisable draft."],
                  ].map(([title, body], index) => (
                    <div key={title} className="border-l border-[#d6d3d1] pl-3 first:border-l-0 first:pl-0 sm:border-l sm:first:border-l-0">
                      <span className="text-[12px] text-[#777169]">0{index + 1}</span>
                      <p className="mt-2 text-[14px] font-medium text-[#292524]">{title}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#777169]">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button type="button" className="follow-up-pill" onClick={onTryAgain}><Sparkles size={14} /> Explore the sources</button>
                <button type="button" className="follow-up-pill" onClick={onTryAgain}><FilePlus2 size={14} /> Turn this into a draft</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkingTrace() {
  return (
    <div className="animate-editorial-in pt-1">
      <div className="flex items-center gap-2">
        <span className="agent-pulse"><i /><i /><i /></span>
        <span className="text-[14px] font-medium text-[#292524]">Working through the brief</span>
      </div>
      <div className="mt-6 space-y-3">
        {[
          ["Parsing the objective", "The key question is taking shape."],
          ["Finding useful angles", "Looking for the clearest supporting material."],
          ["Structuring a response", "Keeping the first draft concise and revisable."],
        ].map(([title, description], index) => (
          <div key={title} className="working-step">
            <span className={`working-step-number ${index === 0 ? "working-step-complete" : ""}`}>{index === 0 ? "✓" : index + 1}</span>
            <div>
              <p className="text-[13px] font-medium text-[#292524]">{title}</p>
              <p className="mt-0.5 text-[12px] text-[#777169]">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkTrace({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="mt-2 space-y-1.5">
        {["Scan the field", "Test the frame", "Compose the output"].map((title, index) => (
          <p key={title} className="text-[11px] text-[#777169]">
            <span className="text-[#a8a29e]">0{index + 1}</span> · {title}
          </p>
        ))}
      </div>
    );
  }
  const traceSteps = [
    { icon: Globe2, title: "Scan the field", body: "A wide first pass keeps the brief from narrowing too soon." },
    { icon: BrainCircuit, title: "Test the frame", body: "Organize observations into points of decision rather than a dump of notes." },
    { icon: LayoutPanelTop, title: "Compose the output", body: "Prepare a concise surface that can become a canvas or a polished draft." },
  ];

  return (
    <div className="animate-card-in overflow-hidden rounded-b-xl border-x border-b border-[#e7e5e4] bg-white/70">
      {traceSteps.map(({ icon: StepIcon, title, body }, index) => {
        return (
          <div key={title} className="flex gap-3 border-b border-[#f0efed] px-4 py-4 last:border-0">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0efed] text-[#292524]"><StepIcon size={14} strokeWidth={1.6} /></span>
            <div>
              <p className="text-[13px] font-medium text-[#292524]">0{index + 1} · {title}</p>
              <p className="mt-1 text-[12px] leading-5 text-[#777169]">{body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  onSubmit,
  onAttachment,
  onVoice,
  agentMode,
  setAgentMode,
  canvasMode,
  setCanvasMode,
  disabled,
  variant = "default",
  pinned = false,
}: {
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: () => void;
  onAttachment: () => void;
  onVoice: () => void;
  agentMode: boolean;
  setAgentMode: (value: boolean) => void;
  canvasMode: boolean;
  setCanvasMode: (value: boolean) => void;
  disabled: boolean;
  variant?: "default" | "sidebar";
  pinned?: boolean;
}) {
  return (
    <div className={`composer-anchor ${variant === "sidebar" ? "canvas-chat-composer" : pinned ? "composer-pinned" : "mx-auto mt-5 w-full max-w-[780px] shrink-0"}`}>
      <div className="composer-shell">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="What shall we make sense of?"
          rows={2}
          disabled={disabled}
          className="composer-input"
          aria-label="Message I’m Snappy"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <div className="flex items-center gap-1">
            <IconButton label="Attach a file" onClick={onAttachment}><Paperclip size={17} /></IconButton>
            <IconButton label="Mention a source" onClick={() => toast.message("Connected sources will appear here.")}><AtSign size={17} /></IconButton>
            <IconButton label="Use voice input" onClick={onVoice}><Mic size={17} /></IconButton>
            <span className="mx-1 hidden h-4 w-px bg-[#d6d3d1] sm:block" />
            <button type="button" onClick={() => setCanvasMode(!canvasMode)} className={`composer-mode ${canvasMode ? "composer-mode-active" : ""}`}>
              <LayoutPanelTop size={14} /> Canvas
            </button>
            <button type="button" onClick={() => setAgentMode(!agentMode)} className={`composer-mode hidden sm:inline-flex ${agentMode ? "composer-mode-active" : ""}`}>
              <span className="agent-pulse" aria-hidden="true"><i /><i /><i /></span> Agent
            </button>
          </div>
          <button type="button" onClick={onSubmit} disabled={disabled} className="send-button" aria-label="Send message">
            {disabled ? <Square size={14} fill="currentColor" /> : <ArrowUp size={18} strokeWidth={2} />}
          </button>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-[#a8a29e]">
        I’m Snappy can make mistakes. Review important work before using it.
      </p>
    </div>
  );
}

function CanvasWorkspace({ submittedPrompt, working }: { submittedPrompt: string; working: boolean }) {
  const [canvasText, setCanvasText] = useState(() => `# ${submittedPrompt || "Untitled working canvas"}\n\n## The useful signal\n\nClarify the decision this work needs to support. Keep the brief grounded, concise, and open to revision.\n\n## Working direction\n\n1. Frame the question beneath the request.\n2. Gather only the evidence that changes the decision.\n3. Shape the result into a clear, useful draft.`);

  useEffect(() => {
    if (!submittedPrompt) return;
    setCanvasText(`# ${submittedPrompt}\n\n## The useful signal\n\nClarify the decision this work needs to support. Keep the brief grounded, concise, and open to revision.\n\n## Working direction\n\n1. Frame the question beneath the request.\n2. Gather only the evidence that changes the decision.\n3. Shape the result into a clear, useful draft.`);
  }, [submittedPrompt]);

  return (
    <article className="canvas-workspace animate-editorial-in">
      <Bloom className="-left-16 top-14 h-52 w-52 bg-[#a7e5d3]/35" />
      <Bloom className="right-3 top-[-3rem] h-48 w-48 bg-[#c8b8e0]/30" />
      <div className="canvas-folio-header relative">
        <span className="canvas-folio-label"><LayoutPanelTop size={14} /> Canvas</span>
        <span className="canvas-folio-state">{working ? "Drafting" : "Live draft"}</span>
      </div>
      <div className="canvas-sheet relative">
        <div className="canvas-sheet-margin">
          <span>01</span>
          <span>Brief</span>
          <span>Private</span>
        </div>
        <textarea
          value={canvasText}
          onChange={(event) => setCanvasText(event.target.value)}
          className="canvas-editor"
          aria-label="Canvas working draft"
          spellCheck
        />
        <div className="canvas-sheet-footer">
          <span><i /><i /><i /></span>
          <span>Changes are held in this working canvas</span>
        </div>
      </div>
    </article>
  );
}

function CanvasConversationPanel({
  messages,
  onToggleTrace,
  traceExpanded,
  onTryAgain,
  onAction,
  onClose,
}: {
  messages: AgentMessage[];
  onToggleTrace: () => void;
  traceExpanded: boolean;
  onTryAgain: () => void;
  onAction: (feature: string) => void;
  onClose: () => void;
}) {
  const working = messages.some((entry) => entry.isWorking);
  return (
    <aside className="canvas-conversation-panel relative flex shrink-0 flex-col overflow-hidden border-l border-[#e7e5e4] bg-[#fafafa]/80" aria-label="Canvas conversation and agent actions">
      <div className="relative flex h-full min-h-0 flex-col">
        <Bloom className="-left-16 top-0 h-40 w-40 bg-[#c8b8e0]/45" />
        <div className="flex items-center justify-between border-b border-[#f0efed] px-5 py-4">
          <div>
            <p className="eyebrow">Conversation</p>
            <p className="mt-1 text-[11px] text-[#8a857d]">Chat and agent actions</p>
            <button type="button" onClick={onClose} className="text-[#777169] transition-colors hover:text-[#0c0a09]" aria-label="Collapse conversation panel"><PanelRightClose size={16} /></button>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-[#a8a29e]">
            {working && <span className="agent-pulse" aria-hidden="true"><i /><i /><i /></span>}
            {messages.length > 0 ? `${Math.ceil(messages.length / 2)} pair${Math.ceil(messages.length / 2) === 1 ? "" : "s"}` : "Awaiting a message"}
          </span>
        </div>

        <div className="canvas-conversation-thread flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <div className="canvas-thread-empty">
              <PulseMark size="small" />
              <p>Start a conversation to give this canvas direction.</p>
              <span>Questions, replies, traces, and next actions will gather here.</span>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.filter((entry) => !entry.isWorking).map((message) => (
                <div key={message.id}>
                  {message.role === "user" ? (
                    <div className="canvas-thread-user">
                      <span className="user-message-avatar user-message-avatar-small">AM</span>
                      <p className="min-w-0 text-[13px] leading-6 text-[#4e4e4e]">{message.text}</p>
                    </div>
                  ) : (
                    <div className="canvas-thread-agent">
                      <div className="flex items-center gap-2">
                        <span className="agent-pulse-small"><i /><i /><i /></span>
                        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#777169]">I’m Snappy</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[#292524]">
                        I’d start by separating the useful signal from the surrounding noise, then structure the result as a brief with evidence, choices, and an actionable next move.
                      </p>
                      <button type="button" onClick={onToggleTrace} className="canvas-work-trace mt-4">
                        <span className="trace-live-dot" />
                        <span>Work trace</span>
                        <span className="ml-auto text-[#777169]">3 steps</span>
                        <ChevronDown size={13} className={`transition-transform duration-200 ${traceExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {traceExpanded && <WorkTrace compact />}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" className="follow-up-pill" onClick={onTryAgain}><Sparkles size={13} /> Continue</button>
                        <button type="button" className="follow-up-pill" onClick={() => onAction("Create a new canvas draft")}><FilePlus2 size={13} /> Make draft</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {working && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="agent-pulse-small"><i /><i /><i /></span>
                  <span className="text-[12px] text-[#777169]">I’m Snappy is thinking…</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="canvas-conversation-actions border-t border-[#e7e5e4] bg-white/60 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Agent actions</p>
            <button type="button" onClick={() => onAction("Canvas task details")} className="text-[11px] text-[#777169] hover:text-[#0c0a09]">Trace</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAction("Research sources")} className="canvas-action-card"><Globe2 size={14} /> Research</button>
            <button type="button" onClick={() => onAction("Canvas outline")} className="canvas-action-card"><LayoutPanelTop size={14} /> Outline</button>
          </div>
        </div>
      </div>
    </aside>
  );
}


