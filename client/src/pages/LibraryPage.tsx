/**
 * I’m Snappy — Library page
 * Editorial off-white asset cabinet backed by signed storage uploads and private API records.
 */
import { useEffect, useRef, useState } from "react";
import { Captions, Download, FileText, FolderOpen, Image, LoaderCircle, Music, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";
import { type ArtifactType, type LibraryArtifact } from "@/lib/api";
import { useApiSession } from "@/contexts/ApiSessionContext";

const typeIcons: Record<ArtifactType, typeof FileText> = {
  document: FileText,
  image: Image,
  audio: Music,
  video: Video,
  file: FolderOpen,
  transcript: FileText,
};

const previewClasses: Record<ArtifactType, string> = {
  document: "library-preview-doc",
  image: "library-preview-image",
  audio: "library-preview-audio",
  video: "library-preview-video",
  file: "library-preview",
  transcript: "library-preview-doc",
};

const filters: Array<{ key: "all" | ArtifactType; label: string }> = [
  { key: "all", label: "All" },
  { key: "document", label: "Documents" },
  { key: "image", label: "Images" },
  { key: "audio", label: "Audio" },
  { key: "video", label: "Video" },
  { key: "transcript", label: "Transcripts" },
  { key: "file", label: "Files" },
];

function inferAssetType(file: File): Exclude<ArtifactType, "transcript"> {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || file.type.startsWith("text/") || file.type.includes("document")) return "document";
  return "file";
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "Stored asset";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function LibraryPage() {
  const { api, session } = useApiSession();
  const [activeFilter, setActiveFilter] = useState<"all" | ArtifactType>("all");
  const [artifacts, setArtifacts] = useState<LibraryArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    if (!api.configured || !session) return;
    setLoading(true);
    try {
      const { artifacts: nextArtifacts } = await api.listArtifacts();
      setArtifacts(nextArtifacts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the Library.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [api, session]);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!session) { toast.error("Sign in in Settings before uploading to your Library."); return; }
    setUploading(true);
    try {
      const artifact = await api.uploadArtifact(file, inferAssetType(file));
      setArtifacts((current) => [artifact, ...current]);
      toast.success(`${file.name} is now in your Library.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload this asset.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (artifact: LibraryArtifact) => {
    try {
      await api.deleteArtifact(artifact.id);
      setArtifacts((current) => current.filter((item) => item.id !== artifact.id));
      toast.message(`${artifact.name} removed from Library.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove this asset.");
    }
  };

  const handleTranscribe = async (artifact: LibraryArtifact) => {
    if (!artifact.secureUrl) { toast.error("This asset is not available for transcription."); return; }
    try {
      setTranscribingId(artifact.id);
      const source = await fetch(artifact.secureUrl);
      if (!source.ok) throw new Error("Could not retrieve the stored media for transcription.");
      const blob = await source.blob();
      const result = await api.transcribeMedia(new File([blob], artifact.name, { type: artifact.contentType }));
      setArtifacts((current) => [result.artifact, ...current]);
      toast.success("Transcript saved to Library.", { description: result.transcript.text ? "A text transcript is ready for your agent workflows." : "The transcription provider completed the request." });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not transcribe this asset.");
    } finally {
      setTranscribingId(null);
    }
  };

  const filtered = artifacts.filter((asset) => activeFilter === "all" || asset.type === activeFilter);

  return (
    <DiscoverLayout page="library">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="library-filter-tabs">
          {filters.map((filter) => <button key={filter.key} type="button" onClick={() => setActiveFilter(filter.key)} className={`library-filter-tab ${activeFilter === filter.key ? "library-filter-tab-active" : ""}`}>{filter.label}</button>)}
        </div>
        <label className="api-key-save flex cursor-pointer items-center gap-2">
          {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading" : "Upload asset"}
          <input ref={inputRef} className="sr-only" type="file" disabled={uploading} onChange={(event) => void handleFile(event.target.files?.[0])} />
        </label>
      </div>

      {!api.configured && <p className="mb-6 text-[13px] text-[#8a857d]">Set <code>VITE_API_BASE_URL</code> to connect this Library to your I’m Snappy service.</p>}
      {api.configured && !session && <p className="mb-6 text-[13px] text-[#8a857d]">Sign in through Settings to access your private Library.</p>}
      {loading && <div className="flex items-center gap-2 py-10 text-[13px] text-[#8a857d]"><LoaderCircle size={15} className="animate-spin" /> Loading Library…</div>}

      {!loading && session && <div className="library-grid">
        {filtered.map((asset) => {
          const Icon = typeIcons[asset.type];
          return <div key={asset.id} className="library-card">
            <div className={`library-preview ${previewClasses[asset.type]}`}><Icon size={28} strokeWidth={1.5} /></div>
            <div className="library-card-info">
              <span className="library-card-name">{asset.name}</span>
              <span className="library-card-meta">{formatBytes(asset.bytes)} · {formatDate(asset.createdAt)}</span>
              <div className="mt-2 flex items-center gap-2">
                {asset.secureUrl && <button type="button" onClick={() => window.open(asset.secureUrl, "_blank", "noopener,noreferrer")} className="icon-button h-7 w-7" aria-label={`Download ${asset.name}`}><Download size={13} /></button>}
                {(asset.type === "audio" || asset.type === "video") && <button type="button" disabled={transcribingId === asset.id} onClick={() => void handleTranscribe(asset)} className="icon-button h-7 w-7" aria-label={`Transcribe ${asset.name}`}>{transcribingId === asset.id ? <LoaderCircle size={13} className="animate-spin" /> : <Captions size={13} />}</button>}
                <button type="button" onClick={() => void handleDelete(asset)} className="icon-button h-7 w-7" aria-label={`Delete ${asset.name}`}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>;
        })}
      </div>}

      {!loading && session && filtered.length === 0 && <p className="mt-12 text-center text-[13px] text-[#8a857d]">Nothing stored in this category yet. Upload an asset or save one from an agent run.</p>}
    </DiscoverLayout>
  );
}
