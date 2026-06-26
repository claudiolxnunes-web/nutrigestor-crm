import { useEffect, useState } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Check, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AutocompleteCadastro, ItemSelecionado } from "@/components/crm/AutocompleteCadastro";
import { SpinDialog } from "@/components/crm/planejar/SpinDialog";

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function PlanejarSemana({ userId }: { userId?: string }) {
  const { orgId } = useOrg();
  const [semanaBase, setSemanaBase] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [items, setItems] = useState<any[]>([]);
  const [openDia, setOpenDia] = useState<number | null>(null);
  const [cliente, setCliente] = useState<ItemSelecionado | null>(null);
  const [novoObj, setNovoObj] = useState("");
  const [spinFor, setSpinFor] = useState<any | null>(null);
  const [spinIds, setSpinIds] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!userId) return;
    const { data } = await supabase.from("planejamento_semanal").select("*")
      .eq("user_id", userId).eq("semana_inicio", format(semanaBase, "yyyy-MM-dd")).order("ordem");
    setItems(data ?? []);
    const ids = (data ?? []).map((d: any) => d.id);
    if (ids.length) {
      const { data: spins } = await supabase.from("planos_visita_spin")
        .select("planejamento_id").in("planejamento_id", ids);
      setSpinIds(new Set((spins ?? []).map((s: any) => s.planejamento_id as string)));
    } else {
      setSpinIds(new Set());
    }
  };
  useEffect(() => { load(); }, [userId, semanaBase]);

  const add = async () => {
    if (!userId || openDia === null || !cliente?.nome) return;
    const ordem = items.filter((i) => i.dia_semana === openDia).length;
    const { error } = await supabase.from("planejamento_semanal").insert({
      user_id: userId, organizacao_id: orgId!,
      semana_inicio: format(semanaBase, "yyyy-MM-dd"),
      dia_semana: openDia,
      cliente_id: cliente.id, cliente_nome: cliente.nome,
      cidade: cliente.extra?.cidade || null,
      objetivo: novoObj || null, ordem,
    });
    if (error) return toast.error(error.message);
    setCliente(null); setNovoObj(""); setOpenDia(null);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("planejamento_semanal").delete().eq("id", id);
    load();
  };

  const toggle = async (it: any) => {
    await supabase.from("planejamento_semanal").update({ visitado: !it.visitado }).eq("id", it.id);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" onClick={() => setSemanaBase(subWeeks(semanaBase, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-xs text-center text-muted-foreground flex-1">
          {format(semanaBase, "dd/MM", { locale: ptBR })} a {format(addDays(semanaBase, 5), "dd/MM/yyyy", { locale: ptBR })}
        </p>
        <Button size="sm" variant="outline" onClick={() => setSemanaBase(addWeeks(semanaBase, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {DIAS.map((dia, idx) => {
        const dayItems = items.filter((i) => i.dia_semana === idx);
        const visitados = dayItems.filter((i) => i.visitado).length;
        return (
          <Card key={idx} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{dia}</p>
                <p className="text-[11px] text-muted-foreground">
                  {format(addDays(semanaBase, idx), "dd/MM")} • {dayItems.length} clientes
                  {visitados > 0 && ` • ${visitados} visitados`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenDia(idx)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {dayItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-1.5 border-t">
                <Checkbox checked={it.visitado} onCheckedChange={() => toggle(it)} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${it.visitado ? "line-through text-muted-foreground" : ""}`}>{it.cliente_nome}</p>
                  {(it.cidade || it.objetivo) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[it.cidade, it.objetivo].filter(Boolean).join(" • ")}
                    </p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  title={spinIds.has(it.id) ? "Plano SPIN preenchido — clique para editar" : "Preparar visita (SPIN)"}
                  onClick={() => setSpinFor({ ...it, _diaIdx: idx })}
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
        );
      })}

      <Dialog open={openDia !== null} onOpenChange={(o) => { if (!o) { setOpenDia(null); setCliente(null); setNovoObj(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar cliente — {openDia !== null ? DIAS[openDia] : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <AutocompleteCadastro
                userId={userId}
                tabela="clientes"
                label=""
                value={cliente}
                onChange={setCliente}
                placeholder="Buscar cliente cadastrado…"
              />
            </div>
            <div>
              <Label className="text-xs">Objetivo</Label>
              <Input value={novoObj} onChange={(e) => setNovoObj(e.target.value)} placeholder="Ex.: apresentar nova linha" />
            </div>
            <Button onClick={add} disabled={!cliente?.nome} className="w-full">
              <Check className="mr-2 h-4 w-4" />Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {spinFor && (
        <SpinDialog
          open={!!spinFor}
          onOpenChange={(o) => { if (!o) setSpinFor(null); }}
          userId={userId}
          planejamentoId={spinFor.id}
          clienteNome={spinFor.cliente_nome}
          clienteId={spinFor.cliente_id}
          codRc={spinFor.cod_rc}
          dataVisita={format(addDays(semanaBase, spinFor._diaIdx), "yyyy-MM-dd")}
          onSaved={load}
        />
      )}
    </>
  );
}