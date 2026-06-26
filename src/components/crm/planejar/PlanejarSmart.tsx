import { useEffect, useState } from "react";
import { Plus, Target, Trash2, Edit2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Smart = {
  id?: string;
  mes_ano: string;
  especifico: string;
  mensuravel: string;
  meta_valor: string;
  meta_unidade: string;
  atingivel: string;
  relevante: string;
  prazo: string;
  progresso: number;
  status: string;
};

const empty = (): Smart => ({
  mes_ano: currentMonth(),
  especifico: "", mensuravel: "", meta_valor: "", meta_unidade: "kg",
  atingivel: "", relevante: "", prazo: "", progresso: 0, status: "ativo",
});

export function PlanejarSmart({ userId }: { userId?: string }) {
  const { orgId } = useOrg();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Smart>(empty());

  const load = async () => {
    if (!userId) return;
    const { data } = await supabase.from("objetivos_smart").select("*")
      .eq("user_id", userId).order("mes_ano", { ascending: false }).order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, [userId]);

  const salvar = async () => {
    if (!userId || !orgId) return;
    if (!form.especifico.trim()) return toast.error("Descreva o objetivo (Específico)");
    const payload: any = {
      user_id: userId, organizacao_id: orgId,
      mes_ano: form.mes_ano,
      especifico: form.especifico.trim(),
      mensuravel: form.mensuravel.trim() || null,
      meta_valor: form.meta_valor ? Number(form.meta_valor) : null,
      meta_unidade: form.meta_unidade || null,
      atingivel: form.atingivel.trim() || null,
      relevante: form.relevante.trim() || null,
      prazo: form.prazo || null,
      progresso: Number(form.progresso) || 0,
      status: form.status,
    };
    let error;
    if (form.id) {
      ({ error } = await supabase.from("objetivos_smart").update(payload).eq("id", form.id));
    } else {
      ({ error } = await supabase.from("objetivos_smart").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Atualizado" : "Objetivo criado");
    setOpen(false); setForm(empty()); load();
  };

  const editar = (it: any) => {
    setForm({
      id: it.id, mes_ano: it.mes_ano, especifico: it.especifico ?? "",
      mensuravel: it.mensuravel ?? "", meta_valor: it.meta_valor != null ? String(it.meta_valor) : "",
      meta_unidade: it.meta_unidade ?? "kg", atingivel: it.atingivel ?? "",
      relevante: it.relevante ?? "", prazo: it.prazo ?? "",
      progresso: it.progresso ?? 0, status: it.status ?? "ativo",
    });
    setOpen(true);
  };

  const remove = async (id: string) => {
    await supabase.from("objetivos_smart").delete().eq("id", id);
    toast.success("Removido"); load();
  };

  const atualizarProgresso = async (id: string, p: number) => {
    await supabase.from("objetivos_smart").update({
      progresso: p, status: p >= 100 ? "concluido" : "ativo",
    }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">Objetivos SMART</p>
        </div>
        <Button size="sm" onClick={() => { setForm(empty()); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />Novo
        </Button>
      </div>

      {items.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum objetivo SMART ainda.<br />
          <span className="text-[11px]">Defina metas <b>Específicas, Mensuráveis, Atingíveis, Relevantes</b> e com prazo.</span>
        </Card>
      )}

      {items.map((it) => (
        <Card key={it.id} className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">{it.mes_ano}</Badge>
                {it.status === "concluido" && <Badge className="text-[10px] bg-primary text-primary-foreground">Concluído</Badge>}
                {it.status === "cancelado" && <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>}
                {it.prazo && <Badge variant="secondary" className="text-[10px]">até {new Date(it.prazo + "T00:00:00").toLocaleDateString("pt-BR")}</Badge>}
              </div>
              <p className="text-sm font-medium mt-1">{it.especifico}</p>
              {it.mensuravel && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  📊 {it.mensuravel}
                  {it.meta_valor != null && ` — meta: ${Number(it.meta_valor).toLocaleString("pt-BR")} ${it.meta_unidade ?? ""}`}
                </p>
              )}
              {it.atingivel && <p className="text-[11px] text-muted-foreground mt-0.5">✅ {it.atingivel}</p>}
              {it.relevante && <p className="text-[11px] text-muted-foreground mt-0.5">⭐ {it.relevante}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editar(it)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(it.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Progresso</span>
              <span className="text-[11px] font-semibold">{it.progresso ?? 0}%</span>
            </div>
            <Progress value={Number(it.progresso) || 0} className="h-2" />
            <div className="flex gap-1 pt-1">
              {[25, 50, 75, 100].map((p) => (
                <Button key={p} size="sm" variant="outline" className="flex-1 h-7 text-[11px]" onClick={() => atualizarProgresso(it.id, p)}>
                  {p === 100 ? <Check className="h-3 w-3" /> : `${p}%`}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} objetivo SMART</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Mês (AAAA-MM)</Label>
                <Input value={form.mes_ano} onChange={(e) => setForm({ ...form, mes_ano: e.target.value })} placeholder="2025-12" />
              </div>
              <div>
                <Label className="text-xs">Prazo</Label>
                <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="text-xs"><b>S</b>pecífico — o que exatamente?</Label>
              <Textarea rows={2} value={form.especifico} onChange={(e) => setForm({ ...form, especifico: e.target.value })} placeholder="Ex.: Conquistar 5 novos clientes na linha Premium na região oeste" />
            </div>

            <div>
              <Label className="text-xs"><b>M</b>ensurável — como vou medir?</Label>
              <Input value={form.mensuravel} onChange={(e) => setForm({ ...form, mensuravel: e.target.value })} placeholder="Ex.: Pedidos fechados acima de 1.000 kg" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Meta numérica</Label>
                <Input type="number" value={form.meta_valor} onChange={(e) => setForm({ ...form, meta_valor: e.target.value })} placeholder="5000" />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.meta_unidade} onValueChange={(v) => setForm({ ...form, meta_unidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="R$">R$</SelectItem>
                    <SelectItem value="clientes">clientes</SelectItem>
                    <SelectItem value="visitas">visitas</SelectItem>
                    <SelectItem value="pedidos">pedidos</SelectItem>
                    <SelectItem value="%">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs"><b>A</b>tingível — é realista? Como?</Label>
              <Input value={form.atingivel} onChange={(e) => setForm({ ...form, atingivel: e.target.value })} placeholder="Ex.: Visitando 2 prospectos por semana" />
            </div>

            <div>
              <Label className="text-xs"><b>R</b>elevante — por que importa?</Label>
              <Input value={form.relevante} onChange={(e) => setForm({ ...form, relevante: e.target.value })} placeholder="Ex.: Diversificar carteira e aumentar margem" />
            </div>

            <div>
              <Label className="text-xs">Progresso atual: {form.progresso}%</Label>
              <Input type="range" min={0} max={100} step={5} value={form.progresso} onChange={(e) => setForm({ ...form, progresso: Number(e.target.value) })} />
            </div>

            <Button onClick={salvar} className="w-full">
              <Check className="mr-2 h-4 w-4" />Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}