/**
 * I'm Snappy — Quiet Intelligence design reminder
 * Shared sidebar component used across ALL pages (workspace + discover).
 * This ensures the sidebar looks and behaves identically everywhere.
 */
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AtSign,
  Bot,
  BrainCircuit,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Library,
  Menu,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  CalendarClock,
  X,
} from "lucide-react";

export type ConversationItem = {
  id: string;
  title: string;
  time: string;
};

type SidebarProps = {
  conversations?: ConversationItem[];
  selectedConversation?: string | null;
  onNewFocus?: () => void;
  onChooseConversation?: (id: string) => void;
  onSearchRecent?: () => void;
  onProfileClick?: () => void;
  currentRoute?: string;
};

function PulseMark() {
  return (
    <span className="pulse-mark h-6 w-6" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function Sidebar({
  conversations = [],
  selectedConversation = null,
  onNewFocus,
  onChooseConversation,
  onSearchRecent,
  onProfileClick,
  currentRoute,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();
  const [, setLocation] = useLocation();
  const canExpandRail = () => window.matchMedia("(min-width: 768px)").matches;

  const goHome = () => {
    setLocation("/");
    if (onNewFocus) onNewFocus();
  };

  const handleNavClick = (path: string) => {
    setLocation(path);
  };

  const isActive = (path: string) => currentRoute === path;

  return (
    <>
      <aside
        onMouseEnter={() => canExpandRail() && setExpanded(true)}
        onMouseLeave={() => canExpandRail() && setExpanded(false)}
        onFocusCapture={() => canExpandRail() && setExpanded(true)}
        onBlurCapture={(event) => {
          if (canExpandRail() && !event.currentTarget.contains(event.relatedTarget as Node)) setExpanded(false);
        }}
        className={`archive-rail fixed inset-y-0 left-0 z-50 flex w-[76px] flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fafafa]/95 backdrop-blur-xl md:static ${expanded ? "is-expanded" : ""}`}
      >
        {/* Compact view */}
        <div className={`rail-compact-view rail-view ${expanded ? "rail-view-hidden" : ""}`} aria-label="Compact workspace navigation">
          <button type="button" onClick={goHome} className="rail-compact-mark" aria-label="I'm Snappy home">
            <PulseMark />
          </button>
          <div className="rail-compact-divider" />
          <button type="button" onClick={goHome} className="rail-icon-control rail-icon-primary" aria-label="New Focus">
            <Plus size={18} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={() => { setLocation("/"); }} className="rail-icon-control" aria-label="Projects">
            <FolderOpen size={17} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={onSearchRecent} className="rail-icon-control" aria-label="Search recent work">
            <Search size={17} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => handleNavClick("/store")} className={`rail-icon-control ${isActive("/store") ? "rail-icon-active" : ""}`} aria-label="App Store">
            <LayoutGrid size={17} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => handleNavClick("/library")} className={`rail-icon-control ${isActive("/library") ? "rail-icon-active" : ""}`} aria-label="Library">
            <Library size={17} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => handleNavClick("/settings")} className={`rail-icon-control ${isActive("/settings") ? "rail-icon-active" : ""}`} aria-label="Settings">
            <Settings size={17} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => handleNavClick("/scheduled")} className={`rail-icon-control ${isActive("/scheduled") ? "rail-icon-active" : ""}`} aria-label="Scheduled">
            <CalendarClock size={17} strokeWidth={1.75} />
          </button>
          <div className="rail-compact-recents" aria-hidden="true">
            {conversations.slice(0, 3).map((conversation) => (
              <span key={conversation.id} className={`rail-recent-pin ${selectedConversation === conversation.id ? "rail-recent-pin-active" : ""}`} />
            ))}
          </div>
          <div className="mt-auto">
            <button type="button" onClick={onProfileClick} className="rail-icon-account" aria-label="Avery Morgan — personal workspace">
              <span className="profile-avatar">AM</span>
            </button>
          </div>
        </div>

        {/* Expanded view */}
        <div className={`rail-expanded-view rail-view ${expanded ? "" : "rail-view-hidden"}`}>
          <div className="flex items-center justify-between">
            <button type="button" onClick={goHome} className="brand-lockup">
              <PulseMark />
              <span>I'm Snappy</span>
            </button>
            <button type="button" onClick={() => setExpanded(false)} className="rail-collapse-button" aria-label="Collapse workspace navigation">
              <PanelLeftClose size={17} strokeWidth={1.7} />
            </button>
          </div>

          <button type="button" onClick={goHome} className="rail-new-focus-button mt-7">
            <span className="rail-new-focus-icon"><Plus size={17} strokeWidth={1.9} /></span>
            <span>New Focus</span>
            <span className="ml-auto text-[10px] font-medium tracking-[0.08em] text-white/50">⌘ K</span>
          </button>

          <nav className="rail-nav-list mt-8" aria-label="Store, library, and settings">
            <p className="rail-section-label">Discover</p>
            <div className="space-y-1 mt-3">
              <button type="button" onClick={() => handleNavClick("/store")} className={`rail-nav-item ${isActive("/store") ? "rail-nav-item-active" : ""}`}>
                <span className="rail-nav-icon"><LayoutGrid size={15} strokeWidth={1.8} /></span>
                <span className="text-[13px] font-medium text-[#3c3834]">App Store</span>
              </button>
              <button type="button" onClick={() => handleNavClick("/library")} className={`rail-nav-item ${isActive("/library") ? "rail-nav-item-active" : ""}`}>
                <span className="rail-nav-icon"><Library size={15} strokeWidth={1.8} /></span>
                <span className="text-[13px] font-medium text-[#3c3834]">Library</span>
              </button>
              <button type="button" onClick={() => handleNavClick("/settings")} className={`rail-nav-item ${isActive("/settings") ? "rail-nav-item-active" : ""}`}>
                <span className="rail-nav-icon"><Settings size={15} strokeWidth={1.8} /></span>
                <span className="text-[13px] font-medium text-[#3c3834]">Settings</span>
              </button>
              <button type="button" onClick={() => handleNavClick("/scheduled")} className={`rail-nav-item ${isActive("/scheduled") ? "rail-nav-item-active" : ""}`}>
                <span className="rail-nav-icon"><CalendarClock size={15} strokeWidth={1.8} /></span>
                <span className="text-[13px] font-medium text-[#3c3834]">Scheduled</span>
              </button>
            </div>
          </nav>

          {conversations.length > 0 && (
            <nav className="rail-recent-list mt-8 flex-1" aria-label="Recent conversations">
              <div className="mb-3 flex items-center justify-between">
                <p className="rail-section-label">Recent work</p>
                <button type="button" onClick={onSearchRecent} className="rail-search-button" aria-label="Search recent work">
                  <Search size={15} />
                </button>
              </div>
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => onChooseConversation?.(conversation.id)}
                    className={`rail-conversation ${selectedConversation === conversation.id ? "rail-conversation-active" : ""}`}
                  >
                    <span className="rail-conversation-indicator" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-medium text-[#3c3834]">{conversation.title}</span>
                      <span className="mt-1 block text-[11px] text-[#8a857d]">{conversation.time}</span>
                    </span>
                  </button>
                ))}
              </div>
            </nav>
          )}

          <div className="rail-profile-footer">
            <button type="button" onClick={onProfileClick} className="rail-profile-button">
              <span className="profile-avatar">AM</span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-[13px] font-medium">Avery Morgan</span>
                <span className="mt-0.5 block text-[11px] text-[#777169]">Personal workspace</span>
              </span>
              <ChevronRight size={15} className="text-[#a8a29e]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
