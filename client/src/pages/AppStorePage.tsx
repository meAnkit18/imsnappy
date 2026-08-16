/**
 * I'm Snappy — App Store page
 * Skills, MCPs, and connectors catalog. Editorial off-white canvas, warm ink.
 */
import { useState } from "react";
import { LayoutGrid, Plug2, Sparkles, Shield, Database, Search, Wrench } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";

type StoreItem = {
  id: string;
  name: string;
  author: string;
  description: string;
  category: "skills" | "mcps" | "connectors";
  tags: string[];
  icon: "sparkles" | "plug" | "database" | "shield" | "wrench" | "grid";
};

const iconMap = {
  sparkles: Sparkles,
  plug: Plug2,
  database: Database,
  shield: Shield,
  wrench: Wrench,
  grid: LayoutGrid,
};

const storeItems: StoreItem[] = [
  {
    id: "s1",
    name: "Research Synthesis",
    author: "I'm Snappy",
    description: "Multi-source research skill. Gathers, cross-validates, and distills findings into structured briefs with citations.",
    category: "skills",
    tags: ["research", "citations", "briefs"],
    icon: "sparkles",
  },
  {
    id: "s2",
    name: "Editorial Writing",
    author: "I'm Snappy",
    description: "Long-form writing with voice control. Matches tone, pacing, and structure across essays, letters, and reports.",
    category: "skills",
    tags: ["writing", "tone", "long-form"],
    icon: "wrench",
  },
  {
    id: "s3",
    name: "Data Visualization",
    author: "I'm Snappy",
    description: "Generates charts, plots, and infographics from structured or narrative data with a consistent visual language.",
    category: "skills",
    tags: ["charts", "infographics"],
    icon: "grid",
  },
  {
    id: "m1",
    name: "Filesystem MCP",
    author: "Community",
    description: "Read, write, and organize local files. The agent can persist drafts, notes, and exports directly to disk.",
    category: "mcps",
    tags: ["files", "storage"],
    icon: "database",
  },
  {
    id: "m2",
    name: "Browser Automation MCP",
    author: "Community",
    description: "Navigate, extract, and interact with web pages. Enables real-time browsing, form filling, and data collection.",
    category: "mcps",
    tags: ["web", "automation"],
    icon: "plug",
  },
  {
    id: "m3",
    name: "Calendar & Reminders MCP",
    author: "I'm Snappy",
    description: "Syncs with your calendar. Schedules tasks, reads upcoming events, and manages time-based agent workflows.",
    category: "mcps",
    tags: ["calendar", "scheduling"],
    icon: "shield",
  },
  {
    id: "c1",
    name: "Google Drive",
    author: "Official",
    description: "Connect your Drive to save and retrieve documents, spreadsheets, and media generated during agent sessions.",
    category: "connectors",
    tags: ["google", "docs"],
    icon: "plug",
  },
  {
    id: "c2",
    name: "Notion",
    author: "Official",
    description: "Pushes structured outputs, notes, and task lists directly into your Notion workspace pages and databases.",
    category: "connectors",
    tags: ["notion", "notes"],
    icon: "database",
  },
  {
    id: "c3",
    name: "GitHub",
    author: "Official",
    description: "Commits, pulls, and manages repositories. The agent can generate code and push it to your projects.",
    category: "connectors",
    tags: ["code", "repos"],
    icon: "wrench",
  },
];

const categories = [
  { key: "all", label: "All" },
  { key: "skills", label: "Skills" },
  { key: "mcps", label: "MCPs" },
  { key: "connectors", label: "Connectors" },
] as const;

export default function AppStorePage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [installed, setInstalled] = useState<Set<string>>(new Set(["s1", "m1"]));
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = storeItems.filter((item) => {
    const matchCategory = activeCategory === "all" || item.category === activeCategory;
    const matchSearch =
      searchQuery === "" ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const toggleInstall = (item: StoreItem) => {
    setInstalled((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
        toast.message(`${item.name} removed.`, { description: "The item is no longer active." });
      } else {
        next.add(item.id);
        toast.message(`${item.name} installed.`, { description: "Ready to use in your agent sessions." });
      }
      return next;
    });
  };

  return (
    <DiscoverLayout page="store">
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a8a29e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills, MCPs, connectors…"
            className="settings-input pl-9"
          />
        </div>
      </div>

      <div className="store-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setActiveCategory(cat.key)}
            className={`store-category-tab ${activeCategory === cat.key ? "store-category-tab-active" : ""}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="store-grid">
        {filtered.map((item) => {
          const Icon = iconMap[item.icon];
          const isInstalled = installed.has(item.id);
          return (
            <div key={item.id} className="store-card">
              <div className="store-card-header">
                <span className="store-card-icon">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <span className="store-card-info">
                  <span className="store-card-name">{item.name}</span>
                  <span className="store-card-author">{item.author}</span>
                </span>
              </div>
              <p className="store-card-description">{item.description}</p>
              <div className="store-card-footer">
                <div className="store-card-tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="store-tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => toggleInstall(item)}
                  className={`store-button ${isInstalled ? "store-button-installed" : ""}`}
                >
                  {isInstalled ? "Installed" : "Install"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-[13px] text-[#8a857d]">
          No items match your search. Try a different term or category.
        </p>
      )}
    </DiscoverLayout>
  );
}
