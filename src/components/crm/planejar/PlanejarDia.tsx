import { useEffect, useState } from "react";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Trash2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { SpinDialog } from "@/components/crm/planejar/SpinDialog";

export function PlanejarDia({ userId }: { userId?: string }) {
  const [data, setData] = useState(new Date());
  const [items, setItems] = useState<any[]>([]);
  const [spinFor, setSpinFor] = useState<any | null>(null);
  const [spinIds, setSpinIds] = useState<Set<string>>(new Set());

  const semanaInicio = startOfWeek(data, { weekStartsOn: 1 });
  const diaIdx = (data.getDay() + 6) % 7;

  const load = async () => {
    if (!userId) return;
    const { data: rows } = await supabase.from("planejamento_semanal").select("*")
      .eq("user_id", userId)
      .eq("semana_inicio", format(semanaInicio, "yyyy-MM-dd"))
      .eq("dia_semana", diaIdx)
      .order("ordem");
    setItems(rows ?? []);
    const ids = (rows ?? []).map((r: any) => r.id);
    if (ids.length) {
      const { data: spins } = await supabase.from("planos_visita_spin")
        .select("planejamento_id").in("planejamento_id", ids);
      setSpinIds(new Set((spins ?? []).map((s: any) => s.planejamento_id as string)));
    } else {
      setSpinIds(new Set());
    }
  };
  useEffect(() => { load(); }, [userId, data]);

  const toggle = async (it: any) => {
    await supabase.from("planejamento_semanal").update({ visitado: !it.visitado }).eq("id", it.id);
    load();
  };

  const mover = async (idx: number, dir: -1 | 1) => {
    const novo = [...items];
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= novo.length) return;
    [novo[idx], novo[alvo]] = [novo[alvo], novo[idx]];
    await Promise.all(novo.map((it, i) =>
      supabase.from("planejamento_semanal").update({ ordem: i }).eq("id", it.id)
    ));
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("planejamento_semanal").delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const isDomingo = diaIdx === 6;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setData(subDays(data, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold capitalize text-center">
          {format(data, "EEEE, dd 'de' MMM", { locale: ptBR })}
        </p>
        <Button size="sm" variant="outline" onClick={() => setData(addDays(data, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isDomingo ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Domingo — sem planejamento.</Card>
      ) : items.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum cliente planejado para este dia. Adicione na aba <span className="font-medium">Semana</span>.
        </Card>
      ) : (
        <Card className="p-3 space-y-1">
          {items.map((it, idx) => (
            <div key={it.id} className="flex items-center gap-2 py-2 border-t first:border-t-0">
              <span className="text-xs font-mono text-muted-foreground w-6 text-center">{idx + 1}</span>
              <Checkbox checked={it.visitado} onCheckedChange={() => toggle(it)} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${it.visitado ? "line-through text-muted-foreground" : ""}`}>
                  {it.cliente_nome}
                </p>
                {(it.cidade || it.objetivo) && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[it.cidade, it.objetivo].filter(Boolean).join(" • ")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => mover(idx, -1)}>
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === items.length - 1} onClick={() => mover(idx, 1)}>
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <Button
                size="icon"
                variant="ghost"
                title={spinIds.has(it.id) ? "Plano SPIN preenchido — clique para editar" : "Preparar visita (SPIN)"}
                onClick={() => setSpinFor(it)}
                className={spinIds.has(it.id) ? "text-primary" : ""}
              >
                <ClipboardList className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {spinFor && (
        <SpinDialog
          open={!!spinFor}
          onOpenChange={(o) => { if (!o) setSpinFor(null); }}
          userId={userId}
          planejamentoId={spinFor.id}
          clienteNome={spinFor.cliente_nome}
          clienteId={spinFor.cliente_id}
          codRc={spinFor.cod_rc}
          dataVisita={format(data, "yyyy-MM-dd")}
          onSaved={load}
        />
      )}
    </div>
  );
}