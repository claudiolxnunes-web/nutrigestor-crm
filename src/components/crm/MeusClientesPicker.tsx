import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { toast } from "sonner";
import type { ItemSelecionado } from "@/components/crm/AutocompleteCadastro";

type Props = {
  userId?: string;
  value: ItemSelecionado | null;
  onChange: (v: ItemSelecionado | null) => void;
};

/**
 * Lista os clientes da carteira do RC logado (vendas com cod_rc do usuário)
 * + clientes que ele já registrou intera\u00e7\u00f5es / prospectos. Mostra a lista
 * imediatamente. Campo de busca filtra a lista in\u2011memory. Bot\u00e3o "+ Novo
 * prospecto" para criar cliente novo na hora.
 */
export function MeusClientesPicker({ userId, value, onChange }: Props) {
  const { orgId } = useOrg();
  const [todos, setTodos] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!userId || !orgId) return;
    setLoading(true);

    // 1) cod_rc do usu\u00e1rio logado
    const { data: rep } = await supabase
      .from("representantes")
      .select("cod_rc")
      .eq("organizacao_id", orgId)
      .eq("auth_user_id", userId)
      .maybeSingle();
    const codRc = rep?.cod_rc ?? null;

    // 2) clientes da carteira (via vendas com cod_rc) + prospectos do RC + clientes com intera\u00e7\u00f5es
    const nomesCarteira = new Set<string>();
    if (codRc) {
      const { data: vendas } = await supabase
        .from("vendas")
        .select("nome_cliente")
        .eq("organizacao_id", orgId)
        .eq("cod_rc", codRc)
        .not("nome_cliente", "is", null)
        .limit(2000);
      (vendas ?? []).forEach((v: any) => v.nome_cliente && nomesCarteira.add(v.nome_cliente));
    }

    // 3) clientes do org (com prioridade pra carteira) — pagina para evitar o limite default de 1000
    const PAGE = 1000;
    let from = 0;
    let clientes: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, cidade, estado, segmento, ultima_compra")
        .eq("organizacao_id", orgId)
        .order("razao_social")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      clientes = clientes.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    const lista = (clientes ?? []).map((c: any) => ({
      ...c,
      _carteira: nomesCarteira.has(c.razao_social),
    }));
    // ordena: carteira primeiro, depois alfab\u00e9tico
    lista.sort((a: any, b: any) => {
      if (a._carteira !== b._carteira) return a._carteira ? -1 : 1;
      return a.razao_social.localeCompare(b.razao_social);
    });
    setTodos(lista);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId, orgId]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return todos.slice(0, 100);
    return todos
      .filter((c) =>
        c.razao_social.toLowerCase().includes(q) ||
        (c.cidade ?? "").toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [todos, query]);

  const selecionar = (c: any) => {
    onChange({
      id: c.id,
      nome: c.razao_social,
      isProspecto: c.segmento === "PROSPECTO",
      extra: c,
    });
    setQuery("");
  };

  const criarProspecto = async () => {
    const nome = novoNome.trim();
    if (!userId || !orgId || !nome) return;
    setCriando(true);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        user_id: userId,
        organizacao_id: orgId,
        razao_social: nome,
        cidade: novaCidade.trim() || null,
        segmento: "PROSPECTO",
      })
      .select()
      .single();
    setCriando(false);
    if (error) return toast.error(error.message);
    toast.success("Prospecto criado");
    setNovoNome(""); setNovaCidade("");
    setTodos((prev) => [{ ...data, _carteira: false }, ...prev]);
    selecionar(data);
  };

  if (value?.id) {
    return (
      <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-accent/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{value.nome}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {value.extra?.cidade && (
              <p className="text-[11px] text-muted-foreground truncate">
                <MapPin className="inline h-3 w-3 mr-0.5" />
                {value.extra.cidade}{value.extra.estado ? ` / ${value.extra.estado}` : ""}
              </p>
            )}
            {value.isProspecto && <Badge variant="outline" className="text-[10px]">Prospecto</Badge>}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Trocar">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nos meus clientes..."
          className="pl-9 h-11"
        />
      </div>

      <Card className="max-h-64 overflow-auto divide-y">
        {loading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}
        {!loading && filtrados.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum cliente encontrado. Cadastre como prospecto abaixo.
          </p>
        )}
        {filtrados.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => selecionar(c)}
            className="w-full text-left p-2.5 hover:bg-accent flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{c.razao_social}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {c.cidade && <p className="text-[11px] text-muted-foreground truncate">{c.cidade}{c.estado ? ` / ${c.estado}` : ""}</p>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {c._carteira && <Badge className="text-[9px] bg-primary/10 text-primary hover:bg-primary/10">Minha carteira</Badge>}
              {c.segmento === "PROSPECTO" && <Badge variant="outline" className="text-[9px]">Prospecto</Badge>}
            </div>
          </button>
        ))}
      </Card>

      <Card className="p-3 space-y-2 border-dashed">
        <Label className="text-xs font-medium">+ Novo prospecto (cliente fora da base)</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input className="col-span-2 h-9" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Razão social" />
          <Input className="h-9" value={novaCidade} onChange={(e) => setNovaCidade(e.target.value)} placeholder="Cidade" />
        </div>
        <Button size="sm" className="w-full" disabled={criando || !novoNome.trim()} onClick={criarProspecto}>
          <Plus className="mr-1 h-4 w-4" />Cadastrar prospecto
        </Button>
      </Card>
    </div>
  );
}