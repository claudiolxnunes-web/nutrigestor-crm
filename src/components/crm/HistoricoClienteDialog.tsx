import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Venda = {
  id: string;
  data_nf: string | null;
  nota_fiscal: string | null;
  pedido: string | null;
  cod_produto: string | null;
  nome_produto: string | null;
  linha: string | null;
  volume_kg: number | null;
  qtde_sacos: number | null;
  preco_kg: number | null;
  faturamento_realizado: number | null;
  desconto_pct: number | null;
  representante: string | null;
  cod_rc: string | null;
  mes_ano: string | null;
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const fmtNum = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });

interface Props {
  open: boolean;
  onClose: () => void;
  clienteNome: string;
  codCliente?: string | null;
}

export const HistoricoClienteDialog = ({ open, onClose, clienteNome, codCliente }: Props) => {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("vendas")
        .select("id, data_nf, nota_fiscal, pedido, cod_produto, nome_produto, linha, volume_kg, qtde_sacos, preco_kg, faturamento_realizado, desconto_pct, representante, cod_rc, mes_ano")
        .order("data_nf", { ascending: false })
        .limit(5000);
      if (codCliente) q = q.eq("cod_cliente", codCliente);
      else q = q.eq("nome_cliente", clienteNome);
      const { data } = await q;
      if (!cancelled) {
        setVendas((data ?? []) as Venda[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, clienteNome, codCliente]);

  const kpis = useMemo(() => {
    const fat = vendas.reduce((a, v) => a + (Number(v.faturamento_realizado) || 0), 0);
    const vol = vendas.reduce((a, v) => a + (Number(v.volume_kg) || 0), 0);
    const nfs = new Set(vendas.map((v) => v.nota_fiscal).filter(Boolean)).size;
    const ticket = nfs > 0 ? fat / nfs : 0;
    const ultima = vendas[0]?.data_nf ?? "—";
    return { fat, vol, nfs, ticket, ultima };
  }, [vendas]);

  const porMes = useMemo(() => {
    const map = new Map<string, { mes: string; fat: number; vol: number }>();
    vendas.forEach((v) => {
      const k = v.mes_ano || "—";
      const cur = map.get(k) ?? { mes: k, fat: 0, vol: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.mes.localeCompare(a.mes)).slice(0, 12);
  }, [vendas]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary">{clienteNome}</DialogTitle>
          <p className="text-xs text-muted-foreground">{codCliente ? `Cód. ${codCliente} · ` : ""}Histórico individualizado de vendas</p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Badge variant="secondary">Carregando…</Badge></div>
        ) : vendas.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">Sem vendas registradas para este cliente.</div>
        ) : (
          <div className="space-y-5">
            <section className="grid gap-3 grid-cols-2 md:grid-cols-5">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Faturamento total</p>
                <p className="text-lg font-bold text-primary">{fmtBRL(kpis.fat)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Volume (kg)</p>
                <p className="text-lg font-bold">{fmtNum(kpis.vol)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-lg font-bold">{kpis.nfs}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Ticket médio/NF</p>
                <p className="text-lg font-bold">{fmtBRL(kpis.ticket)}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Última compra</p>
                <p className="text-lg font-bold">{kpis.ultima}</p>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-primary mb-2">Por mês (últimos 12)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Volume (kg)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porMes.map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell className="font-mono text-xs">{m.mes}</TableCell>
                      <TableCell className="text-right">{fmtBRL(m.fat)}</TableCell>
                      <TableCell className="text-right">{fmtNum(m.vol)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-primary mb-2">Notas individualizadas ({vendas.length} itens)</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead className="text-right">Vol. (kg)</TableHead>
                      <TableHead className="text-right">Preço/kg</TableHead>
                      <TableHead className="text-right">Desc. %</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead>RC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{v.data_nf ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{v.nota_fiscal ?? "—"}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={v.nome_produto ?? ""}>{v.nome_produto ?? "—"}</TableCell>
                        <TableCell className="text-xs">{v.linha ?? "—"}</TableCell>
                        <TableCell className="text-right">{fmtNum(Number(v.volume_kg) || 0)}</TableCell>
                        <TableCell className="text-right">{v.preco_kg ? fmtBRL(Number(v.preco_kg)) : "—"}</TableCell>
                        <TableCell className="text-right">{v.desconto_pct != null ? `${fmtNum(Number(v.desconto_pct), 1)}%` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(Number(v.faturamento_realizado) || 0)}</TableCell>
                        <TableCell className="text-xs">{v.representante ?? v.cod_rc ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};