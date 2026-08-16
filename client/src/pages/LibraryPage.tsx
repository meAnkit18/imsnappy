/**
 * I'm Snappy — Library page
 * Generated-assets storage: documents, images, audio, video, and files.
 * Editorial off-white canvas, warm ink type.
 */
import { useEffect, useRef, useState } from "react";
import { FileText, Image, Music, Video, FolderOpen, Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import DiscoverLayout from "@/components/DiscoverLayout";
import { listAssets, addAsset, removeAsset, type LibraryAsset } from "@/lib/localStore";
import { trpc } from "@/lib/trpc";

const MAX_PREVIEW_BYTES = 1.5 * 1024 * 1024;

const typeIcons = {
  document: FileText,
  image: Image,
  audio: Music,
  video: Video,
  other: FolderOpen,
};

const previewClasses = {
  document: "library-preview-doc",
  image: "library-preview-image",
  audio: "library-preview-audio",
  video: "library-preview-video",
  other: "library-preview",
};

const filters = [
  { key: "all", label: "All" },
  { key: "document", label: "Documents" },
  { key: "image", label: "Images" },
  { key: "audio", label: "Audio" },
  { key: "video", label: "Video" },
  { key: "other", label: "Files" },
] as const;

function classify(file: File): LibraryAsset["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("text/") || /\.(txt|md|pdf|docx?|csv|json)$/.test(file.name.toLowerCase())) return "document";
  return "other";
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function localDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function LibraryPage() {
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: 0 });
  const isSignedIn = Boolean(me?.openId);
  const utils = trpc.useUtils();
  const { data: serverAssets } = trpc.library.list.useQuery(undefined, { enabled: isSignedIn, retry: 0 });
  const addLibraryRow = trpc.library.add.useMutation({ onSuccess: () => utils.library.list.invalidate() });
  const removeLibraryRow = trpc.library.remove.useMutation({ onSuccess: () => utils.library.list.invalidate() });

  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  useEffect(() => {
    if (serverAssets && isSignedIn) {
      setAssets(
        serverAssets.map((row) => ({
          id: row.id,
          type: (row.kind === "image" || row.kind === "audio" || row.kind === "video" || row.kind === "document" ? row.kind : "other") as LibraryAsset["type"],
          name: row.name,
          size: row.sizeBytes ?? 0,
          url: row.url,
          createdAt: row.createdAt,
        })),
      );
    } else {
      setAssets(listAssets());
    }
  }, [serverAssets, isSignedIn]);

  const [activeFilter, setActiveFilter] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = assets.filter((asset) => activeFilter === "all" || asset.type === activeFilter);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    for (const file of files) {
      const assetType = classify(file);
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const asset: LibraryAsset = {
        id: assetId,
        type: assetType,
        name: file.name,
        size: file.size,
        createdAt: new Date().toISOString(),
      };
      if (file.size <= MAX_PREVIEW_BYTES) {
        asset.dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(file);
        });
      }
      if (isSignedIn) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("read failed"));
            reader.readAsDataURL(file);
          });
          const uploaded = await fetch("/api/library/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/octet-stream", kind: assetType, data: base64 }),
          });
          if (!uploaded.ok) throw new Error(`Upload failed (${uploaded.status})`);
          const { url, sizeBytes } = (await uploaded.json()) as { url: string; sizeBytes: number };
          addLibraryRow.mutate({
            publicId: assetId,
            name: file.name,
            kind: assetType,
            mimeType: file.type || undefined,
            url,
            sizeBytes: sizeBytes ?? file.size,
          });
          asset.url = url;
          asset.size = sizeBytes ?? file.size;
        } catch (error) {
          console.error("[Library] server upload failed, keeping local copy", error);
          addAsset(asset);
          toast.error("Could not store the file in the cloud.", { description: "It is saved on this device instead." });
        }
      } else {
        addAsset(asset);
      }
      setAssets(isSignedIn ? (prev) => [asset, ...prev] : listAssets());
    }
    toast.message(`${files.length} item${files.length > 1 ? "s" : ""} added to Library.${isSignedIn ? " Stored in the cloud." : " Stored locally on this device — visible in the preview only."}`);
  };

  const handleDownload = (asset: LibraryAsset) => {
    const href = asset.url ?? asset.dataUrl;
    if (!href) {
      toast.message(`${asset.name} has no stored preview.`, {
        description: "Only files under 1.5 MB keep a local preview in this prototype.",
      });
      return;
    }
    const link = document.createElement("a");
    link.href = href;
    link.download = asset.name;
    link.click();
  };

  const handleDelete = (asset: LibraryAsset) => {
    if (isSignedIn) removeLibraryRow.mutate({ publicId: asset.id });
    removeAsset(asset.id);
    setAssets(isSignedIn ? (prev) => prev.filter((row) => row.id !== asset.id) : listAssets());
    toast.message(`${asset.name} removed from Library.`, { description: isSignedIn ? "Deleted from the cloud." : "Deleted from this device." });
  };

  return (
    <DiscoverLayout page="library">
      <div className="flex items-center justify-between gap-4">
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
        <button type="button" className="api-key-save flex items-center gap-2" onClick={() => inputRef.current?.click()}>
          <Upload size={13} /> Add file
        </button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} aria-label="Upload a file to the Library" />
      </div>

      <div className="library-grid">
        {filtered.map((asset) => {
          const Icon = typeIcons[asset.type];
          return (
            <div key={asset.id} className="library-card">
              <div className={`library-preview ${previewClasses[asset.type]}`}>
                {asset.type === "image" && asset.dataUrl ? (
                  <img src={asset.dataUrl} alt={asset.name} className="h-full w-full object-cover" />
                ) : (
                  <Icon size={28} strokeWidth={1.5} />
                )}
              </div>
              <div className="library-card-info">
                <span className="library-card-name">{asset.name}</span>
                <span className="library-card-meta">
                  {humanSize(asset.size)} · {localDate(asset.createdAt)}
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(asset)}
                    className="icon-button h-7 w-7"
                    aria-label={`Download ${asset.name}`}
                  >
                    <Download size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(asset)}
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
        <div className="folio-empty-state mt-10">
          <span className="folio-empty-index">Shelf 01</span>
          <FolderOpen size={24} strokeWidth={1.35} />
          <p className="folio-empty-title">A clear shelf makes room for the next useful thing.</p>
          <p className="folio-empty-copy">Add a file to keep it close at hand in this browser, or connect the backend when you are ready to keep it in the cloud.</p>
        </div>
      )}
    </DiscoverLayout>
  );
}
