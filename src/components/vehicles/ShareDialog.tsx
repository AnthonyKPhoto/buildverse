"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Link2, Link2Off, ExternalLink, Check } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleName: string;
  currentToken?: string | null;
  onTokenChange: (token: string | null) => void;
}

export function ShareDialog({ open, onOpenChange, vehicleId, vehicleName, currentToken, onTokenChange }: Props) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(currentToken ?? null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setToken(currentToken ?? null); }, [currentToken]);

  const shareUrl = token
    ? (typeof window !== "undefined" ? `${window.location.origin}/share/${token}` : "")
    : "";

  const enable = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/share`, { method: "POST" });
      const data = await res.json();
      setToken(data.token);
      onTokenChange(data.token);
      toast({ title: "Share link enabled" });
    } catch {
      toast({ title: "Failed to enable sharing", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const revoke = async () => {
    if (!confirm("Revoke this share link? Anyone with the link will lose access.")) return;
    setLoading(true);
    try {
      await fetch(`/api/vehicles/${vehicleId}/share`, { method: "DELETE" });
      setToken(null);
      onTokenChange(null);
      toast({ title: "Share link revoked" });
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Build — {vehicleName}</DialogTitle>
        </DialogHeader>

        {!token ? (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-4 bg-secondary/40 rounded-xl">
              <Link2 className="w-5 h-5 text-theme shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Generate a share link</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Creates a read-only page anyone can view by opening the link on the same network. Perfect for showing your build from your phone.
                </p>
              </div>
            </div>
            <Button
              onClick={enable}
              disabled={loading}
              className="w-full bg-theme hover:brightness-90"
            >
              {loading ? "Generating…" : "Enable Sharing"}
            </Button>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* QR code */}
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG value={shareUrl} size={160} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Scan with a phone on the same network to view your build
              </p>
            </div>

            {/* URL row */}
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 text-xs font-mono bg-secondary/50 rounded-lg border border-border truncate text-muted-foreground">
                {shareUrl}
              </div>
              <Button size="sm" variant="outline" onClick={copy} className="shrink-0 gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-9 px-3 rounded-md border border-border bg-background hover:bg-secondary transition-colors shrink-0"
                title="Open in browser"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Revoke */}
            <Button
              variant="outline"
              size="sm"
              onClick={revoke}
              disabled={loading}
              className="w-full gap-2 text-muted-foreground hover:text-destructive"
            >
              <Link2Off className="w-3.5 h-3.5" />
              Revoke Link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
