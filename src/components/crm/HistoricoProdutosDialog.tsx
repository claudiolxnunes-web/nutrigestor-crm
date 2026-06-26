import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";

type VendaProd = {
  cod_produto: string | null;
  nome_produto: string | null;
  linha: string | null;
  volume_kg: number | null;
  qtde_sacos: number | null;
  faturamento_realizado: number | null;
  mb_cb_total: number | null;
  mes_ano: string | null;
  nota_fiscal: string | null;
  cod_cliente: string | null;
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const fmtPct = (n: number) => `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

interface Props {
  open: boolean;
  onClose: () => void;
}

type Metric = "faturamento" | "volume" | "margem";

export const HistoricoProdutosDialog = ({ open, onClose }: Props) => {
  const [vendas, setVendas] = useState<VendaProd[]>([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<Metric>("faturamento");
  const [periodo, setPeriodo] = useState<"3m" | "6m" | "12m" | "all">("12m");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("vendas")
        .select("cod_produto, nome_produto, linha, volume_kg, qtde_sacos, faturamento_realizado, mb_cb_total, mes_ano, nota_fiscal, cod_cliente")
        .order("data_nf", { ascending: false })
        .limit(50000);
      if (!cancelled) {
        setVendas((data ?? []) as VendaProd[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const mesesValidos = useMemo(() => {
    if (periodo === "all") return null;
    const n = periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
    const meses: string[] = [];
    const d = new Date();
    for (let i = 0; i < n; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      meses.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
    }
    return new Set(meses);
  }, [periodo]);

  const filtradas = useMemo(() => {
    if (!mesesValidos) return vendas;
    return vendas.filter((v) => v.mes_ano && mesesValidos.has(v.mes_ano));
  }, [vendas, mesesValidos]);

  const ranking = useMemo(() => {
    const map = new Map<string, {
      cod: string; nome: string; linha: string;
      fat: number; vol: number; mb: number;
      sacos: number; nfs: Set<string>; clientes: Set<string>;
    }>();
    filtradas.forEach((v) => {
      const key = v.cod_produto || v.nome_produto || "—";
      const cur = map.get(key) ?? {
        cod: v.cod_produto ?? "—",
        nome: v.nome_produto ?? key,
        linha: v.linha ?? "—",
        fat: 0, vol: 0, mb: 0, sacos: 0,
        nfs: new Set<string>(), clientes: new Set<string>(),
      };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      cur.mb += Number(v.mb_cb_total) || 0;
      cur.sacos += Number(v.qtde_sacos) || 0;
      if (v.nota_fiscal) cur.nfs.add(v.nota_fiscal);
      if (v.cod_cliente) cur.clientes.add(v.cod_cliente);
      if (v.nome_produto) cur.nome = v.nome_produto;
      if (v.linha) cur.linha = v.linha;
      map.set(key, cur);
    });
    const arr = Array.from(map.values()).map((p) => ({
      ...p,
      nfsCount: p.nfs.size,
      clientesCount: p.clientes.size,
      valor: metric === "faturamento" ? p.fat : metric === "volume" ? p.vol : p.mb,
    }));
    arr.sort((a, b) => b.valor - a.valor);

    // ABC: A até 80%, B até 95%, C resto
    const total = arr.reduce((s, x) => s + x.valor, 0);
    let acc = 0;
    const withCurva = arr.map((p) => {
      acc += p.valor;
      const accPct = total > 0 ? acc / total : 0;
      const curva: "A" | "B" | "C" = accPct <= 0.8 ? "A" : accPct <= 0.95 ? "B" : "C";
      return { ...p, accPct, share: total > 0 ? p.valor / total : 0, curva };
    });
    return { items: withCurva, total };
  }, [filtradas, metric]);

  const resumoCurva = useMemo(() => {
    const r = { A: { qtd: 0, valor: 0 }, B: { qtd: 0, valor: 0 }, C: { qtd: 0, valor: 0 } };
    ranking.items.forEach((p) => { r[p.curva].qtd++; r[p.curva].valor += p.valor; });
    return r;
  }, [ranking]);

  const fmtMetric = (n: number) => metric === "volume" ? `${fmtNum(n)} kg` : fmtBRL(n);
  const metricLabel = metric === "faturamento" ? "Faturamento" : metric === "volume" ? "Volume (kg)" : "Margem Bruta";

  const curvaA = ranking.items.filter((p) => p.curva === "A");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-6xl rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
        <DialogHeader className="p-6 md:p-10 pb-0 text-left">
          <DialogTitle className="text-xl md:text-2xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">Histórico de Produtos · Curva ABC</DialogTitle>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 leading-relaxed">
            Ranking por {metricLabel.toLowerCase()} com classificação Pareto (A: 80% · B: 15% · C: 5%).
          </p>
        </DialogHeader>

        <div className="p-6 md:p-10 pt-4 md:pt-6 space-y-6 max-h-[75vh] overflow-y-auto overflow-x-hidden border-t border-slate-100 dark:border-white/5 mt-4">
          <div className="flex flex-wrap gap-3 items-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Métrica</p>
            <ToggleGroup type="single" value={metric} onValueChange={(v) => v && setMetric(v as Metric)} variant="outline" size="sm">
              <ToggleGroupItem value="faturamento">Faturamento</ToggleGroupItem>
              <ToggleGroupItem value="volume">Volume</ToggleGroupItem>
              <ToggleGroupItem value="margem">Margem</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Período</p>
            <ToggleGroup type="single" value={periodo} onValueChange={(v) => v && setPeriodo(v as any)} variant="outline" size="sm">
              <ToggleGroupItem value="3m">3M</ToggleGroupItem>
              <ToggleGroupItem value="6m">6M</ToggleGroupItem>
              <ToggleGroupItem value="12m">12M</ToggleGroupItem>
              <ToggleGroupItem value="all">Tudo</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center"><Badge variant="secondary">Carregando…</Badge></div>
        ) : ranking.items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Sem vendas no período selecionado.</div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Total ({metricLabel})</p>
                <p className="text-lg font-bold text-primary">{fmtMetric(ranking.total)}</p>
                <p className="text-[11px] text-muted-foreground">{ranking.items.length} SKUs</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border-l-4 border-primary">
                <p className="text-xs text-muted-foreground">Curva A (80%)</p>
                <p className="text-lg font-bold text-primary">{resumoCurva.A.qtd} SKUs</p>
                <p className="text-[11px] text-muted-foreground">{fmtMetric(resumoCurva.A.valor)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border-l-4 border-secondary">
                <p className="text-xs text-muted-foreground">Curva B (15%)</p>
                <p className="text-lg font-bold">{resumoCurva.B.qtd} SKUs</p>
                <p className="text-[11px] text-muted-foreground">{fmtMetric(resumoCurva.B.valor)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 border-l-4 border-muted">
                <p className="text-xs text-muted-foreground">Curva C (5%)</p>
                <p className="text-lg font-bold">{resumoCurva.C.qtd} SKUs</p>
                <p className="text-[11px] text-muted-foreground">{fmtMetric(resumoCurva.C.valor)}</p>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-primary mb-2">Curva A — produtos críticos ({curvaA.length})</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead className="text-right">{metricLabel}</TableHead>
                      <TableHead className="text-right">% do total</TableHead>
                      <TableHead className="text-right">% acum.</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                      <TableHead className="text-right">NFs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {curvaA.map((p, i) => (
                      <TableRow key={p.cod + p.nome}>
                        <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{p.cod}</TableCell>
                        <TableCell className="max-w-[260px] truncate" title={p.nome}>{p.nome}</TableCell>
                        <TableCell className="text-xs">{p.linha}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtMetric(p.valor)}</TableCell>
                        <TableCell className="text-right">{fmtPct(p.share)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtPct(p.accPct)}</TableCell>
                        <TableCell className="text-right">{p.clientesCount}</TableCell>
                        <TableCell className="text-right">{p.nfsCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-primary mb-2">Ranking completo ({ranking.items.length})</h3>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Curva</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead className="text-right">{metricLabel}</TableHead>
                      <TableHead className="text-right">% acum.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.items.map((p, i) => (
                      <TableRow key={"all-" + p.cod + p.nome}>
                        <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                        <TableCell>
                          <Badge variant={p.curva === "A" ? "default" : p.curva === "B" ? "secondary" : "outline"}>
                            {p.curva}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.cod}</TableCell>
                        <TableCell className="max-w-[260px] truncate" title={p.nome}>{p.nome}</TableCell>
                        <TableCell className="text-xs">{p.linha}</TableCell>
                        <TableCell className="text-right">{fmtMetric(p.valor)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmtPct(p.accPct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </section>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
