 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
 import { Card } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
  import { Search, Users, Activity, LogOut, CheckCircle2, TrendingUp, TrendingDown, Filter } from "lucide-react";
 import { useState, useMemo } from "react";
 import { Badge } from "@/components/ui/badge";

 type ClienteDetalhe = {
   cod: string;
   nome: string;
   ultimo_mes: string;
   fat_mes: number;
   fat_mes_ant: number;
   variacao: {
     absoluta: number;
     percentual: string;
   };
   is_ativo: boolean;
   is_positivado: boolean;
   pedidos_aberto: number;
 };

 type Props = {
   open: boolean;
   onOpenChange: (o: boolean) => void;
   tipo: "total" | "ativos" | "inativos" | "positivados" | null;
   clientes: ClienteDetalhe[];
   mes: string;
 };

 const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

 export function CarteiraDrilldownDialog({ open, onOpenChange, tipo, clientes, mes }: Props) {
    const [busca, setBusca] = useState("");
    const [filtroVariacao, setFiltroVariacao] = useState<"todos" | "positiva" | "negativa" | "sem_mudanca">("todos");

   const titulo = useMemo(() => {
     switch (tipo) {
       case "total": return "Total de Clientes Cadastrados";
       case "ativos": return "Clientes Ativos (últimos 6 meses)";
       case "inativos": return "Clientes Inativos (+6 meses)";
       case "positivados": return "Clientes Positivados no Mês";
       default: return "Detalhes da Carteira";
     }
   }, [tipo]);

    const filtrados = useMemo(() => {
      let base = clientes;
      if (tipo === "ativos") base = clientes.filter(c => c.is_ativo);
      if (tipo === "inativos") base = clientes.filter(c => !c.is_ativo);
      if (tipo === "positivados") base = clientes.filter(c => c.is_positivado);

      // Filtro de Variação
      if (filtroVariacao === "positiva") base = base.filter(c => (c.variacao?.absoluta ?? 0) > 0);
      if (filtroVariacao === "negativa") base = base.filter(c => (c.variacao?.absoluta ?? 0) < 0);
      if (filtroVariacao === "sem_mudanca") base = base.filter(c => (c.variacao?.absoluta ?? 0) === 0);
 
      if (!busca.trim()) return base;
      const s = busca.toLowerCase();
      return base.filter(c => 
        c.nome.toLowerCase().includes(s) || 
        c.cod.toLowerCase().includes(s)
      );
    }, [clientes, tipo, busca, filtroVariacao]);

   const agregado = useMemo(() => {
     const atual = filtrados.reduce((acc, c) => acc + c.fat_mes, 0);
     const anterior = filtrados.reduce((acc, c) => acc + (c.fat_mes_ant || 0), 0);
     const varAbs = atual - anterior;
     const varPct = anterior > 0 ? ((atual - anterior) / anterior * 100).toFixed(1) + "%" : (atual > 0 ? "100%" : "0%");
     return { atual, anterior, varAbs, varPct };
   }, [filtrados]);

   const Icone = useMemo(() => {
     switch (tipo) {
       case "ativos": return Activity;
       case "inativos": return LogOut;
       case "positivados": return CheckCircle2;
       default: return Users;
     }
   }, [tipo]);

   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="w-[95vw] sm:max-w-3xl rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
         <DialogHeader className="p-6 md:p-8 pb-4 text-left border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02]">
           <div className="flex items-center gap-4">
             <div className="p-3 bg-primary/5 rounded-[18px]">
               <Icone className={`h-6 w-6 ${tipo === 'ativos' ? 'text-emerald-500' : tipo === 'inativos' ? 'text-amber-500' : tipo === 'positivados' ? 'text-blue-500' : 'text-primary'}`} />
             </div>
             <div>
               <DialogTitle className="text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">{titulo}</DialogTitle>
               <DialogDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                 {filtrados.length} clientes encontrados • Referência: {mes}
               </DialogDescription>
             </div>
           </div>
         </DialogHeader>

          <div className="p-6 md:p-8 pt-4 space-y-6">
           {/* Resumo Agregado */}
           <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
             <Card className="p-4 bg-slate-50/50 border-none">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Faturamento Atual</p>
               <p className="text-lg font-black text-primary">{fmtBRL(agregado.atual)}</p>
             </Card>
             <Card className="p-4 bg-slate-50/50 border-none">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Mês Anterior</p>
               <p className="text-lg font-black text-slate-600">{fmtBRL(agregado.anterior)}</p>
             </Card>
             <Card className="p-4 bg-slate-50/50 border-none col-span-2 sm:col-span-1">
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Variação Total</p>
               <div className={`flex items-center gap-1.5 ${agregado.varAbs >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                 {agregado.varAbs >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                 <p className="text-lg font-black">{agregado.varPct}</p>
               </div>
             </Card>
           </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por nome ou código..." 
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-9 h-11 bg-slate-50 border-none rounded-xl w-full"
                />
              </div>
              <div className="flex bg-slate-100/50 p-1 rounded-xl min-w-max">
                <button
                  onClick={() => setFiltroVariacao("todos")}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${filtroVariacao === "todos" ? "bg-white shadow-sm text-primary" : "text-muted-foreground"}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroVariacao("positiva")}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${filtroVariacao === "positiva" ? "bg-white shadow-sm text-emerald-600" : "text-muted-foreground"}`}
                >
                  <TrendingUp className="h-3 w-3" /> Cresceu
                </button>
                <button
                  onClick={() => setFiltroVariacao("negativa")}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${filtroVariacao === "negativa" ? "bg-white shadow-sm text-rose-600" : "text-muted-foreground"}`}
                >
                  <TrendingDown className="h-3 w-3" /> Caiu
                </button>
                <button
                  onClick={() => setFiltroVariacao("sem_mudanca")}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${filtroVariacao === "sem_mudanca" ? "bg-white shadow-sm text-slate-600" : "text-muted-foreground"}`}
                >
                  Estável
                </button>
              </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 scrollbar-thin">
             {filtrados.map(c => (
               <Card key={c.cod} className="p-3 hover:bg-slate-50 transition-colors border-slate-100/50">
                 <div className="flex justify-between items-start gap-3">
                   <div className="min-w-0">
                     <p className="text-sm font-bold truncate">{c.nome}</p>
                     <p className="text-[10px] text-muted-foreground uppercase font-mono">Cód: {c.cod} • Última compra: {c.ultimo_mes}</p>
                   </div>
                    <div className="text-right shrink-0 flex flex-col items-end">
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[9px] text-muted-foreground uppercase font-bold">Atual</p>
                          <p className="text-xs font-black text-primary">{fmtBRL(c.fat_mes)}</p>
                        </div>
                        <div className="text-right border-l pl-3">
                          <p className="text-[9px] text-muted-foreground uppercase font-bold">Mês Ant.</p>
                          <p className="text-xs font-black text-slate-500">{fmtBRL(c.fat_mes_ant || 0)}</p>
                        </div>
                      </div>
                      
                      {c.variacao && (
                        <div className={`flex items-center gap-1 mt-1 font-bold text-[10px] ${c.variacao.absoluta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {c.variacao.absoluta >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                          {c.variacao.percentual}
                        </div>
                      )}

                     <div className="flex gap-1 mt-1 justify-end">
                       {c.is_positivado && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[8px] h-4">Positivado</Badge>}
                       {c.is_ativo ? 
                         <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[8px] h-4">Ativo</Badge> : 
                         <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[8px] h-4">Inativo</Badge>
                       }
                     </div>
                   </div>
                 </div>
                 {c.pedidos_aberto > 0 && (
                   <div className="mt-2 pt-2 border-t border-dashed flex justify-between items-center">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase">Pedidos em aberto:</span>
                     <span className="text-[10px] font-bold text-amber-600">{fmtBRL(c.pedidos_aberto)}</span>
                   </div>
                 )}
               </Card>
             ))}
             {filtrados.length === 0 && (
               <div className="py-10 text-center text-muted-foreground text-sm">
                 Nenhum cliente encontrado.
               </div>
             )}
           </div>
         </div>
       </DialogContent>
     </Dialog>
   );
 }