import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, ArrowRight, Search } from "lucide-react";

type Sugestao = {
  cliente_id: string;
  codigo: string;
  razao_social: string;
  cidade: string | null;
  estado: string | null;
  ultima_compra: string | null;
  status_cliente: string;
  cod_rc_atual: string | null;
  representante_atual: string | null;
  sugestao_cod_rc: string | null;
  sugestao_nome: string | null;
  sugestao_motivo: string | null;
  sugestao_score: number;
};

const RevisaoInativos = () => {
  const { orgId } = useOrg();
  const { gestorCode } = useRole();
  const [codGestor, setCodGestor] = useState<string>(gestorCode || "001234");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [selecionados, setSelecionados] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const { data: linhas = [], isLoading, error, refetch } = useQuery({
    queryKey: ["revisao-inativos", orgId, codGestor],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.rpc("sugerir_rc_para_inativos" as any, {
        _organizacao_id: orgId,
        _cod_gestor: codGestor,
      });
      if (error) throw error;
      return (data ?? []) as Sugestao[];
    },
    enabled: !!orgId,
  });

  const filtradas = useMemo(() => {
    const term = busca.toLowerCase().trim();
    return linhas.filter((l) => {
      if (filtroStatus !== "todos" && l.status_cliente !== filtroStatus) return false;
      if (!term) return true;
      return (
        l.razao_social?.toLowerCase().includes(term) ||
        l.cidade?.toLowerCase().includes(term) ||
        l.codigo?.toLowerCase().includes(term)
      );
    });
  }, [linhas, busca, filtroStatus]);

  const totais = useMemo(() => ({
    total: linhas.length,
    inativo: linhas.filter((l) => l.status_cliente === "inativo").length,
    sem_compra: linhas.filter((l) => l.status_cliente === "sem_compra").length,
    ativo: linhas.filter((l) => l.status_cliente === "ativo").length,
    com_sugestao: linhas.filter((l) => l.sugestao_cod_rc).length,
  }), [linhas]);

  const toggleSelecionar = (l: Sugestao, checked: boolean) => {
    setSelecionados((prev) => {
      const next = { ...prev };
      if (checked && l.sugestao_cod_rc) {
        next[l.cliente_id] = l.sugestao_cod_rc;
      } else {
        delete next[l.cliente_id];
      }
      return next;
    });
  };

  const selecionarTodosVisiveis = (checked: boolean) => {
    if (!checked) { setSelecionados({}); return; }
    const next: Record<string, string> = {};
    filtradas.forEach((l) => { if (l.sugestao_cod_rc) next[l.cliente_id] = l.sugestao_cod_rc; });
    setSelecionados(next);
  };

  const aplicarSugestoes = async () => {
    const ids = Object.keys(selecionados);
    if (ids.length === 0) { toast.error("Nenhum cliente selecionado"); return; }
    setSalvando(true);
    try {
      // Agrupar por cod_rc para reduzir chamadas
      const porRc = new Map<string, string[]>();
      ids.forEach((id) => {
        const rc = selecionados[id];
        if (!porRc.has(rc)) porRc.set(rc, []);
        porRc.get(rc)!.push(id);
      });
      for (const [rc, clienteIds] of porRc) {
        const linha = linhas.find((l) => l.sugestao_cod_rc === rc);
        const nome = linha?.sugestao_nome ?? "";
        const { error } = await supabase
          .from("clientes")
          .update({ cod_rc: rc, representante: nome })
          .in("id", clienteIds);
        if (error) throw error;
      }
      toast.success(`${ids.length} cliente(s) reatribuído(s) com sucesso`);
      setSelecionados({});
      refetch();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revisão de Clientes — Carteira do Gestor</h1>
        <p className="text-muted-foreground text-sm">
          Clientes vinculados ao código <strong>{codGestor}</strong> com sugestão de reatribuição por proximidade (cidade/estado).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{totais.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Ativos</div><div className="text-2xl font-bold text-emerald-600">{totais.ativo}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Inativos (+6m)</div><div className="text-2xl font-bold text-amber-600">{totais.inativo}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Sem compra</div><div className="text-2xl font-bold text-rose-600">{totais.sem_compra}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Com sugestão</div><div className="text-2xl font-bold text-primary">{totais.com_sugestao}</div></Card>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por razão social, cidade ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
              <SelectItem value="sem_compra">Sem compra</SelectItem>
            </SelectContent>
          </Select>
          <Input className="w-full md:w-40" placeholder="Cód. gestor" value={codGestor} onChange={(e) => setCodGestor(e.target.value)} />
          <Button
            onClick={aplicarSugestoes}
            disabled={salvando || Object.keys(selecionados).length === 0}
          >
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aplicar {Object.keys(selecionados).length > 0 ? `(${Object.keys(selecionados).length})` : ""}
          </Button>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Carregando...
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <div className="font-medium text-destructive">Não foi possível carregar a revisão de clientes.</div>
            <div className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Erro desconhecido"}</div>
            <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtradas.length > 0 && filtradas.every((l) => !l.sugestao_cod_rc || selecionados[l.cliente_id])}
                    onCheckedChange={(c) => selecionarTodosVisiveis(!!c)}
                  />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Última compra</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sugestão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((l) => (
                <TableRow key={l.cliente_id}>
                  <TableCell>
                    <Checkbox
                      disabled={!l.sugestao_cod_rc}
                      checked={!!selecionados[l.cliente_id]}
                      onCheckedChange={(c) => toggleSelecionar(l, !!c)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{l.razao_social}</div>
                    <div className="text-xs text-muted-foreground">{l.codigo}</div>
                  </TableCell>
                  <TableCell className="text-sm">{l.cidade || "—"}{l.estado ? `/${l.estado}` : ""}</TableCell>
                  <TableCell className="text-sm">{l.ultima_compra ? new Date(l.ultima_compra).toLocaleDateString("pt-BR") : "Nunca"}</TableCell>
                  <TableCell>
                    <Badge variant={l.status_cliente === "ativo" ? "default" : l.status_cliente === "inativo" ? "secondary" : "destructive"}>
                      {l.status_cliente}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {l.sugestao_cod_rc ? (
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{l.sugestao_nome} <span className="text-muted-foreground">({l.sugestao_cod_rc})</span></div>
                          <div className="text-xs text-muted-foreground">{l.sugestao_motivo}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{l.sugestao_motivo}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum cliente encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};

export default RevisaoInativos;