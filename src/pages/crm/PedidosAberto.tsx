import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "@e965/xlsx";
 import { Upload, Loader2, Package, AlertTriangle, Clock, CheckCircle2, Trash2, RefreshCw, Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/services/crmService";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { crmService } from "@/services/crmService";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";

type Pedido = {
  id: string;
  pedido: string;
  filial: string | null;
  status_tracking: string | null;
  bloqueio: string | null;
  motivo_bloqueio_fin: string | null;
  motivo_bloqueio_presc: string | null;
  data_inclusao: string | null;
  prev_faturamento: string | null;
  entrega_solicitada: string | null;
  cod_rc: string | null;
  rc_nome: string | null;
  cod_cliente: string | null;
  cliente_nome: string | null;
  categoria: string | null;
  segmento: string | null;
  linha: string | null;
  cod_produto: string | null;
  produto: string | null;
  valor: number | null;
  volume: number | null;
  eh_vef: string | null;
  data_snapshot: string | null;
};

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const txt = (v: any) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const num = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/[^\d\.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const toIsoDate = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    const [, dd, mm, yy] = br;
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
};

// mapa: header normalizado -> coluna do banco
const COL_MAP: Record<string, string> = {
  "status tracking": "status_tracking",
  "filial": "filial",
  "pedido": "pedido",
  "inclusao do pedido": "data_inclusao",
  "prev fat solicitada": "prev_faturamento",
  "prev. fat. solicitada": "prev_faturamento",
  "entrega solicitada": "entrega_solicitada",
  "bloqueio": "bloqueio",
  "motivo bloqueio financeiro": "motivo_bloqueio_fin",
  "motivo bloqueio prescricao": "motivo_bloqueio_presc",
  "cod erc": "cod_rc",
  "erc": "rc_nome",
  "cod cliente": "cod_cliente",
  "cliente": "cliente_nome",
  "categoria": "categoria",
  "seg.": "segmento",
  "seg": "segmento",
  "linha": "linha",
  "cod. produto": "cod_produto",
  "cod produto": "cod_produto",
  "produto": "produto",
  "pedido valor": "valor",
  "pedido volume": "volume",
  "e vef?": "eh_vef",
  "e vef": "eh_vef",
};

const DATE_COLS = new Set(["data_inclusao", "prev_faturamento", "entrega_solicitada"]);
const NUM_COLS = new Set(["valor", "volume"]);

const statusVariant = (s: string | null) => {
  if (!s) return "secondary";
  const n = norm(s);
  if (n.includes("bloque")) return "destructive";
  if (n.includes("separ")) return "default";
  if (n.includes("produc") || n.includes("produç")) return "secondary";
  if (n.includes("fatur")) return "outline";
  return "outline";
};

export default function PedidosAberto() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { isGestor, isRC, representativeCode, gestorCode, loading: roleLoading } = useRole();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fRC, setFRC] = useState<string>("todos");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);

  const carregar = async () => {
    if (!orgId || roleLoading) return;
    setLoading(true);
    
    try {
      const data = await crmService.getPedidosAberto(orgId, isRC ? representativeCode : null, isGestor ? gestorCode : null) as Pedido[];
      
      const filteredData = data;

      setPedidos(filteredData);
      setSnapshot(filteredData[0]?.data_snapshot ?? null);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading) {
      carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, roleLoading, isGestor, representativeCode]);

  const handleFile = async (file: File) => {
    if (!user || !orgId) return toast.error("Sem organização");
    if (!isGestor) return toast.error("Apenas gestor pode importar");
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null });
      if (!rows.length) {
        toast.error("Planilha vazia");
        return;
      }
      // normaliza headers
      const sample = rows[0];
      const headerMap: Record<string, string> = {};
      Object.keys(sample).forEach((h) => {
        const k = norm(h).replace(/\s+/g, " ");
        if (COL_MAP[k]) headerMap[h] = COL_MAP[k];
      });
      const today = new Date().toISOString().slice(0, 10);
      const mapped = rows
        .map((r) => {
          const out: any = {
            organizacao_id: orgId,
            user_id: user.id,
            data_snapshot: today,
          };
          Object.entries(headerMap).forEach(([h, dbCol]) => {
            const v = r[h];
            if (NUM_COLS.has(dbCol)) out[dbCol] = num(v);
            else if (DATE_COLS.has(dbCol)) out[dbCol] = toIsoDate(v);
            else out[dbCol] = txt(v);
          });
          return out;
        })
        .filter((r) => r.pedido); // pedido obrigatório

      // substitui snapshot: deleta tudo da org e insere
      const { error: delErr } = await supabase
        .from("pedidos_aberto")
        .delete()
        .eq("organizacao_id", orgId);
      if (delErr) throw delErr;

      // insere em chunks
      const chunkSize = 500;
      let inserted = 0;
      for (let i = 0; i < mapped.length; i += chunkSize) {
        const chunk = mapped.slice(i, i + chunkSize);
        const { error } = await supabase.from("pedidos_aberto").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
       // Atualiza os preços médios nos produtos após a importação
       const { error: rpcErr } = await supabase.rpc('atualizar_precos_medios_produtos', { _organizacao_id: orgId });
       if (rpcErr) console.error("Erro ao atualizar preços médios:", rpcErr);

       toast.success(`${inserted} linhas importadas e preços médios atualizados (snapshot ${today})`);
       await carregar();
    } catch (e: any) {
      toast.error("Erro: " + (e.message ?? String(e)));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const recalcularPrecos = async () => {
    if (!orgId) return;
    setCalculating(true);
    try {
      const { error } = await supabase.rpc('atualizar_precos_medios_produtos', { _organizacao_id: orgId });
      if (error) throw error;
      toast.success("Preços médios recalculados com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao recalcular preços: " + (e.message ?? String(e)));
    } finally {
      setCalculating(false);
    }
  };

  const limpar = async () => {
    if (!orgId) return;
    if (!confirm("Apagar todos os pedidos em aberto?")) return;
    const { error } = await supabase.from("pedidos_aberto").delete().eq("organizacao_id", orgId);
    if (error) toast.error("Erro ao limpar");
    else {
      toast.success("Limpo");
      carregar();
    }
  };

  // filtros
  const rcs = useMemo(() => {
    const set = new Map<string, string>();
    pedidos.forEach((p) => {
      if (p.cod_rc) set.set(p.cod_rc, p.rc_nome ?? p.cod_rc);
    });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [pedidos]);

  const statusList = useMemo(() => {
    const set = new Set<string>();
    pedidos.forEach((p) => p.status_tracking && set.add(p.status_tracking));
    return Array.from(set).sort();
  }, [pedidos]);

  const filtrados = useMemo(() => {
    const q = norm(busca);
    return pedidos.filter((p) => {
      if (fStatus !== "todos" && p.status_tracking !== fStatus) return false;
      if (fRC !== "todos" && p.cod_rc !== fRC) return false;
      if (!q) return true;
      return [p.pedido, p.cliente_nome, p.produto, p.rc_nome]
        .some((x) => x && norm(String(x)).includes(q));
    });
  }, [pedidos, busca, fStatus, fRC]);

  // KPIs
  const kpi = useMemo(() => {
    const totalValor = filtrados.reduce((a, p) => a + (p.valor ?? 0), 0);
    const totalVolume = filtrados.reduce((a, p) => a + (p.volume ?? 0), 0);
    const pedidosUnicos = new Set(filtrados.map((p) => p.pedido)).size;
    const bloqueados = new Set(
      filtrados.filter((p) => norm(p.status_tracking ?? "").includes("bloque")).map((p) => p.pedido)
    ).size;
    return { totalValor, totalVolume, pedidosUnicos, bloqueados };
  }, [filtrados]);

  return (
    <div>
      <Seo title="Pedidos em Aberto" description="Acompanhe a carteira de pedidos pendentes de faturamento por status, representante e cliente." path="/pedidos-aberto" />
      <PageHeader
        title="Pedidos em Aberto"
        subtitle={snapshot ? `Snapshot de ${new Date(snapshot + "T12:00").toLocaleDateString("pt-BR")}` : "Carteira de pedidos pendentes de faturamento"}
        actions={
          <div className="flex gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {isGestor && (
            <>
              <Button variant="outline" onClick={recalcularPrecos} disabled={calculating || loading} title="Recalcular preços médios com base nos pedidos atuais">
                {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                {calculating ? "Recalculando..." : "Recalcular Preços"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? "Importando..." : "Importar Snapshot"}
              </Button>
              {pedidos.length > 0 && (
                <Button variant="outline" onClick={limpar}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          </div>
        }
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard icon={<Package className="h-5 w-5" />} label="Pedidos" value={fmtNum(kpi.pedidosUnicos)} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-destructive" />} label="Bloqueados" value={fmtNum(kpi.bloqueados)} />
        <KpiCard icon={<Clock className="h-5 w-5" />} label="Valor total" value={fmtBRL(kpi.totalValor)} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Volume (kg)" value={fmtNum(kpi.totalVolume)} />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Buscar pedido, cliente, produto, RC..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statusList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fRC} onValueChange={setFRC}>
          <SelectTrigger className="w-56"><SelectValue placeholder="RC" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os RCs</SelectItem>
            {rcs.map(([cod, nome]) => <SelectItem key={cod} value={cod}>{nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-2xl overflow-hidden p-0 sm:p-2" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="overflow-x-auto px-1 sm:px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>RC</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Prev. Fat.</TableHead>
                <TableHead>Bloqueio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {pedidos.length === 0 ? "Nenhum pedido importado. Clique em Importar Snapshot." : "Nenhum resultado para os filtros."}
                </TableCell></TableRow>
              ) : (
                filtrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.pedido}</TableCell>
                    <TableCell>
                      {p.status_tracking && (
                        <Badge variant={statusVariant(p.status_tracking) as any}>{p.status_tracking}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={p.cliente_nome ?? ""}>{p.cliente_nome}</TableCell>
                    <TableCell className="max-w-[160px] truncate" title={p.rc_nome ?? ""}>{p.rc_nome}</TableCell>
                    <TableCell className="max-w-[180px] truncate" title={p.produto ?? ""}>{p.produto}</TableCell>
                    <TableCell className="text-right">{fmtNum(p.volume ?? 0)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(p.valor ?? 0)}</TableCell>
                    <TableCell>{p.prev_faturamento ? new Date(p.prev_faturamento + "T12:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate" title={p.bloqueio ?? ""}>{p.bloqueio ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-muted-foreground">{label}</h3>
        {icon}
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
    </div>
  );
}