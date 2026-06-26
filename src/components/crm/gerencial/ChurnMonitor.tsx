import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingDown, User, ArrowRight } from "lucide-react";
import { fmtPct } from "@/utils/crm/formatters";

export function ChurnMonitor({ orgId, mes }: { orgId: string; mes: string }) {
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["churn-alerts", orgId, mes],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_churn_risk_alerts", {
        _organizacao_id: orgId,
        _mes_atual: mes,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && !!mes,
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-muted rounded-2xl" />;
  if (alerts.length === 0) return null;

  return (
    <Card className="p-5 border-rose-200 bg-rose-50/30 dark:bg-rose-950/10" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-2 uppercase tracking-wider text-xs">
          <AlertCircle className="h-4 w-4" /> Alertas de Churn Preditivo
        </h3>
        <Badge variant="destructive" className="h-5 text-[9px] px-2">{alerts.length} clientes em risco</Badge>
      </div>

      <div className="space-y-3">
        {alerts.slice(0, 5).map((a: any) => (
          <div key={a.cliente_id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 shadow-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-bold truncate">{a.cliente_nome}</span>
                <span className="text-[10px] text-muted-foreground truncate">{a.representante}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1.5 text-rose-600 font-black text-sm">
                <TrendingDown className="h-4 w-4" />
                {fmtPct(a.drop_pct / 100)}
              </div>
              <Badge variant="outline" className={cn(
                "text-[8px] uppercase px-1.5 h-4",
                a.risk_level === 'Critical' ? "border-rose-500 text-rose-600" : "border-rose-300 text-rose-500"
              )}>
                {a.risk_level}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { cn } from "@/lib/utils";
