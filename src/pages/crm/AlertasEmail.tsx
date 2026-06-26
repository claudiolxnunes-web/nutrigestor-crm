import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { PageHeader } from "@/components/layout/AppLayout";
import { EmailAnalysisCard, type EmailAnalysis } from "@/components/crm/alertas/EmailAnalysisCard";
import { Loader2, Mail, Filter, RefreshCw, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";

export default function AlertasEmail() {
  const { orgId } = useOrg();
  const [analyses, setAnalyses] = useState<EmailAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed'>('pending');

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_email_analyses")
        .select(`
          *,
          clientes:identified_client_id (
            razao_social
          )
        `)
        .eq("organizacao_id", orgId)
        .order("received_at", { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map((item: any) => ({
        ...item,
        client_name: item.clientes?.razao_social
      }));

      setAnalyses(formattedData);
    } catch (err: any) {
      console.error("Erro ao carregar análises de email:", err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("ai_email_analyses")
        .update({ 
          status: newStatus,
          processed_at: newStatus === 'processed' ? new Date().toISOString() : null
        })
        .eq("id", id);

      if (error) throw error;

      setAnalyses(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      toast.success(newStatus === 'processed' ? "Análise concluída" : "Análise reaberta");
    } catch (err: any) {
      console.error("Erro ao atualizar status:", err);
      toast.error("Erro ao atualizar status");
    }
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const filteredAnalyses = analyses.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  return (
    <div className="space-y-6">
      <Seo title="Alertas de E-mail" description="Análises inteligentes de e-mails pelo agente pessoal." path="/alertas-email" />
      
      <PageHeader 
        title="Alertas de E-mail" 
        subtitle="Insights automáticos gerados pelo seu Agente Pessoal a partir da sua caixa de entrada."
        actions={
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setRefreshing(true); load(); }}
            disabled={loading || refreshing}
            className="gap-2 font-bold uppercase tracking-tighter"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-6">
        <Button 
          variant={filter === 'pending' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setFilter('pending')}
          className="rounded-full px-4"
        >
          Pendentes ({analyses.filter(a => a.status === 'pending').length})
        </Button>
        <Button 
          variant={filter === 'processed' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setFilter('processed')}
          className="rounded-full px-4"
        >
          Concluídas ({analyses.filter(a => a.status === 'processed').length})
        </Button>
        <Button 
          variant={filter === 'all' ? 'default' : 'outline'} 
          size="sm" 
          onClick={() => setFilter('all')}
          className="rounded-full px-4"
        >
          Todas
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && !refreshing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Lendo análises do agente...</p>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <Card className="p-12 text-center flex flex-col items-center gap-4 bg-slate-50/50 border-dashed">
            <div className="p-4 rounded-full bg-primary/5">
              <Mail className="h-10 w-10 text-primary opacity-40" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nenhuma análise encontrada</h3>
              <p className="text-sm text-slate-500">
                {filter === 'pending' 
                  ? "Você está em dia! Nenhuma análise pendente de e-mail." 
                  : "Nenhuma análise encontrada com este filtro."}
              </p>
            </div>
            <Button variant="outline" className="mt-4" onClick={load}>
              Tentar novamente
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            {filteredAnalyses.map((analysis) => (
              <EmailAnalysisCard 
                key={analysis.id} 
                analysis={analysis} 
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>

      <div className="premium-card p-6 bg-primary/5 border-primary/10 flex items-start gap-4 mt-8">
        <div className="p-3 rounded-2xl bg-primary/10 shrink-0">
          <AlertCircle className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-black text-primary uppercase tracking-tight">Como funciona o Agente Pessoal?</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Seu agente monitora sua caixa de entrada em busca de padrões comerciais, solicitações de clientes ou oportunidades de negócio. 
            Ele resume o conteúdo, identifica o cliente no CRM e sugere a melhor próxima ação para você não perder o timing.
          </p>
        </div>
      </div>
    </div>
  );
}
