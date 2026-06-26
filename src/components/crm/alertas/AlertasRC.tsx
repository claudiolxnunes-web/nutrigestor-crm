import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, BellRing, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertaCard, Alerta } from "./AlertaCard";

type Props = { compact?: boolean; limit?: number };

export function AlertasRC({ compact, limit }: Props) {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pendentes");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("alertas_rc").select("*").eq("user_id", user.id).order("severidade", { ascending: true }).order("created_at", { ascending: false });
    if (limit) q = q.limit(limit);
    const { data } = await q;
    setAlertas((data ?? []) as Alerta[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const pendentes = alertas.filter((a) => a.status === "pendente");
  const respondidos = alertas.filter((a) => a.status !== "pendente");

  if (loading) {
    return (
      <Card className="p-6 flex justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (alertas.length === 0) {
    return (
      <Card className="p-4 text-sm text-center text-muted-foreground">
        <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-primary" />
        Nenhum alerta no momento. Bom trabalho! 🎉
      </Card>
    );
  }

  if (compact) {
    const topo = pendentes.slice(0, limit ?? 3);
    return (
      <Card className="p-3 border-destructive/30 bg-destructive/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-destructive" />
            <p className="text-sm font-semibold">Alertas pendentes</p>
            <Badge variant="destructive" className="text-[10px]">{pendentes.length}</Badge>
          </div>
        </div>
        {topo.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tudo respondido! ✅</p>
        ) : (
          <div className="space-y-2">
            {topo.map((a) => (
              <AlertaCard key={a.id} alerta={a} onRespondido={load} />
            ))}
            {pendentes.length > topo.length && (
              <p className="text-xs text-muted-foreground text-center pt-1">+ {pendentes.length - topo.length} outro(s) na aba Alertas</p>
            )}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="pendentes" className="text-xs">
          Pendentes <Badge variant="destructive" className="ml-2 text-[10px]">{pendentes.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="respondidos" className="text-xs">
          Respondidos <Badge variant="secondary" className="ml-2 text-[10px]">{respondidos.length}</Badge>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pendentes" className="mt-3 space-y-2">
        {pendentes.length === 0 ? (
          <Card className="p-4 text-sm text-center text-muted-foreground">Sem alertas pendentes 🎉</Card>
        ) : pendentes.map((a) => (
          <AlertaCard key={a.id} alerta={a} onRespondido={load} />
        ))}
      </TabsContent>
      <TabsContent value="respondidos" className="mt-3 space-y-2">
        {respondidos.length === 0 ? (
          <Card className="p-4 text-sm text-center text-muted-foreground">Nenhum alerta respondido ainda.</Card>
        ) : respondidos.map((a) => (
          <AlertaCard key={a.id} alerta={a} onRespondido={load} />
        ))}
      </TabsContent>
    </Tabs>
  );
}