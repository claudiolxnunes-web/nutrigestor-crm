import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Calendar, Loader2, RefreshCw, Sparkles, ChevronRight, ChevronLeft, Bell, BellPlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, getWeek, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FollowUpPlanejadoCard } from "../ai/FollowUpPlanejadoCard";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";

export function PlanejamentoIA() {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [plano, setPlano] = useState<any>(null);
  const [dataBase, setDataBase] = useState(new Date());
  const [provider, setProvider] = useState(() => localStorage.getItem("ai_provider") || "gemini");

  const semanaInfo = {
    numero: getWeek(dataBase, { weekStartsOn: 0 }),
    mes: format(dataBase, "yyyy-MM"),
    label: `${format(startOfWeek(dataBase), "dd/MM")} a ${format(endOfWeek(dataBase), "dd/MM")}`
  };

  const carregarPlano = async (force = false) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("planejamento-semanal-ia", {
        body: {
          mes_referencia: semanaInfo.mes,
          semana_ano: semanaInfo.numero,
          provider,
          force
        }
      });

      if (error) throw error;
      setPlano(data);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao gerar planejamento", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const agendarFollowUps = async () => {
    if (!plano?.metadados?.sugestoes_followup || !orgId || !user) {
      toast.info("A IA ainda não gerou sugestões estruturadas para esta semana.");
      return;
    }

    setScheduling(true);
    try {
      const sugestoes = plano.metadados.sugestoes_followup;
      const followUps = sugestoes.map((s: any) => ({
        organizacao_id: orgId,
        planejamento_id: plano.id,
        cliente_nome: s.cliente,
        cliente_id: s.codigo_cliente,
        tipo_contato: s.canal || 'whatsapp',
        data_planejada: s.data,
        mensagem_sugerida: s.mensagem,
        status: 'pendente',
        criado_por: user.id
      }));

      const { error } = await supabase.from("follow_ups_planejados").insert(followUps);
      if (error) throw error;

      toast.success("Lembretes agendados com sucesso!", {
        description: `${followUps.length} follow-ups adicionados à sua agenda.`
      });
      
      // Recarrega o plano para atualizar o estado visual (opcional)
      carregarPlano();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao agendar follow-ups");
    } finally {
      setScheduling(false);
    }
  };

  useEffect(() => {
    carregarPlano();
  }, [dataBase, provider]);

  return (
    <Card className="p-6 overflow-hidden relative border-primary/20 bg-gradient-to-br from-white to-primary/5">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <Brain className="w-32 h-32 text-primary" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Planejamento da Semana</h3>
          </div>
          <p className="text-sm text-muted-foreground">Sugestões estratégicas baseadas em IA e dados reais</p>
        </div>

        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm p-1 rounded-xl border">
          <Button variant="ghost" size="icon" onClick={() => setDataBase(subWeeks(dataBase, 1))} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2 min-w-[140px] justify-center">
            <Calendar className="h-3 w-3" />
            Semana {semanaInfo.numero} ({semanaInfo.label})
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDataBase(addWeeks(dataBase, 1))} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
           <select 
              value={provider} 
              onChange={(e) => {
                setProvider(e.target.value);
                localStorage.setItem("ai_provider", e.target.value);
              }}
              className="text-[10px] h-9 bg-white border rounded-lg px-3 font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="gemini">Gemini 2.5</option>
              <option value="openai">GPT-4o mini</option>
            </select>
          <Button 
            onClick={() => carregarPlano(true)} 
            disabled={loading} 
            variant="default" 
            className="h-9 shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {plano ? "Recalcular" : "Gerar Plano"}
          </Button>
        </div>
      </div>

      {loading && !plano ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <Brain className="w-12 h-12 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-semibold text-lg">Analisando sua operação...</p>
            <p className="text-sm text-muted-foreground">Cruzando metas, propostas e clientes inativos.</p>
          </div>
        </div>
      ) : plano ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 prose prose-sm max-w-none dark:prose-invert 
              prose-headings:text-primary prose-headings:font-bold prose-headings:tracking-tight
              prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-primary/10
              prose-p:text-slate-600 prose-p:leading-relaxed
              prose-li:text-slate-600
              bg-white/40 rounded-2xl p-6 border border-white shadow-inner">
              <ReactMarkdown>{plano.plano_markdown}</ReactMarkdown>
            </div>

            {plano.metadados?.sugestoes_followup && (
              <div className="w-full lg:w-80 space-y-4">
                <Card className="p-4 border-primary/10 bg-primary/5">
                  <div className="flex items-center gap-2 mb-3">
                    <BellPlus className="w-4 h-4 text-primary" />
                    <h4 className="font-bold text-sm">Ações Rápidas</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    A IA identificou {plano.metadados.sugestoes_followup.length} contatos prioritários para esta semana.
                  </p>
                  <Button 
                    className="w-full h-8 text-xs" 
                    onClick={agendarFollowUps}
                    disabled={scheduling}
                  >
                    {scheduling ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Bell className="w-3 h-3 mr-2" />}
                    Agendar Follow-ups
                  </Button>
                </Card>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex items-center justify-between text-[10px] text-muted-foreground italic px-2">
            <span>Gerado em {new Date(plano.created_at).toLocaleString("pt-BR")} via {plano.provider}</span>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] font-normal py-0">Estratégico</Badge>
              <Badge variant="outline" className="text-[9px] font-normal py-0">Semana {semanaInfo.numero}</Badge>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
           <div className="max-w-xs mx-auto space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Nenhum plano para esta semana</h4>
              <p className="text-sm text-slate-500">Clique em "Gerar Plano" para que a IA analise seus dados e sugira as melhores ações.</p>
            </div>
            <Button onClick={() => carregarPlano()} className="bg-primary/10 text-primary hover:bg-primary/20 border-none">
              Gerar agora
            </Button>
           </div>
        </div>
      )}
    </Card>
  );
}
