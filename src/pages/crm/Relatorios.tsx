import { useState, useMemo, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import { useOrg } from "@/hooks/useOrg";
import { crmService } from "@/services/crmService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  FileText, 
  Users, 
  Building2, 
  Target, 
  Calendar, 
  TrendingUp, 
  AlertTriangle,
  Download,
  Search,
  Filter,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

   const Relatorios = () => {
   const [activeTab, setActiveTab] = useState("vendas");
   const { isGestor, isRC, representativeCode, gestorCode, representativeName } = useRole();
  const { orgId } = useOrg();
  const [generating, setGenerating] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const list = [
      { id: "vendas", label: "Vendas", icon: BarChart3, color: "text-emerald-500", bg: "bg-emerald-500/10" },
      { id: "clientes", label: "Clientes", icon: Building2, color: "text-amber-500", bg: "bg-amber-500/10" },
      { id: "metas", label: "Metas", icon: Target, color: "text-purple-500", bg: "bg-purple-500/10" },
      { id: "operacional", label: "Operacional", icon: Calendar, color: "text-slate-500", bg: "bg-slate-500/10" },
    ];
    if (isGestor) {
      list.push({ id: "equipe", label: "Equipe", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" });
    }
    return list;
  }, [isGestor]);

  const relatorios = useMemo(() => {
    const list = [
    {
      id: "vendas-por-solucao",
      categoria: "vendas",
      title: "Vendas por Solução",
      description: "Detalhamento de faturamento e volume agrupado por linha e solução.",
      icon: TrendingUp,
    }
    ];

    if (isGestor) {
      list.push({
        id: "performance-representantes",
        categoria: "equipe",
        title: "Ranking de Performance",
        description: "Comparativo de faturamento, margem e atingimento entre representantes.",
        icon: Users,
      });
    }

    list.push({
      id: "clientes-inativos",
      categoria: "clientes",
      title: "Clientes Inativos (+6 meses)",
      description: "Lista de clientes sem compras recentes para ações de recuperação.",
      icon: AlertTriangle,
    });

    list.push({
      id: "posicionamento-carteira",
      categoria: "clientes",
      title: "Posicionamento de Carteira",
      description: "Análise de positivação e concentração de faturamento por cliente.",
      icon: Building2,
    });

    list.push({
      id: "acompanhamento-metas",
      categoria: "metas",
      title: "Acompanhamento de Metas",
      description: "Evolução diária do atingimento vs esperado do mês.",
      icon: Target,
    });

    list.push({
      id: "relatorio-visitas",
      categoria: "operacional",
      title: "Relatório de Visitas",
      description: "Consolidado de interações e visitas realizadas pela equipe.",
      icon: Calendar,
    });

    return list;
  }, [isGestor]);

  const handleGerar = useCallback(async (id: string) => {
    if (!orgId) return;
    
    // Segurança: se for RC mas não tiver código, não permite gerar com dados de outros
    if (isRC && !representativeCode) {
      toast.error("Seu usuário não possui um Código de Representante vinculado. Contate o administrador.");
      return;
    }

    setGenerating(id);
     try {
       const codRc = isRC ? representativeCode : null;
       const now = new Date().toISOString().slice(0, 10);
       
       if (id === "vendas-por-solucao") {
         const data = await crmService.getVendas(orgId, undefined, codRc, gestorCode);
        if (!data.length) {
          toast.error("Sem dados de vendas para o período");
          return;
        }
        const header = ["Data", "NF", "Cliente", "Produto", "Volume", "Faturamento", "Solução"].join(";");
        const rows = data.map((v: any) => [
          v.data_nf || "",
          v.nota_fiscal || "",
          v.nome_cliente || "",
          v.nome_produto || "",
          v.volume_kg || 0,
          v.faturamento_realizado || 0,
          v.solucao || ""
        ].join(";"));
        const csv = "\uFEFF" + [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vendas-solucao-${representativeCode || 'gestor'}-${now}.csv`;
        a.click();
        toast.success("Relatório gerado!");
       } else if (id === "clientes-inativos") {
         const data = await crmService.getClientes(orgId, { codRc, codGestor: gestorCode });
        if (!data.length) {
          toast.error("Sem clientes cadastrados");
          return;
        }
        // Simplistic inactives report for demo
        const header = ["Código", "Razão Social", "Cidade", "Última Compra", "Representante"].join(";");
        const rows = data.map((c: any) => [
          c.codigo || "",
          c.razao_social || "",
          c.cidade || "",
          c.ultima_compra || "",
          c.representante || ""
        ].join(";"));
        const csv = "\uFEFF" + [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clientes-${representativeCode || 'gestor'}-${now}.csv`;
        a.click();
        toast.success("Relatório gerado!");
      } else {
        toast.info("Este relatório está sendo processado e estará disponível em breve.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar relatório");
    } finally {
      setGenerating(null);
    }
  }, [orgId, isRC, representativeCode]);

  const filtrados = useMemo(() => {
    return relatorios.filter(r => r.categoria === activeTab);
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Relatórios" 
        subtitle="Inteligência de dados e indicadores gerenciais" 
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navegação de Categorias */}
        <aside className="lg:col-span-1 space-y-2">
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200",
                activeTab === cat.id 
                  ? "bg-white dark:bg-slate-900 shadow-sm text-primary ring-1 ring-slate-200 dark:ring-white/10" 
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              )}
            >
              <div className={cn("p-1.5 rounded-lg", cat.bg)}>
                <cat.icon className={cn("h-4 w-4", cat.color)} />
              </div>
              {cat.label}
            </button>
          ))}
        </aside>

        {/* Lista de Relatórios */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
              Disponíveis em <span className="text-primary">{categorias.find(c => c.id === activeTab)?.label}</span>
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar relatório..." 
                className="pl-9 h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtrados.map((rel) => (
              <Card 
                key={rel.id} 
                className="group p-5 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-slate-200 dark:border-white/5 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-all" />
                
                <div className="flex flex-col h-full space-y-4 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                      <rel.icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-slate-200">PDF / EXCEL</Badge>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-tightest group-hover:text-primary transition-colors">{rel.title}</h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2">{rel.description}</p>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex -space-x-1">
                      <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">CSV</div>
                      <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">XLS</div>
                      <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-rose-500 flex items-center justify-center text-[8px] text-white font-bold shadow-sm">PDF</div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      disabled={!!generating}
                      onClick={() => handleGerar(rel.id)}
                      className="h-8 px-3 rounded-lg text-primary font-black uppercase tracking-widest text-[9px] group-hover:bg-primary group-hover:text-white transition-all"
                    >
                      {generating === rel.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Gerar <ArrowRight className="ml-1 h-3 w-3" /></>}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Seção Informativa / Ajuda */}
          <Card className="p-6 bg-slate-50/50 dark:bg-white/[0.02] border-dashed border-2 border-slate-200 dark:border-white/10 rounded-[32px]">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-[24px] shadow-sm">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left space-y-1">
                <h5 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Precisa de um relatório personalizado?</h5>
                <p className="text-sm text-slate-500 font-medium">Nossa IA pode cruzar qualquer dado da sua operação para gerar insights específicos para sua demanda.</p>
              </div>
              <Button className="h-12 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg">
                Falar com a IA
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Relatorios;
