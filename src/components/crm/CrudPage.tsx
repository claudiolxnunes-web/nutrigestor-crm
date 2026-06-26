import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, RefreshCw, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z, ZodType } from "zod";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useOrg } from "@/hooks/useOrg";
import { formatCell } from "@/utils/crm/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "number" | "email" | "select" | "textarea";
export interface CrudField {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface CrudPageProps<T extends { id: string }> {
  table: "representantes" | "clientes" | "produtos" | "leads";
  fields: CrudField[];
   columns: { key: string; label: string; format?: "date" | "currency" | "number" }[];
  schema: ZodType<any>;
  itemLabel: string;
  extraRowAction?: {
    icon: React.ReactNode;
    title: string;
    onClick: (row: T) => void;
  };
  enrichRows?: (rows: any[]) => Promise<any[]> | any[];
  extraFilters?: (rows: any[]) => React.ReactNode;
  filterRows?: (rows: any[]) => any[];
}

const CrudPageInner = <T extends { id: string; [k: string]: any }>({
  table, fields, columns, schema, itemLabel, extraRowAction, enrichRows, extraFilters, filterRows,
}: CrudPageProps<T>) => {
  const { user } = useAuth();
  const { isGestor } = useRole();
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 12;

  const { representativeCode, gestorCode, isRC, isGestor: roleIsGestor, loading: roleLoading } = useRole();

  const { data: rows = [], isLoading: dataLoading, refetch: load } = useQuery({
    queryKey: ["crud", table, orgId, representativeCode, gestorCode, isRC, roleIsGestor],
    queryFn: async () => {
      if (!orgId) return [];
      
      let query = supabase
        .from(table)
        .select("*")
        .eq("organizacao_id", orgId);

      // Application-level security: ensure RCs only see their own data
      if (table === "clientes") {
        if (isRC && representativeCode) {
          query = query.filter("cod_rc", "eq", representativeCode);
        } else if (roleIsGestor && gestorCode) {
          query = query.filter("cod_gestor", "eq", gestorCode);
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      
      if (error) throw error;
      const all = (data ?? []) as any[];
      return enrichRows ? await enrichRows(all) : all;
    },
    enabled: !!orgId && !roleLoading,
    staleTime: 1000 * 60 * 5,
  });

  const loading = roleLoading || dataLoading;

  const filtered = useMemo(() => {
    const base = filterRows ? filterRows(rows) : rows;
    const q = busca.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) =>
      columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q))
    );
  }, [rows, busca, columns, filterRows]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const visiveis = filtered.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  useEffect(() => { setPagina(1); }, [busca, rows.length, filterRows]);

