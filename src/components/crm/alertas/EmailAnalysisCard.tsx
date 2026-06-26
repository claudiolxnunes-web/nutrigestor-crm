import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, AlertCircle, CheckCircle2, Clock, User, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type EmailAnalysis = {
  id: string;
  email_summary: string;
  category: string;
  priority: string;
  identified_client_id: string | null;
  suggested_action: string | null;
  urgency_score: number | null;
  status: string;
  received_at: string;
  created_at: string;
  client_name?: string;
};

const PRIORITY_BADGE: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
  urgent: "destructive",
};

const CATEGORY_LABEL: Record<string, string> = {
  comercial: "Comercial",
  suporte: "Suporte",
  financeiro: "Financeiro",
  logistica: "Logística",
  oportunidade: "Oportunidade",
  reclamacao: "Reclamação",
};

export function EmailAnalysisCard({ 
  analysis, 
  onStatusChange 
}: { 
  analysis: EmailAnalysis;
  onStatusChange?: (id: string, newStatus: string) => void;
}) {
  const priority = analysis.priority?.toLowerCase() || "medium";
  const category = analysis.category?.toLowerCase() || "outro";
  const isProcessed = analysis.status === 'processed';

  return (
    <Card className={cn(
      "p-4 bg-white dark:bg-card border border-white/20 shadow-sm hover:shadow-md transition-all",
      isProcessed && "opacity-60 grayscale-[0.5]"
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "p-2 rounded-xl shrink-0",
          priority === 'high' || priority === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600',
          isProcessed && "bg-slate-50 text-slate-400"
        )}>
          {isProcessed ? <CheckCircle2 className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant={PRIORITY_BADGE[priority] || "default"} className="text-[10px] uppercase font-bold">
              {priority}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase font-bold">
              {CATEGORY_LABEL[category] || category}
            </Badge>
            {analysis.urgency_score && (
              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                Urgência: {analysis.urgency_score}/10
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(analysis.received_at), "dd/MM/yyyy HH:mm")}
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Resumo do E-mail
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
            {analysis.email_summary}
          </p>

          {analysis.suggested_action && (
            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 mb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary uppercase">Ação Sugerida</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                {analysis.suggested_action}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <User className="h-3.5 w-3.5" />
              {analysis.client_name ? (
                <span className="font-bold text-slate-700 dark:text-slate-200">{analysis.client_name}</span>
              ) : (
                <span>Cliente não identificado</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {analysis.identified_client_id && (
                <Button variant="ghost" size="sm" asChild className="h-8 gap-2 text-xs font-bold text-primary">
                  <Link to={`/clientes?id=${analysis.identified_client_id}`}>
                    Ver Cliente
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              )}
              
              <Button 
                variant={isProcessed ? "outline" : "default"} 
                size="sm" 
                className="h-8 gap-2 text-xs font-bold uppercase tracking-tighter"
                onClick={() => onStatusChange?.(analysis.id, isProcessed ? 'pending' : 'processed')}
              >
                {isProcessed ? "Reabrir" : "Concluir"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
