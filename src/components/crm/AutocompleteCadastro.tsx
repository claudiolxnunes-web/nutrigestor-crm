import { useEffect, useRef, useState } from "react";
import { Plus, Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";

export type ItemSelecionado = {
  id: string | null;
  nome: string;
  isProspecto?: boolean;
  extra?: Record<string, any>;
};

type Props = {
  userId?: string;
  tabela: "clientes" | "produtos";
  label: string;
  value: ItemSelecionado | null;
  onChange: (v: ItemSelecionado | null) => void;
  placeholder?: string;
};

/**
 * Autocomplete sobre clientes/produtos.
 * - Busca em tempo real conforme digita.
 * - Se não houver resultado, oferece cadastro rápido (mínimo: nome).
 *   - Cliente novo entra como PROSPECTO (segmento = "PROSPECTO").
 *   - Produto novo aceita nome + linha/categoria (código gerado: TMP-xxxx).
 */
export function AutocompleteCadastro({ userId, tabela, label, value, onChange, placeholder }: Props) {
  const { orgId } = useOrg();
  const [query, setQuery] = useState(value?.nome ?? "");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setTotalRows(count ?? 0));
  }, [orgId, tabela]);

  useEffect(() => {
    setQuery(value?.nome ?? "");
  }, [value?.id]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!query.trim() || (value && value.nome === query)) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const campoNome = tabela === "clientes" ? "razao_social" : "nome";
      const { data } = await supabase
        .from(tabela)
        .select("*")
        .ilike(campoNome, `%${query.trim()}%`)
        .order(campoNome)
        .limit(8);
      setResults(data ?? []);
      setLoading(false);
      setOpen(true);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, tabela]);

  const selecionar = (row: any) => {
    const nome = tabela === "clientes" ? row.razao_social : row.nome;
    onChange({ id: row.id, nome, isProspecto: row.segmento === "PROSPECTO", extra: row });
    setQuery(nome);
    setOpen(false);
    setResults([]);
  };

  const cadastrarRapido = async () => {
    if (!userId || !orgId || !query.trim()) return;
    setCreating(true);
    if (tabela === "clientes") {
      const { data, error } = await supabase
        .from("clientes")
        .insert({ user_id: userId, organizacao_id: orgId, razao_social: query.trim(), segmento: "PROSPECTO" })
        .select()
        .single();
      setCreating(false);
      if (error) return toast.error(error.message);
      toast.success("Prospecto cadastrado");
      selecionar(data);
    } else {
      const codigo = `TMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const { data, error } = await supabase
        .from("produtos")
        .insert({
          user_id: userId,
          organizacao_id: orgId,
          codigo,
          nome: query.trim(),
          categoria: novaCategoria.trim() || null,
        })
        .select()
        .single();
      setCreating(false);
      if (error) return toast.error(error.message);
      toast.success("Produto cadastrado");
      setNovaCategoria("");
      selecionar(data);
    }
  };

  const limpar = () => {
    onChange(null);
    setQuery("");
    setResults([]);
    setOpen(false);
    setNovaCategoria("");
  };

  const semResultados = open && !loading && query.trim().length > 0 && results.length === 0;

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      {value?.id ? (
        <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-accent/40">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{value.nome}</p>
            {value.isProspecto && <Badge variant="outline" className="text-[10px] mt-0.5">Prospecto</Badge>}
          </div>
          <Button size="sm" variant="ghost" onClick={limpar}>Trocar</Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder ?? "Digite para buscar…"}
              className="pl-9 h-11"
            />
          </div>

          {totalRows === 0 && !query.trim() && (
            <Card className="p-3 border-dashed bg-accent/20">
              <p className="text-xs text-muted-foreground">
                Ainda não há {tabela === "clientes" ? "clientes" : "produtos"} cadastrados.
                {" "}Digite um nome acima para {tabela === "clientes" ? "cadastrar um prospecto na hora" : "cadastrar um produto rapidamente"}.
              </p>
            </Card>
          )}

          {open && results.length > 0 && (
            <Card className="max-h-56 overflow-auto divide-y">
              {results.map((row) => {
                const nome = tabela === "clientes" ? row.razao_social : row.nome;
                const sub = tabela === "clientes"
                  ? [row.cidade, row.estado].filter(Boolean).join(" / ")
                  : [row.codigo, row.categoria].filter(Boolean).join(" • ");
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selecionar(row)}
                    className="w-full text-left p-2.5 hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{nome}</p>
                      {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
                    </div>
                    {row.segmento === "PROSPECTO" && <Badge variant="outline" className="text-[10px]">Prospecto</Badge>}
                  </button>
                );
              })}
            </Card>
          )}

          {semResultados && (
            <Card className="p-3 space-y-3 border-dashed">
              <p className="text-xs text-muted-foreground">
                Nenhum {tabela === "clientes" ? "cliente" : "produto"} encontrado para
                <span className="font-medium text-foreground"> "{query}"</span>.
              </p>
              {tabela === "produtos" && (
                <div>
                  <Label className="text-xs">Linha / categoria</Label>
                  <Input
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    placeholder="Ex.: Linha Premium"
                    className="h-10"
                  />
                </div>
              )}
              <Button onClick={cadastrarRapido} disabled={creating} size="sm" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                {tabela === "clientes" ? "Cadastrar como prospecto" : "Cadastrar produto"}
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}