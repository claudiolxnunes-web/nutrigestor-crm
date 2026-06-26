import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, startOfWeek, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PlanejarMes({ userId }: { userId?: string }) {
  const [mesBase, setMesBase] = useState(startOfMonth(new Date()));
  const [items, setItems] = useState<any[]>([]);

  const inicio = startOfMonth(mesBase);
  const fim = endOfMonth(mesBase);

  const load = async () => {
    if (!userId) return;
    // Pegamos planejamentos das semanas que tocam este mês
    const semIni = format(startOfWeek(inicio, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const semFim = format(startOfWeek(fim, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const { data } = await supabase.from("planejamento_semanal")
      .select("*")
      .eq("user_id", userId)
      .gte("semana_inicio", semIni)
      .lte("semana_inicio", semFim);
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [userId, mesBase]);

  const dias = useMemo(() => eachDayOfInterval({ start: inicio, end: fim }), [mesBase]);
  const offsetInicio = (getDay(inicio) + 6) % 7; // 0=seg

  const itensPorDia = (d: Date) => {
    return items.filter((it) => {
      const semana = new Date(it.semana_inicio + "T00:00:00");
      const diaReal = new Date(semana);
      diaReal.setDate(semana.getDate() + it.dia_semana);
      return isSameDay(diaReal, d);
    });
  };

  const total = items.length;
  const visitados = items.filter((i) => i.visitado).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={() => setMesBase(subMonths(mesBase, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-semibold capitalize">
          {format(mesBase, "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
        <Button size="sm" variant="outline" onClick={() => setMesBase(addMonths(mesBase, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Visitas planejadas</p>
          <p className="text-2xl font-bold text-primary">{total}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Realizadas</p>
          <p className="text-2xl font-bold text-primary">
            {visitados}
            <span className="text-sm text-muted-foreground ml-1">
              {total > 0 ? `(${Math.round((visitados / total) * 100)}%)` : ""}
            </span>
          </p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offsetInicio }).map((_, i) => <div key={`e${i}`} />)}
          {dias.map((d) => {
            const itens = itensPorDia(d);
            const todosFeitos = itens.length > 0 && itens.every((i) => i.visitado);
            const hoje = isSameDay(d, new Date());
            return (
              <div
                key={d.toISOString()}
                className={`aspect-square rounded-md border p-1 flex flex-col items-center justify-start text-xs ${
                  hoje ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <span className={`font-medium ${hoje ? "text-primary" : ""}`}>{format(d, "d")}</span>
                {itens.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                    <span className={`text-[9px] px-1 rounded ${todosFeitos ? "bg-primary text-primary-foreground" : "bg-accent text-foreground"}`}>
                      {itens.length}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <p className="text-[11px] text-muted-foreground text-center">
        Os números nos dias representam quantos clientes estão planejados. Use a aba <span className="font-medium">Semana</span> para adicionar.
      </p>
    </div>
  );
}