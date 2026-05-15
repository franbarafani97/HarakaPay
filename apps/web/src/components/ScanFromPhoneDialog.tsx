import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ExtractedFields, ScanSessionEvent } from "@harakapay/shared";
import { api, apiBaseURL } from "../lib/api";
import { useConfig } from "../hooks/useConfig";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

type ScanState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "waiting"; sessionId: string; scanUrl: string }
  | { status: "uploaded"; sessionId: string }
  | { status: "processed"; sessionId: string; result: ExtractedFields }
  | { status: "failed"; error: string };

export function ScanFromPhoneDialog({
  open,
  onOpenChange,
  onResult,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (extracted: ExtractedFields) => void;
}) {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const { data: config } = useConfig();
  const demoMode = !!config?.demoSkipLogin || !!config?.demoAllowAllApprovals;

  useEffect(() => {
    if (!open) {
      setState({ status: "idle" });
      return;
    }

    let eventSource: EventSource | null = null;
    let cancelled = false;

    setState({ status: "creating" });

    api
      .post<{ id: string; expiresAt: string }>("/scan-sessions")
      .then((res) => {
        if (cancelled) return;
        const sessionId = res.data.id;
        const scanUrl = `${window.location.origin}/scan/${sessionId}`;

        setState({ status: "waiting", sessionId, scanUrl });

        const eventsUrl = `${apiBaseURL}/scan-sessions/${sessionId}/events`;
        eventSource = new EventSource(eventsUrl, { withCredentials: true });

        eventSource.onmessage = (e) => {
          const event: ScanSessionEvent = JSON.parse(e.data);
          if (event.status === "uploaded") {
            setState((s) =>
              s.status === "waiting"
                ? { status: "uploaded", sessionId: s.sessionId }
                : s,
            );
          } else if (event.status === "processed" && event.result) {
            setState({
              status: "processed",
              sessionId,
              result: event.result,
            });
            onResult(event.result);
            eventSource?.close();
            setTimeout(() => onOpenChange(false), 1200);
          } else if (event.status === "failed") {
            setState({
              status: "failed",
              error: event.error ?? "Processing failed",
            });
            eventSource?.close();
          }
        };
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "failed",
          error:
            err instanceof Error ? err.message : "Could not create session",
        });
      });

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [open, onOpenChange, onResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scan from phone</DialogTitle>
          <DialogDescription>
            Open your phone camera and scan this code. We'll read the invoice
            and prefill the form here.
          </DialogDescription>
        </DialogHeader>

        {state.status === "creating" && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Generating link…
          </p>
        )}

        {state.status === "waiting" && (
          <div className="space-y-4 text-center">
            <div className="bg-white rounded-lg p-4 inline-block mx-auto">
              <QRCodeSVG value={state.scanUrl} size={220} />
            </div>
            <p className="text-sm text-muted-foreground">
              Waiting for upload from your phone…
            </p>
            <p className="text-xs text-muted-foreground break-all">
              Or open: <span className="font-mono">{state.scanUrl}</span>
            </p>
            {demoMode && (
              <div
                role="status"
                style={{
                  color: "var(--hp-accent)",
                  background:
                    "color-mix(in srgb, var(--hp-accent) 12%, transparent)",
                  borderColor:
                    "color-mix(in srgb, var(--hp-accent) 35%, transparent)",
                }}
                className="mx-auto max-w-xs rounded-lg border px-3 py-2 text-[11.5px] font-medium leading-snug"
              >
                Demo mode: the returned fields are mocked. Any photo will
                produce sample invoice data — OCR is skipped.
              </div>
            )}
          </div>
        )}

        {state.status === "uploaded" && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Got it. Reading the invoice…
          </p>
        )}

        {state.status === "processed" && (
          <p className="py-6 text-center text-sm">Done. Filling the form…</p>
        )}

        {state.status === "failed" && (
          <div className="space-y-3 text-center py-2">
            <p className="text-sm text-destructive">{state.error}</p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
