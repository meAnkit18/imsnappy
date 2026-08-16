import type { Express } from "express";
import { storagePut } from "./storage";

type LibraryUploadBody = {
  fileName?: string;
  mimeType?: string;
  kind?: string;
  /** base64-encoded file bytes (small files only; up to the 50mb body limit) */
  data?: string;
  /** alternative: raw text content stored as text/plain */
  text?: string;
};

export function registerLibraryUpload(app: Express): void {
  app.post("/api/library/upload", async (req, res) => {
    const body = (req.body ?? {}) as LibraryUploadBody;
    const fileName = (body.fileName ?? "upload").trim() || "upload";
    const mimeType = (body.mimeType ?? "application/octet-stream").trim();
    const kind = (body.kind ?? "other").trim();

    let bytes: Buffer;
    if (typeof body.text === "string") {
      bytes = Buffer.from(body.text, "utf8");
    } else if (typeof body.data === "string") {
      const sanitized = body.data.replace(/^data:[^;]+;base64,/, "");
      try {
        bytes = Buffer.from(sanitized, "base64");
      } catch {
        res.status(400).json({ error: "Invalid base64 payload" });
        return;
      }
    } else {
      res.status(400).json({ error: "Missing data or text payload" });
      return;
    }

    try {
      const { key, url } = await storagePut(`imsnappy/${kind}/${fileName}`, bytes, mimeType);
      res.json({ storageKey: key, url, sizeBytes: bytes.length });
    } catch (error) {
      console.error("[Library] Upload failed:", error);
      res.status(500).json({ error: "Storage upload failed" });
    }
  });
}
