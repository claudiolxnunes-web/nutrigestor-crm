import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Brain, ShieldCheck, Loader2, Save, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { AIProviderStatus } from "@/components/crm/gerencial/AIProviderStatus";

export default function Configuracoes() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Por favor, insira uma API Key");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("save-openai-key", {
        body: { apiKey: apiKey.trim() },
      });

      if (error) throw error;

      toast.success("API Key salva com sucesso!");
      setApiKey(""); // Clear after saving for security
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      console.error("Erro ao salvar chave:", err);
      toast.error("Falha ao salvar a API Key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <PageHeader 
        title="Configurações" 
        subtitle="Gerencie suas chaves e integrações de IA"
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">OpenAI Integration</h3>
                <p className="text-sm text-muted-foreground">Configure sua própria chave para as análises</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">Sua API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sua chave será armazenada de forma segura e usada apenas para as funções de IA deste projeto.
                </p>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={loading || !apiKey} 
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar e Revalidar
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-slate-50 dark:bg-slate-900/50 border-dashed">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <div className="text-sm space-y-2">
                <p className="font-bold">Segurança e Privacidade</p>
                <p className="text-muted-foreground leading-relaxed">
                  Ao configurar sua própria chave, você passa a usar sua cota direta da OpenAI. 
                  Isso garante maior limite de requisições e uso do modelo GPT-4o-mini.
                </p>
                <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                  <li>Criptografia de ponta a ponta</li>
                  <li>Acesso restrito via Edge Functions</li>
                  <li>Opção de revogação a qualquer momento</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div key={refreshKey}>
            <AIProviderStatus />
          </div>
          
          <Card className="p-6">
            <h4 className="font-bold text-sm mb-4">Como obter uma chave?</h4>
            <ol className="text-sm space-y-4 text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <span>Acesse o <a href="https://platform.openai.com/" target="_blank" rel="noreferrer" className="text-primary underline">OpenAI Dashboard</a></span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <span>Vá em "API Keys" e crie uma nova chave secreta</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                <span>Certifique-se de ter saldo (Credits) em sua conta de faturamento</span>
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}