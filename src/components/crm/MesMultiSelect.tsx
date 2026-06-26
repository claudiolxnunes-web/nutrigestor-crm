import { useMemo, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Multi-seleção de meses (formato YYYY-MM) com atalhos rápidos
 * (Mês atual, Trimestre atual, Semestre atual, Ano atual).
 *
 * - `available`: lista de meses (YYYY-MM) que existem nos dados.
 * - `value`: array de meses selecionados.
 * - `onChange`: recebe o novo array (sempre ordenado desc).
 */
export type MesMultiSelectProps = {
  available: string[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  className?: string;
  /** Se true, mostra botão "Limpar" e permite seleção vazia. Default: false. */
  allowEmpty?: boolean;
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const currentYear = () => new Date().getFullYear();

/** Retorna meses YYYY-MM do trimestre atual (até o mês corrente). */
const trimestreAtual = (): string[] => {
  const d = new Date();
  const m = d.getMonth(); // 0..11
  const y = d.getFullYear();
  const startMonth = Math.floor(m / 3) * 3;
  const out: string[] = [];
  for (let i = startMonth; i <= m; i++) {
    out.push(`${y}-${String(i + 1).padStart(2, "0")}`);
  }
  return out;
};

const semestreAtual = (): string[] => {
  const d = new Date();
  const m = d.getMonth();
  const y = d.getFullYear();
  const startMonth = m < 6 ? 0 : 6;
  const out: string[] = [];
  for (let i = startMonth; i <= m; i++) {
    out.push(`${y}-${String(i + 1).padStart(2, "0")}`);
  }
  return out;
};

const anoAtual = (): string[] => {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const out: string[] = [];
  for (let i = 0; i <= m; i++) {
    out.push(`${y}-${String(i + 1).padStart(2, "0")}`);
  }
  return out;
};

const formatLabel = (value: string[]): string => {
  if (value.length === 0) return "Nenhum mês";
  if (value.length === 1) return value[0];
  // Verifica se é contínuo
  const sorted = [...value].sort();
  return `${sorted[0]} → ${sorted[sorted.length - 1]} (${value.length})`;
};

export function MesMultiSelect({
  available,
  value,
  onChange,
  label = "Mês",
  className,
  allowEmpty = false,
}: MesMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const sortedAvailable = useMemo(
    () => Array.from(new Set(available)).sort().reverse(),
    [available]
  );

  const intersect = (preset: string[]) =>
    preset.filter((m) => sortedAvailable.includes(m));

  const setPreset = (preset: string[]) => {
    const filtered = intersect(preset);
    if (filtered.length === 0 && preset.length > 0) {
      // fallback: usa o preset completo mesmo sem dados
      onChange(preset.sort().reverse());
    } else {
      onChange(filtered.sort().reverse());
    }
  };

  const toggle = (m: string) => {
    if (value.includes(m)) {
      const next = value.filter((x) => x !== m);
      if (next.length === 0 && !allowEmpty) return;
      onChange(next);
    } else {
      onChange([...value, m].sort().reverse());
    }
  };

  const isPresetActive = (preset: string[]) => {
    if (preset.length !== value.length) return false;
    const set = new Set(value);
    return preset.every((m) => set.has(m));
  };

  return (
    <div className={cn("space-y-1", className)}>
      {label && <label className="text-xs text-muted-foreground">{label}</label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 min-w-[200px] justify-between font-normal"
          >
            <span className="truncate">{formatLabel(value)}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <div className="p-2 space-y-1">
            <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
              Atalhos
            </div>
            <PresetButton
              label="Mês atual"
              active={isPresetActive([currentMonth()])}
              onClick={() => setPreset([currentMonth()])}
            />
            <PresetButton
              label={`Trimestre atual (${trimestreAtual().length}m)`}
              active={isPresetActive(trimestreAtual())}
              onClick={() => setPreset(trimestreAtual())}
            />
            <PresetButton
              label={`Semestre atual (${semestreAtual().length}m)`}
              active={isPresetActive(semestreAtual())}
              onClick={() => setPreset(semestreAtual())}
            />
            <PresetButton
              label={`Ano ${currentYear()} (${anoAtual().length}m)`}
              active={isPresetActive(anoAtual())}
              onClick={() => setPreset(anoAtual())}
            />
          </div>
          <Separator />
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Marcar manualmente
              </span>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => allowEmpty ? onChange([]) : onChange([currentMonth()])}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpar
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-auto pr-1">
              {sortedAvailable.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-3 text-center">
                  Sem meses disponíveis
                </div>
              ) : (
                sortedAvailable.map((m) => {
                  const checked = value.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggle(m)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent text-left",
                        checked && "bg-accent/60"
                      )}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                          checked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input"
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="font-mono">{m}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {value.length > 1 && (
        <div className="flex flex-wrap gap-1 pt-1 max-w-[400px]">
          {[...value].sort().reverse().slice(0, 6).map((m) => (
            <Badge key={m} variant="secondary" className="text-xs font-mono">
              {m}
            </Badge>
          ))}
          {value.length > 6 && (
            <Badge variant="outline" className="text-xs">
              +{value.length - 6}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

function PresetButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-accent transition-colors",
        active && "bg-primary/10 text-primary font-medium"
      )}
    >
      {label}
    </button>
  );
}