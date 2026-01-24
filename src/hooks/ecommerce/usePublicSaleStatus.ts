import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type PublicSaleStatus = {
  id: string;
  status: string | null;
  payment_status: string | null;
  total_cents: number | null;
  updated_at?: string | null;
};

type Params = {
  saleId?: string | null;
  storefrontSlug: string;
  enabled?: boolean;
  intervalMs?: number;
};

export function usePublicSaleStatus({
  saleId,
  storefrontSlug,
  enabled = true,
  intervalMs = 5000,
}: Params) {
  const [sale, setSale] = useState<PublicSaleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const url = useMemo(() => {
    if (!saleId) return null;
    const params = new URLSearchParams({
      sale_id: saleId,
      storefront_slug: storefrontSlug,
    });
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecommerce-sale-status?${params.toString()}`;
  }, [saleId, storefrontSlug]);

  const refresh = useCallback(async () => {
    if (!url) return;
    setIsLoading(true);
    setError(null);

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        throw new Error(json?.error || "Falha ao consultar status");
      }

      setSale(json.sale as PublicSaleStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar status");
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  // Initial fetch
  useEffect(() => {
    if (!enabled || !url) return;
    refresh();
  }, [enabled, url, refresh]);

  // Poll until paid/cancelled/expired
  useEffect(() => {
    if (!enabled || !url) return;

    const paymentStatus = (sale?.payment_status || "").toLowerCase();
    if (["paid", "refunded", "chargedback", "cancelled"].includes(paymentStatus)) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      refresh();
    }, intervalMs);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [enabled, url, intervalMs, refresh, sale?.payment_status]);

  return { sale, isLoading, error, refresh };
}
