/**
 * I'm Snappy — Library page
 * Generated-assets storage: documents, images, audio, video, and files.
 * Editorial off-white canvas, warm ink type.
 */
import { useState } from "react";
import { FileText, Image, Music, Video, FolderOpen, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";

type LibraryAsset = {
  id: string;
  name: string;
  type: "document" | "image" | "audio" | "video" | "file";
  size: string;
  date: string;
  source: string;
};

const assets: LibraryAsset[] = [
  { id: "a1", name: "Launch brief — final draft", type: "document", size: "12 KB", date: "Today, 4:12 AM", source: "A thoughtful launch brief" },
  { id: "a2", name: "Atlas research synthesis", type: "document", size: "34 KB", date: "Yesterday", source: "Atlas research synthesis" },
  { id: "a3", name: "Journal cover concept v2", type: "image", size: "2.4 MB", date: "Thu, 11:30 PM", source: "Grid systems for a new journal" },
  { id: "a4", name: "Partner letter — batch export", type: "document", size: "8 KB", date: "Tue, 9:05 AM", source: "Three partner letters" },
  { id: "a5", name: "Brand palette reference", type: "image", size: "1.1 MB", date: "Mon, 2:45 PM", source: "Atlas research synthesis" },
  { id: "a6", name: "Narration draft — intro segment", type: "audio", size: "4.8 MB", date: "Sun, 6:20 PM", source: "A thoughtful launch brief" },
  { id: "a7", name: "Editorial layout mockup", type: "image", size: "3.2 MB", date: "Sat, 10:15 AM", source: "Grid systems for a new journal" },
  { id: "a8", name: "Project recap — short film", type: "video", size: "18.6 MB", date: "Fri, 7:33 PM", source: "Atlas research synthesis" },
  { id: "a9", name: "Voice note — design direction", type: "audio", size: "2.1 MB", date: "Thu, 3:10 PM", source: "Grid systems for a new journal" },
  { id: "a10", name: "Data export — Q3 metrics", type: "file", size: "56 KB", date: "Wed, 1:22 AM", source: "A thoughtful launch brief" },
  { id: "a11", name: "Typography specimen sheet", type: "image", size: "1.8 MB", date: "Tue, 8:55 PM", source: "Three partner letters" },
  { id: "a12", name: "Ambient score — 45s loop", type: "audio", size: "3.5 MB", date: "Mon, 4:40 PM", source: "Atlas research synthesis" },
];

const typeIcons = {
  document: FileText,
  image: Image,
  audio: Music,
  video: Video,
  file: FolderOpen,
};

const previewClasses = {
  document: "library-preview-doc",
  image: "library-preview-image",
  audio: "library-preview-audio",
  video: "library-preview-video",
  file: "library-preview",
};

const filters = [
  { key: "all", label: "All" },
  { key: "document", label: "Documents" },
  { key: "image", label: "Images" },
  { key: "audio", label: "Audio" },
  { key: "video", label: "Video" },
  { key: "file", label: "Files" },
] as const;

export default function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const filtered = assets.filter((asset) => activeFilter === "all" || asset.type === activeFilter);

  const handleDownload = (name: string) => {
    toast.message(`Downloading ${name}…`, { description: "Save location will open when storage is connected." });
  };

  const handleDelete = (name: string) => {
    toast.message(`${name} removed from Library.`, { description: "This prototype keeps assets local for now." });
  };

  return (
    <DiscoverLayout page="library">
      <div className="library-filter-tabs">
        {filters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={`library-filter-tab ${activeFilter === filter.key ? "library-filter-tab-active" : ""}`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="library-grid">
        {filtered.map((asset) => {
          const Icon = typeIcons[asset.type];
          return (
            <div key={asset.id} className="library-card">
              <div className={`library-preview ${previewClasses[asset.type]}`}>
                <Icon size={28} strokeWidth={1.5} />
              </div>
              <div className="library-card-info">
                <span className="library-card-name">{asset.name}</span>
                <span className="library-card-meta">
                  {asset.size} · {asset.date}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(asset.name)}
                    className="icon-button h-7 w-7"
                    aria-label={`Download ${asset.name}`}
                  >
                    <Download size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset.name)}
                    className="icon-button h-7 w-7"
                    aria-label={`Delete ${asset.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-[13px] text-[#8a857d]">
          Nothing stored in this category yet. Generated assets will appear here.
        </p>
      )}
    </DiscoverLayout>
  );
}
