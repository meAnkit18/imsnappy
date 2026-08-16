/**
 * I’m Snappy — Quiet Intelligence design reminder
 * Editorial off-white worktable, warm ink controls, low-saturation atmospheric blooms,
 * Cormorant Garamond for display, Inter for utility, and no hard chromatic accents.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import {
  ArrowUp,
  AtSign,
  Bot,
  BrainCircuit,
  ChevronDown,
  Clock3,
  ExternalLink,
  FilePlus2,
  Globe2,
  LayoutPanelTop,
  Menu,
  Minimize2,
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

import {
  listConversations,
  loadConversation,
  saveConversation,
  readPreferences,
  savePreferences,
  type StoredConversation,
  type StoredMessage,
} from "@/lib/localStore";
import { FREE_MODELS, localEchoReply, streamCompletion } from "@/lib/agent";
import {
  isSandboxPreviewRequest,
  readSandboxPreviewArtifact,
  sandboxPreviewCompletionMessage,
  readSandboxLifecycle,
  formatToolRequest,
  formatToolResult,
  type SandboxPreviewArtifact,
  type SandboxLifecycleEvent,
  type WorkTraceEntry,
} from "@/lib/sandboxPreview";
import { listSessions, saveSession, type StoredSession } from "@/lib/localStore";
import { Terminal, Power, RefreshCw } from "lucide-react";

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
  const [sandboxPreview, setSandboxPreview] = useState<SandboxPreviewArtifact | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [liveDraft, setLiveDraft] = useState("");
  const [workTrace, setWorkTrace] = useState<WorkTraceEntry[]>([]);
  const [sandboxLifecycle, setSandboxLifecycle] = useState<SandboxLifecycleEvent | null>(null);
  const [canvasState, setCanvasState] = useState<"off" | "minimized" | "maximized">("off");
  const [recentSessions, setRecentSessions] = useState<StoredSession[]>(() => listSessions());
  const sessionRef = useRef<StoredSession | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(() => Boolean(localStorage.getItem("imsnappy:opencode_key")));
  const [modelError, setModelError] = useState<string | null>(null);
  const [preferences] = useState(() => readPreferences());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Thread autoscroll while the agent streams.
  useEffect(() => {
    if (!threadRef.current || !isWorking) return;
    const element = threadRef.current;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 180) element.scrollTop = element.scrollHeight;
  }, [liveDraft, isWorking]);

  // Load an existing conversation from the local store when choosing from the rail.
  const loadLocalConversation = useCallback((id: string) => {
    const stored = loadConversation(id);
    if (!stored) return;
    setActiveConversationId(id);
    setMessages(stored.messages.map((entry) => ({ id: entry.id, role: entry.role, text: entry.text })));
    setSubmittedPrompt(stored.title);
    setShowResponse(true);
    setIsWorking(false);
    setModelError(null);
  }, []);

  const persistConversation = useCallback(
    (messageHistory: StoredMessage[], title: string) => {
      const id = activeConversationId ?? `conv-${Date.now()}`;
      const conversation: StoredConversation = {
        id,
        title,
        tone: conversations[Math.floor(Math.random() * 3)].tone ?? "mint",
        createdAt: messageHistory[0]?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: messageHistory,
      };
      saveConversation(conversation);
      setActiveConversationId(id);
    },
    [activeConversationId],
  );

  const resetConversation = () => {
    abortRef.current?.abort();
    setDraft("");
    setSubmittedPrompt("");
    setMessages([]);
    setActiveConversationId(null);
    setLiveDraft("");
    setModelError(null);
    setShowResponse(false);
    setIsWorking(false);
    setTraceExpanded(false);
    setSandboxPreview(null);
    setPreviewPending(false);
    setSelectedConversation("brief");
    setMobileRailOpen(false);
    setCanvasState("off");
    setWorkTrace([]);
    setSandboxLifecycle(null);
  };

  const submitPrompt = (prompt = draft) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      toast.message("Give the agent a little direction first.");
      return;
    }
    abortRef.current?.abort();
    const userMessage: StoredMessage = { id: `msg-${Date.now()}`, role: "user", text: cleanPrompt, createdAt: new Date().toISOString() };
    const agentMessage: StoredMessage = { id: `msg-${Date.now()}-agent`, role: "agent", text: "", createdAt: new Date().toISOString() };

    setSubmittedPrompt(cleanPrompt);
    setDraft("");
    setModelError(null);
    setSandboxPreview(null);
    const expectsPreview = isSandboxPreviewRequest(cleanPrompt);
    setPreviewPending(expectsPreview);
    setWorkTrace([]);
    setSandboxLifecycle(null);
    sessionRef.current = null;
    setShowResponse(true);
    setTraceExpanded(false);
    setSelectedConversation("brief");
    setIsWorking(true);
    setMessages((history) => [
      ...history.filter((entry) => !entry.isWorking),
      userMessage,
      { id: agentMessage.id, role: "agent", text: "", isWorking: true },
    ]);

    const historySnapshot = [
      { role: "system" as const, text: "You are I'm Snappy, a calm, editorial research agent. Reply concisely in one or two short paragraphs with a working direction." },
      ...messages.filter((entry) => !entry.isWorking).map((entry) => ({ role: entry.role, text: entry.text })),
      { role: "user" as const, text: cleanPrompt },
    ];

    const apiKey = localStorage.getItem("imsnappy:opencode_key") ?? "";
    const isReal = apiKey.length > 12;
    setHasApiKey(isReal);

    let accumulated = "";
    let artifactCompletion = "";
    let didFinish = false;
    let lastArtifact: SandboxPreviewArtifact | null = null;
    const currentSession: Partial<StoredSession> | null = expectsPreview
      ? { id: `sess-${Date.now()}`, conversationId: `conv-${Date.now()}`, prompt: cleanPrompt }
      : null;
    const finish = () => {
      if (didFinish) return;
      didFinish = true;
      const resolved: StoredMessage = { ...agentMessage, text: accumulated || "I wasn't able to produce a response. Please try again." };
      const previousMessages = messages
        .filter((entry) => !entry.isWorking)
        .map((entry) => ({ id: entry.id, role: entry.role, text: entry.text, createdAt: new Date().toISOString() }));
      setMessages((history) =>
        history.map((entry) => (entry.id === agentMessage.id ? { ...entry, isWorking: false, text: resolved.text } : entry)),
      );
      setIsWorking(false);
      setLiveDraft("");
      setPreviewPending(false);
      persistConversation([...previousMessages, userMessage, resolved], cleanPrompt);
      if (currentSession && currentSession.artifactId) {
        const session: StoredSession = {
          id: currentSession.id ?? `sess-${Date.now()}`,
          conversationId: currentSession.conversationId ?? `conv-${Date.now()}`,
          artifactId: currentSession.artifactId,
          name: currentSession.name ?? "Untitled preview",
          url: currentSession.url ?? "",
          origin: currentSession.origin,
          kind: currentSession.kind,
          prompt: currentSession.prompt ?? cleanPrompt,
          createdAt: new Date().toISOString(),
          expiresAt: currentSession.expiresAt,
          traceCount: workTrace.length,
        };
        saveSession(session);
        setRecentSessions(listSessions());
        sessionRef.current = session;
      }
    };

    const addTraceEntry = (kind: WorkTraceEntry["kind"], label: string, detail?: string, status: WorkTraceEntry["status"] = "done") => {
      setWorkTrace((current) => [
        ...current,
        { id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, occurredAt: new Date().toISOString(), kind, label, detail, status },
      ]);
    };

    const sandboxLifecycleLabel = (event: SandboxLifecycleEvent): string => {
      if (event.state === "started") return "Sandbox started";
      if (event.state === "running") return "Sandbox running";
      if (event.state === "stopping") return "Sandbox stopping";
      if (event.state === "expired") return "Sandbox expired";
      return "Sandbox error";
    };

    const startLocalFallback = (reason?: string) => {
      if (reason) {
        setModelError(reason);
        toast.message("Using the local working reply", {
          description: "Add or refresh your OpenCode key in Settings to use the live model.",
        });
      }
      const cancelEcho = localEchoReply(cleanPrompt, {
        onDelta: (chunk) => {
          accumulated += chunk;
          setLiveDraft(accumulated);
          setMessages((history) =>
            history.map((entry) => (entry.id === agentMessage.id ? { ...entry, text: entry.text + chunk } : entry)),
          );
        },
        onComplete: finish,
        onError: () => {
          setMessages((history) => history.filter((entry) => entry.id !== agentMessage.id));
          setIsWorking(false);
        },
      });
      (window as unknown as { __snappyCancelEcho?: () => void }).__snappyCancelEcho = cancelEcho;
    };

    const controller = new AbortController();
    abortRef.current = controller;

    const updateDelta = (chunk: string) => {
      accumulated += chunk;
      setLiveDraft(accumulated);
      setMessages((history) =>
        history.map((entry) => (entry.id === agentMessage.id ? { ...entry, text: entry.text + chunk } : entry)),
      );
    };

    const chatMessages = historySnapshot.map((entry) => ({
      role: entry.role,
      content: entry.text,
    }));

    fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        modelId: preferences.model === "deepseek-v4-flash-free" ? "hy3-free" : (preferences.model || "hy3-free"),
        messages: chatMessages,
        temperature: preferences.temperature ?? 0.6,
        maxTokens: preferences.maxTokens ?? 2048,
      }),
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          const errorText = await response.text().catch(() => String(response.status));
          throw new Error(`Chat service error ${response.status}: ${errorText.slice(0, 200)}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            if (data.startsWith(":")) continue;
            let parsed: { type?: string; payload?: Record<string, unknown> };
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }
            if (parsed.type === "run.delta" && typeof parsed.payload?.text === "string") {
              updateDelta(parsed.payload.text);
            } else if (parsed.type === "run.trace" && typeof parsed.payload?.label === "string") {
              addTraceEntry("trace", parsed.payload.label as string);
            } else if (parsed.type === "run.tool_request") {
              const formatted = formatToolRequest(parsed.payload?.tool, parsed.payload?.args);
              addTraceEntry("tool", formatted.label, formatted.detail, "running");
            } else if (parsed.type === "run.tool_result") {
              const formatted = formatToolResult(parsed.payload?.tool, parsed.payload?.result, parsed.payload?.error);
              const sandbox = parsed.payload?.sandbox === true;
              addTraceEntry(sandbox ? "sandbox" : "tool", formatted.label, formatted.detail, formatted.status);
            } else if (parsed.type === "run.sandbox") {
              const lifecycle = readSandboxLifecycle(parsed.payload);
              if (lifecycle) {
                setSandboxLifecycle(lifecycle);
                addTraceEntry("sandbox", sandboxLifecycleLabel(lifecycle), lifecycle.error, lifecycle.state === "error" ? "error" : lifecycle.state === "running" ? "done" : "running");
                if (lifecycle.state === "started") setCanvasState((current) => (current === "off" ? "minimized" : current));
              }
            } else if (parsed.type === "run.artifact") {
              const artifact = readSandboxPreviewArtifact(parsed.payload);
              if (artifact) {
                artifactCompletion = sandboxPreviewCompletionMessage(artifact);
                setSandboxPreview(artifact);
                setPreviewPending(false);
                lastArtifact = artifact;
                setCanvasState((current) => (current === "off" || current === "minimized" ? "maximized" : current));
                setConversationPanelOpen(true);
                if (currentSession) {
                  currentSession.artifactId = artifact.artifactId;
                  currentSession.name = artifact.name;
                  currentSession.url = artifact.url;
                  currentSession.origin = artifact.origin;
                  currentSession.kind = artifact.kind;
                  currentSession.expiresAt = artifact.expiresAt;
                }
                toast.success("Interactive preview opened in Canvas", { description: "Click the preview to take control." });
              }
            } else if (parsed.type === "run.completed") {
              setPreviewPending(false);
              if (!accumulated && artifactCompletion) updateDelta(artifactCompletion);
              finish();
            } else if (parsed.type === "run.failed") {
              setPreviewPending(false);
              if (!accumulated && artifactCompletion) {
                updateDelta(artifactCompletion);
                finish();
              } else if (!accumulated) startLocalFallback(parsed.payload?.message as string);
              else finish();
            }
          }
        }
        if (!accumulated && artifactCompletion) updateDelta(artifactCompletion);
        if (accumulated || artifactCompletion) finish();
        else startLocalFallback("The chat service returned no content.");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (accumulated) {
          finish();
          return;
        }
        startLocalFallback(error instanceof Error ? error.message : "Network error");
      });
  };

  const chooseConversation = (id: string) => {
    setSelectedConversation(id);
    setMobileRailOpen(false);
    if (id === "brief") {
      resetConversation();
      return;
    }
    loadLocalConversation(id);
  };

  const activatePlaceholder = (feature: string) => {
    toast.message(`${feature} is ready for a connected agent service.`, {
      description: "Chat, Library, Settings, and schedules are already functional in this preview.",
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
          {canvasState === "maximized" && (
            <div className="flex items-center gap-2">
              <IconButton label={conversationPanelOpen ? "Collapse conversation panel" : "Expand conversation panel"} onClick={() => setConversationPanelOpen((current) => !current)} className="hidden xl:inline-flex">
                {conversationPanelOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
              </IconButton>
            </div>
          )}
        </header>

        <div className={`relative flex min-h-0 flex-1 overflow-hidden ${canvasState === "maximized" ? "canvas-mode-layout" : ""}`}>
          <section className={`relative flex min-w-0 flex-1 flex-col overflow-hidden px-5 pt-7 md:px-10 lg:px-14 ${canvasState === "maximized" ? "canvas-center-column" : ""}`}>
            <div className={`relative mx-auto flex w-full flex-1 min-h-0 flex-col justify-center py-2 ${canvasState === "maximized" ? "max-w-[1020px]" : "max-w-[780px]"}`}>
              {canvasState === "maximized" ? (
                <CanvasWorkspace
                  submittedPrompt={submittedPrompt}
                  working={isWorking}
                  preview={sandboxPreview}
                  previewPending={previewPending}
                  lifecycle={sandboxLifecycle}
                  workTrace={workTrace}
                  onMinimize={() => setCanvasState("minimized")}
                  onClose={() => { setCanvasState("off"); setSandboxPreview(null); }}
                  onOpenInTab={() => sandboxPreview && window.open(sandboxPreview.url, "_blank", "noopener")}
                  onRestorePreview={() => sandboxPreview && setSandboxPreview({ ...sandboxPreview })}
                />
              ) : (
                <>
                  {!showResponse && !isWorking && (
                    <WelcomeState onChoosePrompt={setDraft} />
                  )}
                  {(showResponse || isWorking) && (
                    <ConversationView
                      submittedPrompt={submittedPrompt}
                      working={isWorking}
                      onTryAgain={() => submitPrompt(submittedPrompt)}
                      messages={messages}
                    />
                  )}
                </>
              )}
            </div>
            {canvasState === "minimized" && (
              <MinimizedCanvasBar
                preview={sandboxPreview}
                lifecycle={sandboxLifecycle}
                onRestore={() => setCanvasState("maximized")}
                onClose={() => { setCanvasState("off"); setSandboxPreview(null); }}
              />
            )}
            <div className={`relative mx-auto w-full shrink-0 pb-6 ${canvasState === "maximized" ? "max-w-[1020px]" : "max-w-[780px]"}`}>
              <Composer
                draft={draft}
                setDraft={setDraft}
                onSubmit={() => submitPrompt()}
                onAttachment={() => activatePlaceholder("File attachment")}
                onVoice={() => activatePlaceholder("Voice input")}
                agentMode={agentMode}
                setAgentMode={setAgentMode}
                disabled={isWorking}
                pinned
              />
            </div>
          </section>

          {canvasState === "maximized" && conversationPanelOpen && (
            <CanvasConversationPanel
              threadRef={threadRef}
              messages={messages}
              workTrace={workTrace}
              lifecycle={sandboxLifecycle}
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

function WelcomeState({ onChoosePrompt }: { onChoosePrompt: (prompt: string) => void }) {
  const promptStarters = [
    { index: "01", title: "Shape a decision", body: "Turn a tangle of notes into the next clear move.", prompt: "Help me frame the decision I need to make." },
    { index: "02", title: "Trace the pattern", body: "Find the useful signal across a set of ideas or sources.", prompt: "Help me identify the pattern in these notes." },
    { index: "03", title: "Draft the first pass", body: "Give a working brief room to become a useful draft.", prompt: "Help me write a considered first draft." },
  ];

  return (
    <div className="welcome-composition animate-editorial-in mx-auto w-full max-w-[720px] pb-12 pt-4">
      <div className="welcome-margin-note" aria-hidden="true">
        <span>Field note</span>
        <span>Ready</span>
      </div>
      <div className="welcome-wordmark">
        <PulseMark />
        <span>I’m Snappy</span>
      </div>
      <p className="eyebrow mt-9">A calm working room</p>
      <h1 className="welcome-title">Give the brief<br />a little room to think.</h1>
      <p className="mt-5 max-w-[470px] text-[14px] leading-6 text-[#68635d]">
        Bring a question, a rough direction, or a stack of notes. I’ll help find the signal and turn it into considered work.
      </p>
      <div className="welcome-prompt-list mt-10 grid gap-px border border-[#e7e5e4] bg-[#e7e5e4] sm:grid-cols-3">
        {promptStarters.map((starter) => (
          <button key={starter.title} type="button" onClick={() => onChoosePrompt(starter.prompt)} className="welcome-prompt-card text-left">
            <span className="card-folio-index">{starter.index}</span>
            <Sparkles size={16} strokeWidth={1.5} />
            <span className="mt-8 block font-serif text-[23px] font-light leading-none tracking-[-0.03em] text-[#292524]">{starter.title}</span>
            <span className="mt-3 block text-[12px] leading-5 text-[#777169]">{starter.body}</span>
          </button>
        ))}
      </div>
      <p className="welcome-footnote mt-5">Start with a plain sentence. The agent will help you find the useful shape.</p>
    </div>
  );
}

function ConversationView({
  submittedPrompt,
  working,
  onTryAgain,
  messages = [],
}: {
  submittedPrompt: string;
  working: boolean;
  onTryAgain: () => void;
  messages?: AgentMessage[];
}) {
  return (
    <div className="animate-editorial-in mx-auto w-full max-w-[700px] pb-10 pt-4">
      {messages.length === 0 && submittedPrompt && (
        <div className="flex items-start gap-4">
          <span className="user-message-avatar">AM</span>
          <div className="rounded-2xl rounded-tl-sm bg-white px-5 py-4 text-[15px] leading-7 text-[#292524] shadow-[0_4px_16px_rgba(0,0,0,0.035)] ring-1 ring-[#e7e5e4]">
            {submittedPrompt}
          </div>
        </div>
      )}

      <div className="mt-10 space-y-8">
        {messages.filter((entry) => !entry.isWorking).map((message) => (
          <div key={message.id} className="animate-editorial-in">
            {message.role === "user" ? (
              <div className="flex items-start gap-4">
                <span className="user-message-avatar">AM</span>
                <div className="rounded-2xl rounded-tl-sm bg-white px-5 py-4 text-[15px] leading-7 text-[#292524] shadow-[0_4px_16px_rgba(0,0,0,0.035)] ring-1 ring-[#e7e5e4]">
                  {message.text}
                </div>
              </div>
            ) : (
              <div className="flex gap-4">
                <PulseMark size="small" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="agent-response-label">I’m Snappy</p>
                  <p className="mt-3 max-w-[640px] whitespace-pre-wrap text-[15px] leading-7 text-[#4e4e4e]">
                    {message.text || ""}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
        {working && (
          <div className="animate-editorial-in flex gap-4">
            <PulseMark size="small" />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="agent-response-label">I’m Snappy</p>
              <p className="mt-3 max-w-[640px] whitespace-pre-wrap text-[15px] leading-7 text-[#4e4e4e]">
                {messages.find((entry) => entry.isWorking)?.text ?? ""}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#8a857d]">
                <span className="agent-pulse-small"><i /><i /><i /></span> Writing the response
              </span>
            </div>
          </div>
        )}
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

function CanvasWorkspace({
  submittedPrompt,
  working,
  preview,
  previewPending,
  lifecycle,
  workTrace,
  onMinimize,
  onClose,
  onOpenInTab,
  onRestorePreview,
}: {
  submittedPrompt: string;
  working: boolean;
  preview: SandboxPreviewArtifact | null;
  previewPending: boolean;
  lifecycle: SandboxLifecycleEvent | null;
  workTrace: WorkTraceEntry[];
  onMinimize: () => void;
  onClose: () => void;
  onOpenInTab: () => void;
  onRestorePreview: () => void;
}) {
  const [canvasText, setCanvasText] = useState(() => `# ${submittedPrompt || "Untitled working canvas"}\n\n## The useful signal\n\nClarify the decision this work needs to support. Keep the brief grounded, concise, and open to revision.\n\n## Working direction\n\n1. Frame the question beneath the request.\n2. Gather only the evidence that changes the decision.\n3. Shape the result into a clear, useful draft.`);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => {
    if (!submittedPrompt) return;
    setCanvasText(`# ${submittedPrompt}\n\n## The useful signal\n\nClarify the decision this work needs to support. Keep the brief grounded, concise, and open to revision.\n\n## Working direction\n\n1. Frame the question beneath the request.\n2. Gather only the evidence that changes the decision.\n3. Shape the result into a clear, useful draft.`);
  }, [submittedPrompt]);

  useEffect(() => {
    setPreviewLoaded(false);
  }, [preview?.artifactId]);

  return (
    <article className="canvas-workspace animate-editorial-in">
      <Bloom className="-left-16 top-14 h-52 w-52 bg-[#a7e5d3]/35" />
      <Bloom className="right-3 top-[-3rem] h-48 w-48 bg-[#c8b8e0]/30" />
      <div className="canvas-folio-header relative">
        <span className="canvas-folio-label"><LayoutPanelTop size={14} /> {preview || previewPending ? "Live sandbox" : "Canvas"}</span>
        <span className="canvas-folio-state">{preview ? (previewLoaded ? "Interactive" : "Loading preview") : previewPending ? "Starting sandbox" : working ? "Drafting" : "Live draft"}</span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={onMinimize} className="canvas-preview-action" aria-label="Minimize canvas"><Minimize2 size={13} /></button>
          <button type="button" onClick={onClose} className="canvas-preview-action" aria-label="Close canvas"><X size={13} /></button>
        </span>
      </div>
      {preview ? (
        <div className="canvas-preview-shell relative">
            <div className="canvas-preview-toolbar">
            <div className="min-w-0"><p className="canvas-preview-title">{preview.name.replace(/\.html$/i, "")}</p><p>Running in an ephemeral sandbox · Click inside to interact{sandboxStatusCopy(lifecycle) ? ` · ${sandboxStatusCopy(lifecycle)}` : ""}</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => previewFrameRef.current?.focus()} className="canvas-preview-action">Focus</button>
              <button type="button" onClick={onRestorePreview} className="canvas-preview-action" title="Re-focus the preview">Refresh</button>
              <button type="button" onClick={onOpenInTab} className="canvas-preview-action"><ExternalLink size={13} /> Open</button>
            </div>
          </div>
          {!previewLoaded && <div className="canvas-preview-loading" role="status"><span className="agent-pulse"><i /><i /><i /></span><span>Starting the sandbox preview…</span></div>}
          <iframe
            ref={previewFrameRef}
            title={`Interactive preview: ${preview.name}`}
            src={preview.url}
            sandbox="allow-scripts allow-forms allow-same-origin allow-downloads"
            referrerPolicy="no-referrer"
            onLoad={() => setPreviewLoaded(true)}
            className={`canvas-preview-frame ${previewLoaded ? "canvas-preview-frame-ready" : ""}`}
          />
          <div className="canvas-preview-footer"><span>{preview.expiresAt ? <ExpiryCountdown expiresAt={preview.expiresAt} /> : "Preview is temporary"}</span><span>Keyboard input is sent to the focused preview</span></div>
        </div>
      ) : previewPending ? (
        <div className="canvas-preview-shell relative" role="status" aria-live="polite">
          <div className="canvas-preview-toolbar"><div><p className="canvas-preview-title">Preparing your interactive artifact</p><p>Creating a browser-ready build in an ephemeral sandbox</p></div></div>
          <div className="canvas-preview-pending"><span className="agent-pulse"><i /><i /><i /></span><p>Snappy is writing the project, starting its local server, and connecting the preview.</p><span>This panel will become interactive as soon as the sandbox is ready.</span></div>
        </div>
      ) : (
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
      )}
    </article>
  );
}

function CanvasConversationPanel({
  messages,
  workTrace,
  lifecycle,
  onToggleTrace,
  traceExpanded,
  onTryAgain,
  onAction,
  onClose,
  threadRef,
}: {
  threadRef?: React.RefObject<HTMLDivElement | null>;
  messages: AgentMessage[];
  workTrace: WorkTraceEntry[];
  lifecycle: SandboxLifecycleEvent | null;
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

        <div ref={threadRef} className="canvas-conversation-thread flex-1 overflow-y-auto px-5 py-5">
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
                      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-[#292524]">
                        {message.text || "The sandbox result is preparing."}
                      </p>
                      <button type="button" onClick={onToggleTrace} className="canvas-work-trace mt-4">
                        <span className="trace-live-dot" />
                        <span>Work trace</span>
                        <span className="ml-auto text-[#777169]">{workTrace.length > 0 ? `${workTrace.length} step${workTrace.length === 1 ? "" : "s"}` : "0 steps"}</span>
                        <ChevronDown size={13} className={`transition-transform duration-200 ${traceExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {traceExpanded && <LiveWorkTrace entries={workTrace} lifecycle={lifecycle} />}
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
          {lifecycle && <SandboxLifecyclePanel lifecycle={lifecycle} />}
        </div>
      </div>
    </aside>
  );
}

function sandboxStatusCopy(lifecycle: SandboxLifecycleEvent | null): string {
  if (!lifecycle) return "";
  if (lifecycle.state === "started") return "Sandbox booting";
  if (lifecycle.state === "running") return "Sandbox running";
  if (lifecycle.state === "stopping") return "Sandbox stopping";
  if (lifecycle.state === "expired") return "Sandbox expired";
  if (lifecycle.state === "error") return "Sandbox error";
  return "";
}

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const expires = new Date(expiresAt).getTime();
  const remaining = Math.max(0, expires - now.getTime());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  if (remaining <= 0) return <span>Expired</span>;
  return <span>Expires in {minutes}m {String(seconds).padStart(2, "0")}s</span>;
}

function LiveWorkTrace({ entries, lifecycle }: { entries: WorkTraceEntry[]; lifecycle: SandboxLifecycleEvent | null }) {
  return (
    <div className="mt-2 space-y-1">
      {lifecycle && lifecycle.state !== "running" && lifecycle.state !== "started" && (
        <p className={`text-[11px] ${lifecycle.state === "error" ? "text-[#a65d57]" : "text-[#a8a29e]"}`}>
          <Terminal size={10} className="mr-1 inline" /> Sandbox {lifecycle.state}{lifecycle.error ? ` — ${lifecycle.error}` : ""}
        </p>
      )}
      {entries.length === 0 && <p className="text-[11px] text-[#a8a29e]">Steps will appear here as Snappy works.</p>}
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-baseline gap-2">
          <span className={`shrink-0 text-[10px] ${entry.status === "error" ? "text-[#a65d57]" : entry.status === "running" ? "text-[#8a857d]" : "text-[#a8a29e]"}`}>
            {entry.status === "done" ? "✓" : entry.status === "error" ? "✕" : "·"}
          </span>
          <p className={`min-w-0 text-[11px] leading-5 ${entry.status === "error" ? "text-[#a65d57]" : "text-[#777169]"}`}>
            {entry.label}
            {entry.detail ? <span className="block truncate font-mono text-[10px] text-[#a8a29e]">{entry.detail}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function SandboxLifecyclePanel({ lifecycle }: { lifecycle: SandboxLifecycleEvent }) {
  return (
    <div className="mt-3 rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-2.5">
      <p className="eyebrow">Sandbox lifecycle</p>
      <p className="mt-1 flex items-center gap-2 text-[12px] text-[#4e4e4e]">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${lifecycle.state === "running" ? "bg-[#5c9d8a]" : lifecycle.state === "error" ? "bg-[#a65d57]" : "bg-[#c4b5fd]"}`} />
        <span className="capitalize">{lifecycle.state}</span>
        {lifecycle.purpose && <span className="truncate text-[11px] text-[#8a857d]">· {lifecycle.purpose}</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {lifecycle.expiresAt && lifecycle.state === "running" && (
          <span className="text-[11px] text-[#8a857d]">
            <Clock3 size={10} className="mr-1 inline" /><ExpiryCountdown expiresAt={lifecycle.expiresAt} />
          </span>
        )}
        {lifecycle.error && <span className="block w-full truncate text-[11px] text-[#a65d57]">{lifecycle.error}</span>}
      </div>
    </div>
  );
}

function MinimizedCanvasBar({
  preview,
  lifecycle,
  onRestore,
  onClose,
}: {
  preview: SandboxPreviewArtifact | null;
  lifecycle: SandboxLifecycleEvent | null;
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto mt-4 flex w-full max-w-[780px] items-center justify-between gap-3 rounded-xl border border-[#e7e5e4] bg-white/80 px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.035)]">
      <button type="button" onClick={onRestore} className="min-w-0 text-left">
        <p className="truncate text-[13px] font-medium text-[#292524]">
          <LayoutPanelTop size={12} className="mr-1.5 inline" />{preview ? preview.name.replace(/\.html$/i, "") : "Preview"} · {sandboxStatusCopy(lifecycle) || "Running"}
        </p>
        <p className="text-[11px] text-[#8a857d]">Minimized — tap to bring the canvas back</p>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onRestore} className="canvas-preview-action"><RefreshCw size={13} /> Restore</button>
        <button type="button" onClick={onClose} className="canvas-preview-action" aria-label="Close preview"><X size={13} /></button>
      </div>
    </div>
  );
}
