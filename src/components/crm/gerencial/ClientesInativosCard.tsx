import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, UserX, Download, Plus, Loader2, Users, MessageCircle, Filter, Calendar, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { toast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type VendaRow = {
  cod_rc: string | null;
  representante: string | null;
  cod_cliente: string | null;
  nome_cliente: string | null;
  municipio: string | null;
  uf: string | null;
  linha: string | null;
  data_nf: string | null;
  faturamento_realizado: number | null;
  volume_kg: number | null;
};

type RepRow = { cod_rc: string | null; auth_user_id: string | null; nome: string };

type ClienteAgg = {
  key: string;
  nome: string;
  cod_cliente: string | null;
  cidade: string;
  cod_rc: string | null;
  rc_nome: string;
  ultimaCompra: string;
  diasSemComprar: number;
  totalFat: number;
  totalVol: number;
  qtdNotas: number;
  ticketMedio: number;
  nivel: "risco" | "inativo";
  ultimas: { data: string; linha: string; valor: number; volume: number }[];
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDate = (s: string) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const diffDays = (from: string, to: Date) => {
  if (!from) return 999;
  const a = new Date(from).getTime();
  if (isNaN(a)) return 999;
  const b = new Date(to.toISOString().slice(0, 10)).getTime();
  return Math.floor((b - a) / 86400000);
};

 export const ClientesInativosCard = ({ rcCode, gestorCode }: { rcCode?: string | null, gestorCode?: string | null }) => {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
   const [rows, setRows] = useState<ClienteAgg[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "risco" | "inativo">("todos");
  const [busca, setBusca] = useState("");
  const [filtroDias, setFiltroDias] = useState<string>("90");
  const [filtroRC, setFiltroRC] = useState<string>("todos");
  const [expandido, setExpandido] = useState<string | null>(null); // key of client
  const [repExpandido, setRepExpandido] = useState<string | null>(null); // cod_rc
  const [abaAtiva, setAbaAtiva] = useState<"geral" | "por_rc">("geral");
  const [criando, setCriando] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      
      if (!orgId) {
        setLoading(false);
        return;
      }

      // 1. Busca TODOS os clientes da organização
      let clientesQuery = supabase.from("clientes")
        .select("codigo, razao_social, cidade, estado, ultima_compra, cod_rc, representante")
        .eq("organizacao_id", orgId);

      if (rcCode) {
        clientesQuery = clientesQuery.eq("cod_rc", rcCode);
      } else if (gestorCode) {
        clientesQuery = clientesQuery.eq("cod_gestor", gestorCode);
      } else if (user?.id) {
        const { data: userRoles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        const roles = (userRoles ?? []).map(r => r.role);
        if (roles.includes("rc") && !roles.includes("gestor") && !roles.includes("super_admin")) {
          const { data: rep } = await supabase.from("representantes").select("cod_rc").eq("auth_user_id", user.id).maybeSingle();
          if (rep?.cod_rc) clientesQuery = clientesQuery.eq("cod_rc", rep.cod_rc);
        }
      }

      const { data: clientesData, error: clientesError } = await clientesQuery;
      
      if (clientesError) {
        toast({ title: "Erro ao carregar clientes", description: clientesError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      // 2. Busca vendas recentes para estatísticas (últimos 36 meses)
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 36);
      const dt = desde.toISOString().slice(0, 10);

      const PAGE = 1000;
      const allVendas: VendaRow[] = [];
      for (let from = 0; from < 100000; from += PAGE) {
        let query = supabase
          .from("vendas")
          .select("cod_rc, representante, cod_cliente, nome_cliente, municipio, uf, linha, data_nf, faturamento_realizado, volume_kg")
          .eq("organizacao_id", orgId)
          .gte("data_nf", dt);

        if (rcCode) query = query.eq("cod_rc", rcCode);
        else if (gestorCode) query = query.eq("cod_gestor", gestorCode);

        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error || !data) break;
        allVendas.push(...(data as VendaRow[]));
        if (data.length < PAGE) break;
      }

      // 3. Busca representantes para garantir nomes corretos
      const { data: repsData } = await supabase.from("representantes")
        .select("cod_rc, nome")
        .eq("organizacao_id", orgId);
      
      const repByCod = new Map<string, string>();
      (repsData ?? []).forEach(r => r.cod_rc && repByCod.set(r.cod_rc, r.nome));

      // 4. Agrega vendas por cliente
      const vendasByCliente = new Map<string, { totalFat: number, totalVol: number, qtdNotas: number, ultimas: any[] }>();
      for (const v of allVendas) {
        const key = (v.cod_cliente?.trim() || v.nome_cliente?.trim() || "").toLowerCase();
        if (!key) continue;
        
        const cur = vendasByCliente.get(key) ?? { totalFat: 0, totalVol: 0, qtdNotas: 0, ultimas: [] };
        cur.totalFat += Number(v.faturamento_realizado) || 0;
        cur.totalVol += Number(v.volume_kg) || 0;
        cur.qtdNotas += 1;
        if (cur.ultimas.length < 5) {
          cur.ultimas.push({
            data: v.data_nf,
            linha: v.linha ?? "—",
            valor: Number(v.faturamento_realizado) || 0,
            volume: Number(v.volume_kg) || 0,
          });
        }
        vendasByCliente.set(key, cur);
      }

      // 5. Constrói o resultado final a partir da lista de clientes
      const hoje = new Date();
      const result: ClienteAgg[] = [];

      (clientesData ?? []).forEach(cli => {
        const ultima = cli.ultima_compra;
        const dias = ultima ? diffDays(ultima, hoje) : 999; // Se não tem data, é muito antigo

        if (dias < 90) return; // Só interessa acima de 3 meses

        const key = (cli.codigo?.trim() || cli.razao_social?.trim() || "").toLowerCase();
        const stats = vendasByCliente.get(key) || { totalFat: 0, totalVol: 0, qtdNotas: 0, ultimas: [] };
        
        result.push({
          key,
          nome: cli.razao_social || "Sem nome",
          cod_cliente: cli.codigo || null,
          cidade: [cli.cidade, cli.estado].filter(Boolean).join("/"),
          cod_rc: cli.cod_rc || null,
          rc_nome: repByCod.get(cli.cod_rc || "") || cli.representante || "—",
          ultimaCompra: ultima || "2000-01-01",
          diasSemComprar: dias,
          totalFat: stats.totalFat,
          totalVol: stats.totalVol,
          qtdNotas: stats.qtdNotas,
          ticketMedio: stats.qtdNotas > 0 ? stats.totalFat / stats.qtdNotas : 0,
          nivel: dias >= 180 ? "inativo" : "risco",
          ultimas: stats.ultimas.sort((a, b) => (a.data < b.data ? 1 : -1))
        });
      });

      if (cancelled) return;
      setRows(result.sort((a, b) => b.totalFat - a.totalFat));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgId, rcCode, gestorCode, user?.id]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const minDias = parseInt(filtroDias);
    
    return rows.filter((r) => {
      // Filtro por Nível (Risco/Inativo)
      if (filtro !== "todos" && r.nivel !== filtro) return false;
      
      // Filtro por Dias sem comprar (Slider)
      if (r.diasSemComprar < minDias) return false;
      
      // Filtro por Representante (Select)
      if (filtroRC !== "todos" && r.cod_rc !== filtroRC) return false;
      
      // Filtro de Busca (Texto)
      if (t && !r.nome.toLowerCase().includes(t) && !r.rc_nome.toLowerCase().includes(t)) return false;
      
      return true;
    });
  }, [rows, filtro, busca, filtroDias, filtroRC]);

  const listaRepresentantes = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => {
      if (r.cod_rc) map.set(r.cod_rc, r.rc_nome);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const totais = useMemo(() => {
    const risco = rows.filter((r) => r.nivel === "risco");
    const inativo = rows.filter((r) => r.nivel === "inativo");
    return {
      risco: risco.length,
      inativo: inativo.length,
      faturamentoEmRisco: risco.reduce((s, r) => s + r.totalFat, 0),
      faturamentoInativo: inativo.reduce((s, r) => s + r.totalFat, 0),
    };
  }, [rows]);

  const exportarCSV = (clientesParaExportar?: ClienteAgg[], nomeArquivo?: string) => {
    const lista = clientesParaExportar || filtrados;
    const header = ["Cliente", "Cidade", "Cód. RC", "Representante", "Última compra", "Dias sem comprar", "Nível", "Faturamento 18m", "Notas", "Ticket médio"].join(";");
    const linhas = lista.map((r) =>
      [r.nome, r.cidade, r.cod_rc || "—", r.rc_nome, fmtDate(r.ultimaCompra), r.diasSemComprar, r.nivel, r.totalFat.toFixed(2), r.qtdNotas, r.ticketMedio.toFixed(2)].join(";")
    );
    const csv = "\uFEFF" + [header, ...linhas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nomeArquivo || "clientes-inativos"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const criarAcaoRC = async (c: ClienteAgg) => {
    if (!user || !orgId) {
      toast({ title: "Sessão inválida", variant: "destructive" });
      return;
    }
    const r = c.cod_rc ? rows : null;
    // Pega auth_user_id atualizado do cadastro
    const { data: repData } = await supabase
      .from("representantes")
      .select("auth_user_id, nome")
      .eq("cod_rc", c.cod_rc ?? "")
      .maybeSingle();
    const rcUserId = (repData as any)?.auth_user_id;
    if (!rcUserId) {
      toast({
        title: "RC sem login vinculado",
        description: `Vincule o login do representante ${c.rc_nome} antes de criar a ação.`,
        variant: "destructive",
      });
      return;
    }
    setCriando(c.key);
    const titulo = `Recuperar cliente ${c.nivel === "inativo" ? "inativo" : "em risco"}: ${c.nome}`;
    const descricao =
      `Cliente sem comprar há ${c.diasSemComprar} dias (última compra ${fmtDate(c.ultimaCompra)}).\n` +
      `Faturamento últimos 18 meses: ${fmtBRL(c.totalFat)} em ${c.qtdNotas} notas (ticket médio ${fmtBRL(c.ticketMedio)}).\n` +
      `Cidade: ${c.cidade || "—"}\n\n` +
      `Plano sugerido: contato imediato, entender motivo de afastamento e propor visita técnica/comercial.`;
    const { error } = await supabase.from("acoes_gestor").insert({
      organizacao_id: orgId,
      gestor_id: user.id,
      rc_user_id: rcUserId,
      rc_nome: (repData as any)?.nome ?? c.rc_nome,
      titulo,
      descricao,
      prioridade: c.nivel === "inativo" ? "alta" : "media",
      status: "aberta",
      data_alvo: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    });
    setCriando(null);
    if (error) {
      toast({ title: "Erro ao criar ação", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ação criada para o RC", description: `${c.rc_nome} receberá no painel dele.` });
  };

  const enviarWhatsappRC = async (rep: { cod_rc: string; nome: string; clientes: ClienteAgg[] }) => {
    // Busca o telefone do representante
    const { data: repData } = await supabase
      .from("representantes")
      .select("telefone")
      .eq("cod_rc", rep.cod_rc)
      .maybeSingle();

    const telefone = repData?.telefone;
    
    if (!telefone) {
      toast({
        title: "Telefone não encontrado",
        description: `O representante ${rep.nome} não possui telefone cadastrado.`,
        variant: "destructive",
      });
      return;
    }

    const numInativos = rep.clientes.filter(c => c.nivel === "inativo").length;
    const numRisco = rep.clientes.filter(c => c.nivel === "risco").length;
    
    let msg = `Fala, ${rep.nome.split(' ')[0]}! 🚀\n\nPassando para compartilhar uma oportunidade de ouro para batermos as metas deste mês! Analisando aqui, vi que temos *${rep.clientes.length} parceiros* que estão sentindo sua falta e prontos para uma nova oportunidade conosco.\n`;
    
    if (numInativos > 0 || numRisco > 0) {
      msg += `\nSão clientes que já confiam no seu trabalho e que podemos trazer de volta com aquele seu atendimento diferenciado. 😉\n`;
    }
    
    msg += `\n*Destaques para uma visita estratégica:*\n`;
    
    // Pega os top 5 por faturamento histórico
    rep.clientes.slice(0, 5).forEach(c => {
      msg += `- *${c.nome}* (${c.diasSemComprar} dias sem pedido). O histórico dele é excelente: ${fmtBRL(c.totalFat)}!\n`;
    });

    msg += `\nBora reconectar com essa turma? Qualquer apoio que precisar na negociação, conte comigo! 👊🔥`;

    const encodedMsg = encodeURIComponent(msg);
    const tel = telefone.replace(/\D/g, "");
    const url = `https://wa.me/${tel.length <= 11 ? "55" + tel : tel}?text=${encodedMsg}`;
    
    window.open(url, "_blank");
  };

  const porRep = useMemo(() => {
    const map = new Map<string, { cod_rc: string; nome: string; clientes: ClienteAgg[] }>();
    filtrados.forEach((c) => {
      const key = c.cod_rc || "S/RC";
      const cur = map.get(key) ?? { cod_rc: key, nome: c.rc_nome, clientes: [] };
      cur.clientes.push(c);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.clientes.length - a.clientes.length);
  }, [filtrados]);

  return (
    <section id="clientes-inativos" className="premium-card p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h3 className="text-primary text-lg font-bold flex items-center gap-2">
            <UserX className="h-4 w-4" /> Gestão de Inatividade e Recuperação
          </h3>
          <p className="text-xs text-muted-foreground">
            Clientes em risco (90-180 dias) e Inativos (180+ dias). <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[9px] h-4">Análise 36 meses</Badge>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportarCSV()} disabled={loading || filtrados.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

       <div className="flex border-b mb-6">
         <button
           onClick={() => setAbaAtiva("geral")}
           className={cn(
             "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px]",
             abaAtiva === "geral" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
           )}
         >
           Visão Geral
         </button>
         <button
           onClick={() => setAbaAtiva("por_rc")}
           className={cn(
             "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px]",
             abaAtiva === "por_rc" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
           )}
         >
           Por Representante
         </button>
       </div>

      <div className="grid gap-4 mb-6">
        {/* Filtros Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
          {/* Busca e Nível */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
              <Search className="h-3 w-3" /> Buscar Cliente
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome ou RC..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 bg-white dark:bg-card"
              />
              <ToggleGroup type="single" value={filtro} onValueChange={(v) => v && setFiltro(v as any)} variant="outline" size="sm" className="bg-white dark:bg-card rounded-md border">
                <ToggleGroupItem value="todos" className="px-3">Todos</ToggleGroupItem>
                <ToggleGroupItem value="risco" className="px-3">Risco</ToggleGroupItem>
                <ToggleGroupItem value="inativo" className="px-3">Inativo</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {/* Filtro por Representante */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3 w-3" /> Filtrar por Representante
            </label>
            <Select value={filtroRC} onValueChange={setFiltroRC}>
              <SelectTrigger className="h-9 bg-white dark:bg-card">
                <SelectValue placeholder="Selecione um RC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Representantes</SelectItem>
                {listaRepresentantes.map(([cod, nome]) => (
                  <SelectItem key={cod} value={cod}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Tempo de Inatividade */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" /> Tempo sem comprar
              </label>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {filtroDias === "730" ? "2 anos+" : filtroDias === "365" ? "1 ano+" : `${filtroDias} dias+`}
              </span>
            </div>
            <div className="pt-2 px-1">
              <Slider
                value={[parseInt(filtroDias)]}
                max={730}
                min={90}
                step={30}
                onValueChange={(vals) => setFiltroDias(vals[0].toString())}
                className="cursor-pointer"
              />
              <div className="flex justify-between mt-1 px-1">
                <span className="text-[9px] text-muted-foreground font-medium">3 meses</span>
                <span className="text-[9px] text-muted-foreground font-medium">1 ano</span>
                <span className="text-[9px] text-muted-foreground font-medium">2 anos</span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicadores Rápidos */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border p-3 bg-white dark:bg-card/50 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">Filtrados em Risco</p>
            <p className="text-2xl font-bold text-amber-600">
              {filtrados.filter(f => f.nivel === "risco").length}
            </p>
            <p className="text-[10px] text-muted-foreground">de um total de {totais.risco}</p>
          </div>
          <div className="rounded-xl border p-3 bg-white dark:bg-card/50 shadow-sm">
            <p className="text-xs text-muted-foreground font-medium">Filtrados Inativos</p>
            <p className="text-2xl font-bold text-destructive">
              {filtrados.filter(f => f.nivel === "inativo").length}
            </p>
            <p className="text-[10px] text-muted-foreground">de um total de {totais.inativo}</p>
          </div>
          <div className="rounded-xl border p-3 bg-white dark:bg-card/50 shadow-sm col-span-1">
             <p className="text-xs text-muted-foreground font-medium">Faturamento Filtrado</p>
             <p className="text-xl font-bold text-primary">
               {fmtBRL(filtrados.reduce((s, r) => s + r.totalFat, 0))}
             </p>
             <p className="text-[10px] text-muted-foreground">Soma histórica</p>
          </div>
          <div className="flex items-center justify-center">
            { (filtroRC !== "todos" || filtroDias !== "90" || busca !== "" || filtro !== "todos") && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setFiltroRC("todos");
                  setFiltroDias("90");
                  setBusca("");
                  setFiltro("todos");
                }}
                className="text-xs text-muted-foreground hover:text-primary h-8"
              >
                Limpar todos os filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden min-h-[400px]">
        {abaAtiva === "geral" ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>RC</TableHead>
                  <TableHead className="text-center">Nível</TableHead>
                  <TableHead className="text-right">Última compra</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                  <TableHead className="text-right">Fat. 18m</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
                    </TableCell>
                  </TableRow>
                ) : filtrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      Nenhum cliente nessa faixa. 🎉
                    </TableCell>
                  </TableRow>
                ) : (
                  filtrados.map((c) => (
                    <ClientRow
                      key={c.key}
                      c={c}
                      isExpanded={expandido === c.key}
                      onToggle={() => setExpandido(expandido === c.key ? null : c.key)}
                      isCreating={criando === c.key}
                      onCreateAction={() => criarAcaoRC(c)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Processando dados...
              </div>
            ) : porRep.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Nenhum dado disponível.</div>
            ) : (
              porRep.map((rep) => {
                const isRepOpen = repExpandido === rep.cod_rc;
                const fatTotal = rep.clientes.reduce((s, c) => s + c.totalFat, 0);
                return (
                  <div key={rep.cod_rc} className="border rounded-xl overflow-hidden bg-white dark:bg-card/50 transition-all hover:shadow-md">
                    <div
                      className={cn(
                        "flex items-center justify-between p-4 cursor-pointer select-none",
                        isRepOpen ? "bg-accent/40" : "hover:bg-accent/20"
                      )}
                      onClick={() => setRepExpandido(isRepOpen ? null : rep.cod_rc)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm">{rep.nome}</h4>
                          <p className="text-xs text-muted-foreground font-mono">RC {rep.cod_rc}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Total Inativo</p>
                          <p className="text-sm font-bold text-destructive">{fmtBRL(fatTotal)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all hover:scale-105 active:scale-95"
                            title="Enviar lista por WhatsApp"
                            onClick={(e) => {
                              e.stopPropagation();
                              enviarWhatsappRC(rep);
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            title="Exportar CSV deste representante"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportarCSV(rep.clientes, `inativos-${rep.nome.replace(/\s+/g, "-").toLowerCase()}`);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <div className="text-center px-3 py-1 bg-muted rounded-full min-w-[100px]">
                            <span className="text-xs font-bold">{rep.clientes.length}</span>
                            <span className="text-[10px] ml-1 text-muted-foreground">clientes</span>
                          </div>
                        </div>
                        {isRepOpen ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                      </div>
                    </div>

                    {isRepOpen && (
                      <div className="p-2 bg-muted/20 border-t">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-8"></TableHead>
                              <TableHead className="text-xs">Cliente</TableHead>
                              <TableHead className="text-xs text-center">Nível</TableHead>
                              <TableHead className="text-xs text-right">Última Compra</TableHead>
                              <TableHead className="text-xs text-right">Valor Hist.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rep.clientes.map((c) => (
                              <ClientRow
                                key={c.key}
                                c={c}
                                isExpanded={expandido === c.key}
                                onToggle={() => setExpandido(expandido === c.key ? null : c.key)}
                                isCreating={criando === c.key}
                                onCreateAction={() => criarAcaoRC(c)}
                                compact
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
};

const ClientRow = ({
  c,
  isExpanded,
  onToggle,
  isCreating,
  onCreateAction,
  compact = false
}: {
  c: ClienteAgg;
  isExpanded: boolean;
  onToggle: () => void;
  isCreating: boolean;
  onCreateAction: () => void;
  compact?: boolean;
}) => {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-accent/40 transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <TableCell>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="font-medium text-sm">{c.nome}</div>
          <div className="text-[10px] text-muted-foreground">{c.cidade || "—"}</div>
        </TableCell>
        {!compact && (
          <TableCell className="text-xs">
            <div>{c.rc_nome}</div>
            <div className="text-muted-foreground font-mono">{c.cod_rc ?? "—"}</div>
          </TableCell>
        )}
        <TableCell className="text-center">
          <Badge variant={c.nivel === "inativo" ? "destructive" : "default"} className="text-[9px] px-1.5 py-0 h-5">
            {c.nivel === "inativo" ? "Inativo" : "Risco"}
          </Badge>
        </TableCell>
        <TableCell className="text-right text-xs">
          <div className="font-medium">{fmtDate(c.ultimaCompra)}</div>
          <div className="text-[10px] text-muted-foreground">{c.diasSemComprar} dias</div>
        </TableCell>
        {!compact && <TableCell className="text-right text-xs font-mono">{fmtBRL(c.totalFat)}</TableCell>}
        <TableCell className="text-right text-xs font-bold">{compact ? fmtBRL(c.totalFat) : fmtBRL(c.ticketMedio)}</TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={compact ? 4 : 7}>
            <div className="space-y-4 py-3 px-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="bg-white dark:bg-card p-2 rounded-lg border shadow-sm">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Estatísticas (18m)</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Notas:</span>
                      <span className="font-bold">{c.qtdNotas}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="font-bold">{c.totalVol.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-card p-2 rounded-lg border shadow-sm">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold mb-1">Identificação</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Cód. Cliente:</span>
                    <span className="font-mono font-bold">{c.cod_cliente ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-primary mb-2 flex items-center gap-1">
                  Histórico de Últimas Compras
                </p>
                <div className="rounded-lg border bg-white dark:bg-card overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-7 text-[10px] uppercase">Data</TableHead>
                        <TableHead className="h-7 text-[10px] uppercase">Linha</TableHead>
                        <TableHead className="h-7 text-[10px] uppercase text-right">Valor</TableHead>
                        <TableHead className="h-7 text-[10px] uppercase text-right">Volume</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.ultimas.map((u, i) => (
                        <TableRow key={i} className="hover:bg-accent/20">
                          <TableCell className="text-xs py-1.5 font-medium">{fmtDate(u.data)}</TableCell>
                          <TableCell className="text-xs py-1.5">{u.linha}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-semibold">{fmtBRL(u.valor)}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right">{u.volume.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={(e) => { e.stopPropagation(); onCreateAction(); }} disabled={isCreating} className="shadow-sm">
                  {isCreating ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Criando…</> : <><Plus className="h-3.5 w-3.5 mr-1.5" /> Criar ação para RC</>}
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};