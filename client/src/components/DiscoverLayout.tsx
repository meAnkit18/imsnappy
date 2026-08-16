/**
 * I'm Snappy — Quiet Intelligence design reminder
 * Shared discover-page shell using the consistent Sidebar component.
 * Off-white editorial canvas, warm ink type, Cormorant Garamond display, Inter utility.
 */
import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import Sidebar from "@/components/Sidebar";

type DiscoverPageKey = "store" | "library" | "settings" | "scheduled";

const pageMeta: Record<DiscoverPageKey, { title: string; subtitle: string }> = {
  store: { title: "App Store", subtitle: "Skills, MCPs, and connectors" },
  library: { title: "Library", subtitle: "Generated work, all in one place" },
  settings: { title: "Settings", subtitle: "Model, APIs, and preferences" },
  scheduled: { title: "Scheduled", subtitle: "Tasks the agent runs for you" },
};

export default function DiscoverLayout({ page, children }: { page: DiscoverPageKey; children: ReactNode }) {
  const meta = pageMeta[page];
  const route = `/${page}`;

  return (
    <div className="min-h-dvh bg-[#f5f5f5] text-[#0c0a09] flex">
      {/* Shared sidebar — same as workspace, active route highlighted */}
      <Sidebar currentRoute={route} />

      {/* Page content */}
      <div className="flex-1 min-w-0 flex flex-col md:min-h-dvh">
        <header className="hidden h-[76px] shrink-0 items-center justify-between px-5 md:flex md:px-8 border-b border-[#e7e5e4] bg-[#fafafa]/80 backdrop-blur-xl">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-[22px] font-light tracking-[-0.01em]">{meta.title}</h1>
            <span className="text-[13px] text-[#8a857d]">{meta.subtitle}</span>
          </div>
          <a href="/" className="flex items-center gap-1.5 text-[13px] text-[#68635d] hover:text-[#292524] transition-colors">
            <ArrowLeft size={14} />
            Workspace
          </a>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
