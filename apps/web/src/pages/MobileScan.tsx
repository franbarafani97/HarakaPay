import { useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { apiBaseURL } from "../lib/api";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../lib/utils";
import { pdfFirstPageToImage } from "../lib/pdf-to-image";

type Status = "idle" | "preparing" | "uploading" | "success" | "error";

export default function MobileScan() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setStatus("preparing");
    setErrorMsg(null);

    try {
      let upload: Blob;
      let filename: string;

      if (file.type === "application/pdf") {
        upload = await pdfFirstPageToImage(file);
        filename = file.name.replace(/\.pdf$/i, "") + ".png";
      } else if (file.type.startsWith("image/")) {
        upload = file;
        filename = file.name;
      } else {
        throw new Error("Please pick an image or a PDF.");
      }

      setStatus("uploading");
      const fd = new FormData();
      fd.append("file", upload, filename);

      const res = await fetch(`${apiBaseURL}/scan-sessions/${token}/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(data.error?.message ?? "Upload failed");
      }
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">HarakaPay</h1>
          <p className="text-sm text-muted-foreground">
            Scan an invoice from your phone
          </p>
        </div>

        {status === "idle" && (
          <>
            <label
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full cursor-pointer",
              )}
            >
              Take photo or pick file
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={onFileChange}
                className="sr-only"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Image or PDF. We'll read the first page and prefill the form on
              your computer.
            </p>
          </>
        )}

        {status === "preparing" && (
          <p className="text-muted-foreground">Reading PDF…</p>
        )}

        {status === "uploading" && (
          <p className="text-muted-foreground">Uploading…</p>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <p className="text-lg">Got it.</p>
            <p className="text-sm text-muted-foreground">
              Check your computer — you can close this page.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{errorMsg}</p>
            <button
              type="button"
              className={buttonVariants({ variant: "outline" })}
              onClick={() => {
                setStatus("idle");
                setErrorMsg(null);
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