  const openNew = () => {
    setEditing(null);
    setForm({});
    setOpen(true);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    setForm(row);
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase.from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.user_id = user?.id;
        payload.organizacao_id = orgId;
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${itemLabel} ${editing ? "atualizado" : "criado"}`);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["crud", table, orgId] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleSave = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    saveMutation.mutate(parsed.data);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Excluído");
      queryClient.invalidateQueries({ queryKey: ["crud", table, orgId] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const handleDelete = async (id: string) => {
    if (!confirm(`Excluir este ${itemLabel.toLowerCase()}?`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="premium-card p-4 sm:p-8 md:p-10 relative overflow-hidden transition-all duration-500">
      <div className="absolute top-0 right-0 w-80 h-80 bg-slate-50 dark:bg-white/[0.02] rounded-full -mr-40 -mt-40 blur-3xl pointer-events-none" />
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 md:gap-8 mb-8 md:mb-12 relative z-10">
        <div className="space-y-1 md:space-y-1.5 text-center xl:text-left">
          <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tightest">Gestão de {itemLabel}s</h3>
          <p className="text-xs md:text-sm text-slate-500 font-medium">Controle total e visualização analítica.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 md:gap-4 w-full xl:w-auto">
          {extraFilters && (
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 md:gap-3 bg-slate-50/50 dark:bg-white/5 p-1.5 rounded-[16px] md:rounded-[20px] border border-slate-100/50 dark:border-white/5">
              {extraFilters(rows)}
            </div>
          )}
          <div className="relative group flex-1 sm:flex-none min-w-[200px]">
            <Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar dados..."
              className="h-10 md:h-12 pl-11 w-full lg:w-80 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 focus:border-primary/50 transition-all rounded-[14px] md:rounded-[16px] shadow-soft text-sm font-medium"
            />
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button onClick={() => { load(); toast.success("Base atualizada"); }} variant="outline" className="flex-1 sm:flex-none h-10 md:h-12 px-4 md:px-5 rounded-[14px] md:rounded-[16px] font-black uppercase tracking-widest text-[9px] md:text-[10px] border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all" disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin" : ""}`} /> Sincronizar
            </Button>
            {isGestor && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNew} className="flex-1 sm:flex-none h-10 md:h-12 px-4 md:px-8 rounded-[14px] md:rounded-[16px] font-black uppercase tracking-widest text-[9px] md:text-[10px] shadow-lg hover:shadow-primary/20 transition-all active:scale-95 group">
                    <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform duration-300" /> Cadastrar
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-2xl rounded-[24px] md:rounded-[32px] border-none shadow-premium p-0 overflow-hidden bg-white dark:bg-slate-950">
                  <DialogHeader className="p-6 md:p-10 pb-0 text-left">
                    <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                      <div className="p-2 md:p-3 bg-primary/5 rounded-[14px] md:rounded-[18px]">
                        {editing ? <Pencil className="h-5 md:h-6 w-5 md:w-6 text-primary" /> : <Plus className="h-5 md:h-6 w-5 md:w-6 text-primary" />}
                      </div>
                      <div>
                        <DialogTitle className="text-xl md:text-2xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none mb-1">{editing ? "Atualizar" : "Novo"} {itemLabel}</DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulo de Cadastro Inteligente</p>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="p-6 md:p-10 space-y-4 md:space-y-6 max-h-[60vh] overflow-y-auto bg-slate-50/50 dark:bg-white/5 mt-4 md:mt-8 border-y border-slate-100 dark:border-white/10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      {fields.map((f) => (
                        <div key={f.name} className="space-y-2 md:space-y-2.5">
                          <Label htmlFor={f.name} className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                            {f.label} {f.required && <span className="text-rose-500">*</span>}
                          </Label>
                          {f.type === "select" && f.options ? (
                            <Select
                              value={form[f.name] ?? ""}
                              onValueChange={(v) => setForm({ ...form, [f.name]: v })}
                            >
                              <SelectTrigger id={f.name} className="h-12 md:h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-[12px] md:rounded-[14px] shadow-sm text-sm font-semibold px-4 md:px-5">
                                <SelectValue placeholder="Escolha uma opção..." />
                              </SelectTrigger>
                              <SelectContent className="rounded-[14px] md:rounded-[18px] border-slate-200 dark:border-white/10 shadow-2xl p-2">
                                {f.options.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="rounded-xl font-medium py-2 md:py-3 px-3 md:px-4">{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : f.type === "textarea" ? (
                            <textarea
                              id={f.name}
                              value={form[f.name] ?? ""}
                              placeholder={f.label}
                              className="flex min-h-[100px] w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-[12px] md:rounded-[14px] shadow-sm text-sm font-semibold px-4 md:px-5 py-3 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 outline-none"
                              onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                            />
                          ) : (
                            <Input
                              id={f.name}
                              type={f.type ?? "text"}
                              value={form[f.name] ?? ""}
                              placeholder={f.label}
                              className="h-12 md:h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-[12px] md:rounded-[14px] shadow-sm text-sm font-semibold px-4 md:px-5 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                              onChange={(e) => {
                                const v = f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value;
                                setForm({ ...form, [f.name]: v });
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <DialogFooter className="p-6 md:p-10 pt-6 md:pt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-[12px] md:rounded-[14px] h-12 md:h-14 px-6 md:px-8 font-black uppercase tracking-widest text-[9px] md:text-[10px] text-slate-400 hover:text-slate-900 transition-all order-2 sm:order-1">Descartar</Button>
                    <Button onClick={handleSave} className="rounded-[12px] md:rounded-[14px] h-12 md:h-14 px-8 md:px-12 font-black uppercase tracking-widest text-[9px] md:text-[10px] shadow-xl hover:shadow-primary/30 active:scale-95 transition-all order-1 sm:order-2">Salvar Registro</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[16px] md:rounded-[24px] border border-slate-100 dark:border-white/5 bg-slate-50/20 dark:bg-white/[0.02] overflow-hidden shadow-inner-soft">
        <Table className="min-w-[800px]">
         <TableHeader className="bg-slate-100/50 dark:bg-white/5">
           <TableRow className="hover:bg-transparent border-none">
             {columns.map((c) => (
               <TableHead key={c.key} className="h-16 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{c.label}</TableHead>
             ))}
             <TableHead className="w-40 text-right pr-10 h-16 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Ações</TableHead>
           </TableRow>
         </TableHeader>
         <TableBody>
           {loading ? (
             <TableRow><TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-24">
               <div className="flex flex-col items-center gap-4">
                 <div className="relative">
                   <RefreshCw className="h-10 w-10 animate-spin text-primary opacity-20" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
                   </div>
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processando requisição...</p>
               </div>
             </TableCell></TableRow>
           ) : filtered.length === 0 ? (
             <TableRow><TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-24">
               <div className="flex flex-col items-center gap-3">
                  <Search className="h-8 w-8 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum registro encontrado</p>
               </div>
             </TableCell></TableRow>
           ) : visiveis.map((r, i) => (
             <motion.tr
               key={r.id}
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: i * 0.03 }}
               className={cn(
                 "group transition-all duration-300 border-b border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/5",
                 String(r.status ?? "").toLowerCase() === "inativo" ? "bg-red-50/30 dark:bg-red-950/10 opacity-60" : ""
               )}
             >
               {columns.map((c, idx) => (
                 <TableCell key={c.key} className={cn("py-5 px-6 text-sm font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors", idx === 0 && "text-slate-900 dark:text-white")}>
                   {formatCell(r[c.key], c.format as any)}
                 </TableCell>
               ))}
               <TableCell className="text-right pr-10 py-5">
                 <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                   {extraRowAction && (
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-10 w-10 rounded-xl text-primary hover:bg-primary/10 transition-all shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5" 
                       title={extraRowAction.title} 
                       onClick={() => extraRowAction.onClick(r)}
                     >
                       {extraRowAction.icon}
                     </Button>
                   )}
                    {isGestor && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5" 
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5" 
                          onClick={() => handleDelete(r.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                 </div>
               </TableCell>
             </motion.tr>
           ))}
         </TableBody>
       </Table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-8 relative z-10">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exibindo {visiveis.length} de {filtered.length} registros</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-slate-200 dark:border-white/10 font-bold"
              onClick={() => setPagina(Math.max(1, pagina - 1))}
              disabled={pagina === 1}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPaginas) }).map((_, i) => {
                const p = i + 1;
                return (
                  <Button
                    key={p}
                    variant={pagina === p ? "default" : "outline"}
                    size="sm"
                    className={cn("h-10 w-10 rounded-xl font-bold", pagina === p ? "shadow-lg shadow-primary/20" : "border-slate-200 dark:border-white/10")}
                    onClick={() => setPagina(p)}
                  >
                    {p}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-slate-200 dark:border-white/10 font-bold"
              onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina === totalPaginas}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const CrudPage = React.memo(CrudPageInner) as typeof CrudPageInner;
