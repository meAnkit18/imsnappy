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
  store: { title: "App Store", subtitle: "A working index of skills, connectors, and MCPs" },
  library: { title: "Library", subtitle: "A private shelf for files and generated work" },
  settings: { title: "Settings", subtitle: "Provider, profile, and workspace preferences" },
  scheduled: { title: "Scheduled", subtitle: "Background work held to a durable rhythm" },
};

export default function DiscoverLayout({ page, children }: { page: DiscoverPageKey; children: ReactNode }) {
  const meta = pageMeta[page];
  const route = `/${page}`;

  return (
    <div className="min-h-dvh bg-[#f5f5f5] text-[#0c0a09] flex">
      {/* Shared sidebar — same as workspace, active route highlighted */}
      <Sidebar currentRoute={route} />

      {/* Page content */}
      <div className="flex-1 min-w-0 flex flex-col pl-[76px] md:min-h-dvh md:pl-0">
        <header className="flex min-h-[76px] shrink-0 items-center justify-between gap-4 border-b border-[#e7e5e4] bg-[#fafafa]/80 px-5 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="pulse-mark h-5 w-5 shrink-0" aria-hidden="true"><i /><i /><i /></span>
            <div className="min-w-0">
              <p className="eyebrow hidden md:flex">Workspace index</p>
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="font-display text-[29px] font-light tracking-[-0.045em] leading-none">{meta.title}</h1>
                <span className="hidden truncate text-[12px] text-[#8a857d] md:block">{meta.subtitle}</span>
              </div>
            </div>
          </div>
          <a href="/" className="flex shrink-0 items-center gap-1.5 text-[12px] text-[#68635d] transition-colors hover:text-[#292524]">
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
