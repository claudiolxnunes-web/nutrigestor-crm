import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, MessageCircle, Mail, CheckCircle2, Clock, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";

export function FollowUpPlanejadoCard({ planejamentoId }: { planejamentoId?: string }) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarFollowUps = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      let query = supabase
        .from("follow_ups_planejados")
        .select("*")
        .eq("organizacao_id", orgId)
        .order("data_planejada", { ascending: true });
      
      if (planejamentoId) {
        query = query.eq("planejamento_id", planejamentoId);
      } else {
        // Se não passar ID, mostra os pendentes da semana atual
        const hoje = new Date().toISOString().split('T')[0];
        query = query.eq("status", "pendente").gte("data_planejada", hoje);
      }

      const { data, error } = await query;
      if (error) throw error;
      setFollowUps(data || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar follow-ups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFollowUps();
  }, [orgId, planejamentoId]);

  const concluirFollowUp = async (id: string) => {
    try {
      const { error } = await supabase
        .from("follow_ups_planejados")
        .update({ status: "concluido" })
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Follow-up concluído!");
      carregarFollowUps();
    } catch (e: any) {
      toast.error("Erro ao atualizar follow-up");
    }
  };

  const excluirFollowUp = async (id: string) => {
    try {
      const { error } = await supabase
        .from("follow_ups_planejados")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      toast.success("Follow-up removido");
      carregarFollowUps();
    } catch (e: any) {
      toast.error("Erro ao excluir");
    }
  };

  const abrirWhatsApp = (item: any) => {
    // Aqui poderíamos buscar o telefone do cliente se tivéssemos o ID
    // Por enquanto, apenas abre o WhatsApp com a mensagem
    const msg = encodeURIComponent(item.mensagem_sugerida || "");
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  if (loading && followUps.length === 0) return null;
  if (!loading && followUps.length === 0) return null;

  return (
    <Card className="p-6 border-amber-100 bg-amber-50/30">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Follow-ups Agendados</h3>
            <p className="text-xs text-muted-foreground">Lembretes baseados no planejamento de IA</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-white">{followUps.length} pendentes</Badge>
      </div>

      <div className="space-y-3">
        {followUps.map((item) => (
          <div 
            key={item.id} 
            className="group bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-full",
                item.tipo_contato === 'whatsapp' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
              )}>
                {item.tipo_contato === 'whatsapp' ? <MessageCircle className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">{item.cliente_nome}</span>
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {format(new Date(item.data_planejada), "dd/MM", { locale: ptBR })}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {item.mensagem_sugerida || "Acompanhamento sugerido pela IA"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => excluirFollowUp(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              {item.tipo_contato === 'whatsapp' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => abrirWhatsApp(item)}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  WhatsApp
                </Button>
              )}

              <Button 
                variant="default" 
                size="sm" 
                className="h-8 bg-slate-900 hover:bg-slate-800"
                onClick={() => concluirFollowUp(item.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Concluir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

import { cn } from "@/lib/utils";