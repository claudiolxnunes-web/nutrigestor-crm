import { useEffect, useState, useMemo } from "react";
import { Search, Command, Zap, User, Target, ChevronRight, Loader2, Sparkles } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useClientes } from "@/hooks/crm/useClientes";
import { useOportunidades } from "@/hooks/crm/useOportunidades";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgId } = useOrg();
  const { isGestor } = useRole();
  
  const { query: clientesQuery } = useClientes(orgId);
  const { items: oportunidades } = useOportunidades(orgId, user?.id, isGestor);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return { clientes: [], oportunidades: [] };
    
    const term = search.toLowerCase();
    
    const clientes = (clientesQuery.data ?? [])
      .filter(c => 
        (c.razao_social ?? "").toLowerCase().includes(term) || 
        (c.nome_fantasia ?? "").toLowerCase().includes(term) ||
        (c.codigo ?? "").toLowerCase().includes(term)
      )
      .slice(0, 5);

    const opps = (oportunidades ?? [])
      .filter(o => 
        (o.titulo_oportunidade ?? "").toLowerCase().includes(term) || 
        (o.cliente_nome ?? "").toLowerCase().includes(term) ||
        (o.linha ?? "").toLowerCase().includes(term)
      )
      .slice(0, 5);

    return { clientes, oportunidades: opps };
  }, [search, clientesQuery.data, oportunidades]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    setSearch("");
    command();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all group"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline-block">Busca inteligente...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 ml-2">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Busque clientes, oportunidades, produtos..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList className="max-h-[80vh]">
          <CommandEmpty>
            {clientesQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Buscando dados...</span>
              </div>
            ) : (
              "Nenhum resultado encontrado."
            )}
          </CommandEmpty>

          {search.length >= 2 && (
            <>
              {searchResults.clientes.length > 0 && (
                <CommandGroup heading="Clientes">
                  {searchResults.clientes.map((c) => (
                    <CommandItem 
                      key={c.id} 
                      value={`cliente-${c.id}-${c.razao_social}`}
                      onSelect={() => runCommand(() => navigate(`/clientes?id=${c.id}`))}
                      className="flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium truncate">{c.razao_social}</span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {c.codigo} • {c.cidade}, {c.estado}
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[9px] uppercase tracking-wider",
                        c.status_cliente === 'ativo' ? "border-emerald-200 text-emerald-600 bg-emerald-50/50" : 
                        c.status_cliente === 'inativo' ? "border-amber-200 text-amber-600 bg-amber-50/50" : 
                        "border-slate-200 text-slate-600 bg-slate-50/50"
                      )}>
                        {c.status_cliente}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {searchResults.oportunidades.length > 0 && (
                <CommandGroup heading="Oportunidades">
                  {searchResults.oportunidades.map((o) => (
                    <CommandItem 
                      key={o.id} 
                      value={`opp-${o.id}-${o.titulo_oportunidade}`}
                      onSelect={() => runCommand(() => navigate("/oportunidades"))}
                      className="flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                          <Target className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium truncate">{o.titulo_oportunidade || o.cliente_nome}</span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {o.cliente_nome} • {o.linha || "Geral"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {o.valor && (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            R$ {o.valor.toLocaleString()}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[9px] uppercase tracking-wider bg-indigo-50/50 text-indigo-600 border-indigo-200">
                          {o.etapa_pipeline}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Módulos & Ações">
            <CommandItem onSelect={() => runCommand(() => navigate("/meu-painel"))}>
              <Zap className="mr-2 h-4 w-4 text-amber-500" />
              <span>Meu Painel (Resumo)</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/oportunidades"))}>
              <Target className="mr-2 h-4 w-4 text-indigo-500" />
              <span>Pipeline de Oportunidades</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/clientes"))}>
              <User className="mr-2 h-4 w-4 text-blue-500" />
              <span>Carteira de Clientes</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/produtos"))}>
              <Command className="mr-2 h-4 w-4 text-slate-500" />
              <span>Catálogo de Produtos</span>
            </CommandItem>
          </CommandGroup>
          
          <CommandSeparator />
          
          <CommandGroup heading="Atalhos">
            <CommandItem onSelect={() => runCommand(() => navigate("/campo"))}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span>Abrir App de Campo (RC)</span>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
