import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
 import * as XLSX from "@e965/xlsx";
 import { Upload, Download, Loader2, Trash2, FileSpreadsheet, AlertTriangle, Pencil, ChevronRight, ChevronDown, ArrowRightLeft } from "lucide-react";
 import { PageHeader } from "@/components/layout/AppLayout";
 import { motion } from "framer-motion";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { useRole } from "@/hooks/useRole";
 import { useOrg } from "@/hooks/useOrg";
 import { toast } from "sonner";
  import { crmService } from "@/services/crmService";
 import { Seo } from "@/components/Seo";
 import { useMetas } from "@/hooks/crm/useMetas";
import { fmtBRL, fmtNum, fmtPct, norm, toMesAno } from "@/utils/crm/formatters";
import { detectRegional12Layout, parsePlanNumber } from "@/utils/crm/excel";
 import { Meta, PedidoAberto, Venda as VendaAgg, Rep as RepLite } from "@/types/crm";
 
  export default function Metas() {
    const { user } = useAuth();
    const { isGestor, gestorCode, loading: roleLoading } = useRole();
    const { orgId } = useOrg();
   const inputRef = useRef<HTMLInputElement>(null);
   const inputRefOrc = useRef<HTMLInputElement>(null);
   const inputRefRegional = useRef<HTMLInputElement>(null);
   const [importing, setImporting] = useState(false);
   const [filterMes, setFilterMes] = useState("");

    const { data, isLoading: metasLoading, refetch: load } = useMetas(orgId);
    const metas = useMemo(() => data?.metas ?? [] as Meta[], [data]);
    const pedidosAberto = useMemo(() => data?.pedidosAberto ?? [] as PedidoAberto[], [data]);
    const vendasAgg = useMemo(() => data?.vendasAgg ?? [] as VendaAgg[], [data]);
    const reps = useMemo(() => data?.reps ?? [] as RepLite[], [data]);
    const loading = metasLoading;
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    mode: "create" | "edit";
    meta?: Meta;
    cod_rc: string;
    representante: string;
    mes_ano: string;
    linha: string;
    solucao: string;
    subsolucao: string;
    meta_faturamento: string;
    meta_volume: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };
  const [errorReport, setErrorReport] = useState<{
    fileName: string;
    total: number;
    inserted: number;
    skipped: number;
    errors: { linha: number; valores: string; motivo: string }[];
    warnings: { linha: number; valores: string; aviso: string }[];
  } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transfer, setTransfer] = useState({
    origemRc: "",
    destinoRc: "",
    percentual: "100",
    escopo: "futuros" as "futuros" | "ano" | "mes",
    mes: "",
  });
  const [transferring, setTransferring] = useState(false);


  const filtered = useMemo(
    () => (filterMes ? metas.filter((m) => m.mes_ano === filterMes) : metas),
    [metas, filterMes]
  );

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, m) => ({
        fat: acc.fat + Number(m.meta_faturamento ?? 0),
        vol: acc.vol + Number(m.meta_volume ?? 0),
      }),
      { fat: 0, vol: 0 }
    );
  }, [filtered]);

  const mesesDisponiveis = useMemo(
    () => {
      const set = new Set<string>();
      metas.forEach((m) => m.mes_ano && set.add(m.mes_ano));
      vendasAgg.forEach((v) => v.mes_ano && set.add(v.mes_ano));
      return Array.from(set).sort();
    },
    [metas, vendasAgg]
  );

  const mesCorrente = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  // Realizado por (mes_ano, cod_rc)
  const realizadoMap = useMemo(() => {
    const map = new Map<string, { fat: number; vol: number }>();
    vendasAgg.forEach((v) => {
      if (!v.cod_rc || !v.mes_ano) return;
      const k = `${v.mes_ano}|${v.cod_rc}`;
      const cur = map.get(k) ?? { fat: 0, vol: 0 };
      cur.fat += Number(v.faturamento_realizado) || 0;
      cur.vol += Number(v.volume_kg) || 0;
      map.set(k, cur);
    });
    return map;
  }, [vendasAgg]);

  // Pedidos em aberto (snapshot mais recente) por cod_rc + mês de previsão de faturamento.
  // Chave: `${mes_previsto}|${cod_rc}` — mes_previsto é o mês corrente quando não há prev_faturamento.
  const abertoPorRCMes = useMemo(() => {
    const map = new Map<string, { valor: number; volume: number }>();
    if (pedidosAberto.length === 0) return map;
    const ultimo = pedidosAberto.reduce((max, p) => (p.data_snapshot && p.data_snapshot > max ? p.data_snapshot : max), "");
    const vigentes = ultimo ? pedidosAberto.filter((p) => p.data_snapshot === ultimo) : pedidosAberto;
    vigentes.forEach((p) => {
      const rc = p.cod_rc || "—";
      // Sem previsão → considera mês corrente. Com previsão → usa o mês da previsão.
      const mesPrev = p.prev_faturamento ? p.prev_faturamento.slice(0, 7) : mesCorrente;
      const k = `${mesPrev}|${rc}`;
      const cur = map.get(k) ?? { valor: 0, volume: 0 };
      cur.valor += Number(p.valor) || 0;
      cur.volume += Number(p.volume) || 0;
      map.set(k, cur);
    });
    return map;
  }, [pedidosAberto, mesCorrente]);

  /** Agrupa por (mes_ano, cod_rc) e soma faturamento + volume; mantém linhas detalhadas para expand. */
  const grupos = useMemo(() => {
    const map = new Map<string, {
      key: string;
      mes_ano: string;
      cod_rc: string;
      representante: string | null;
      meta_faturamento: number;
      meta_volume: number;
      realizado_fat: number;
      realizado_vol: number;
      aberto_fat: number;
      aberto_vol: number;
      itens: Meta[];
    }>();
    for (const m of filtered) {
      const key = `${m.mes_ano}|${m.cod_rc}`;
      const cur = map.get(key) ?? {
        key, mes_ano: m.mes_ano, cod_rc: m.cod_rc, representante: m.representante,
        meta_faturamento: 0, meta_volume: 0,
        realizado_fat: 0, realizado_vol: 0, aberto_fat: 0, aberto_vol: 0,
        itens: [],
      };
      cur.meta_faturamento += Number(m.meta_faturamento ?? 0);
      cur.meta_volume += Number(m.meta_volume ?? 0);
      cur.itens.push(m);
      map.set(key, cur);
    }
    // Adiciona "phantom" groups: RCs com vendas/pedidos mas sem meta cadastrada.
    // Mostramos para que o gestor consiga adicionar a meta manualmente.
    const repNomeByCod = new Map<string, string>();
    reps.forEach((r) => { if (r.cod_rc) repNomeByCod.set(String(r.cod_rc).trim(), r.nome); });
    const considerarMes = (mes: string) => !filterMes || mes === filterMes;
    // a) das vendas
    vendasAgg.forEach((v) => {
      if (!v.cod_rc || !v.mes_ano) return;
      if (!considerarMes(v.mes_ano)) return;
      const key = `${v.mes_ano}|${v.cod_rc}`;
      if (map.has(key)) return;
      map.set(key, {
        key, mes_ano: v.mes_ano, cod_rc: v.cod_rc,
        representante: repNomeByCod.get(v.cod_rc) ?? null,
        meta_faturamento: 0, meta_volume: 0,
        realizado_fat: 0, realizado_vol: 0, aberto_fat: 0, aberto_vol: 0,
        itens: [],
      });
    });
    // b) dos pedidos em aberto (mês corrente / previsto)
    if (considerarMes(mesCorrente)) {
      abertoPorRCMes.forEach((_v, k) => {
        const [mes, rc] = k.split("|");
        if (!considerarMes(mes)) return;
        const key = `${mes}|${rc}`;
        if (map.has(key)) return;
        map.set(key, {
          key, mes_ano: mes, cod_rc: rc,
          representante: repNomeByCod.get(rc) ?? null,
          meta_faturamento: 0, meta_volume: 0,
          realizado_fat: 0, realizado_vol: 0, aberto_fat: 0, aberto_vol: 0,
          itens: [],
        });
      });
    }
    // Anota realizado e pedidos em aberto cuja previsão de faturamento cai no mes_ano da meta
    // (cobre tanto mês corrente quanto meses futuros com previsão).
    map.forEach((g) => {
      const real = realizadoMap.get(`${g.mes_ano}|${g.cod_rc}`);
      if (real) { g.realizado_fat = real.fat; g.realizado_vol = real.vol; }
      // Só projeta para o mês corrente em diante (passado já tem realizado fechado)
      if (g.mes_ano >= mesCorrente) {
        const ab = abertoPorRCMes.get(`${g.mes_ano}|${g.cod_rc}`);
        if (ab) { g.aberto_fat = ab.valor; g.aberto_vol = ab.volume; }
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.mes_ano !== b.mes_ano) return a.mes_ano.localeCompare(b.mes_ano);
      return a.cod_rc.localeCompare(b.cod_rc);
    });
  }, [filtered, realizadoMap, abertoPorRCMes, mesCorrente, vendasAgg, reps, filterMes]);

  const handleTemplate = () => {
    // Modelo padrão "Regional 12 meses" — mesmo layout reconhecido pelo importador.
    // Linha 1: meses agrupados (cabeçalho mesclado visualmente).
    // Linha 2: pares Fat / Vol por mês.
    // Demais linhas: dados (1 linha por RC × Solução × Subsolução).
    const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const ano = new Date().getFullYear();
    const header1: any[] = ["CODIGO", "REPRESENTANTE", "SOLUCAO", "SUBSOLUCAO"];
    const header2: any[] = ["", "", "", ""];
    meses.forEach((m) => {
      header1.push(`${m}/${ano}`, "");
      header2.push("Fat (R$)", "Vol (kg)");
    });
    const exemplo1: any[] = ["001", "João Silva", "SAL MINERAL", "BOVINOS DE CORTE"];
    const exemplo2: any[] = ["001", "João Silva", "RACAO", "LEITE"];
    const exemplo3: any[] = ["002", "Maria Souza", "PREMIX E OUTROS", "AVES"];
    [exemplo1, exemplo2, exemplo3].forEach((row) => {
      meses.forEach((_, i) => {
        // valores de exemplo só nos 3 primeiros meses para ilustrar
        if (i < 3) row.push(200000 + i * 10000, 40000 + i * 2000);
        else row.push(0, 0);
      });
    });
    const aoa = [header1, header2, exemplo1, exemplo2, exemplo3];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Mescla células do cabeçalho de mês (linha 1) sobre as 2 colunas Fat/Vol
    ws["!merges"] = meses.map((_, i) => ({
      s: { r: 0, c: 4 + i * 2 },
      e: { r: 0, c: 5 + i * 2 },
    }));
    // Larguras de coluna
    ws["!cols"] = [
      { wch: 10 }, { wch: 32 }, { wch: 22 }, { wch: 22 },
      ...Array(24).fill({ wch: 12 }),
    ];

    // Aba de instruções
    const instrucoes = [
      ["MODELO PADRÃO DE METAS — Regional 12 meses"],
      [""],
      ["Estrutura obrigatória:"],
      ["• Colunas A–D: CODIGO, REPRESENTANTE, SOLUCAO, SUBSOLUCAO"],
      ["• Colunas E em diante: 12 meses, cada um com 2 colunas (Fat R$ e Vol kg)"],
      ["• Linha 1: nome do mês (ex: JAN/2026) — mesclada sobre Fat e Vol"],
      ["• Linha 2: rótulos 'Fat (R$)' e 'Vol (kg)'"],
      ["• Da linha 3 em diante: uma linha por combinação RC × Solução × Subsolução"],
      [""],
      ["Regras de importação:"],
      ["• CODIGO deve existir em Representantes (a página avisa se não existir)"],
      ["• Chave única: organização + cod_rc + solução + subsolução + mes_ano"],
      ["  → re-importar o mesmo arquivo ATUALIZA, não duplica"],
      ["• Linhas com totais (TOTAL, TOTAIS) e linhas vazias são ignoradas"],
      ["• Valores aceitos em formato BR (1.234,56) ou US (1234.56)"],
      [""],
      ["Como usar:"],
      ["1. Substitua as linhas de exemplo pelos seus dados reais"],
      ["2. Mantenha as 4 primeiras colunas e a estrutura de meses"],
      ["3. Salve e faça upload na página Metas → 'Importar planilha'"],
    ];
    const wsInfo = XLSX.utils.aoa_to_sheet(instrucoes);
    wsInfo["!cols"] = [{ wch: 80 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metas");
    XLSX.utils.book_append_sheet(wb, wsInfo, "Instruções");
    XLSX.writeFile(wb, "modelo_metas_padrao.xlsx");
  };

  const handleFile = async (file: File) => {
    if (!user || !orgId) return;
    setImporting(true);
    try {
      // Detecção de formato: Regional (FAT x VOL) ou Orçamento RC (Power BI)
      try {
        const sniffBuf = await file.arrayBuffer();
        const sniffWb = XLSX.read(sniffBuf, { type: "array" });
        const firstWs = sniffWb.Sheets[sniffWb.SheetNames[0]];
        const aoaSniff: any[][] = XLSX.utils.sheet_to_json(firstWs, { header: 1, defval: "", raw: true }) as any;

        // 1. Nome do arquivo indica Regional (FAT x VOL)?
        const nomeArq = norm(file.name);
        if (nomeArq.includes("fat") && nomeArq.includes("vol")) {
          console.info("[metas-import] Regional detectado pelo nome do arquivo");
          setImporting(false);
          return handleRegional12(file, sniffWb);
        }

        // 2. Layout Regional (meses na primeira linha ou CODIGO+FATURAMENTO+SOLUCAO)?
        if (detectRegional12Layout(aoaSniff)) {
          console.info("[metas-import] Regional detectado por detectRegional12Layout");
          setImporting(false);
          return handleRegional12(file, sniffWb);
        }

        // 3. Orçamento RC (Power BI): abas com R$ ou % + colunas específicas
        const hasOrcSheets = sniffWb.SheetNames.some((n) => /r\$/i.test(n)) ||
          sniffWb.SheetNames.some((n) => /%/.test(n));
        const firstRow = XLSX.utils.sheet_to_json<any>(firstWs, { defval: "", raw: true })[0] ?? {};
        const cols = Object.keys(firstRow).map((k) => k.toUpperCase());
        const looksLikeOrc = hasOrcSheets &&
          cols.includes("CODIGO") && cols.includes("SOLUCAO") && cols.includes("JANEIRO");
        if (looksLikeOrc) {
          setImporting(false);
          toast.info("Formato Orçamento RC detectado — usando o importador correto.");
          return handleOrcamento(file);
        }
      } catch (e) {
        console.warn("[metas-import] Sniff falhou:", e);
      }

      // Carrega catálogos para validação/auto-preenchimento
      const [{ data: reps }, { data: vendaLinhas }] = await Promise.all([
        supabase
          .from("representantes")
          .select("cod_rc, nome")
          .eq("organizacao_id", orgId),
        supabase
          .from("vendas")
          .select("linha")
          .eq("organizacao_id", orgId)
          .not("linha", "is", null)
          .limit(5000),
      ]);
      const repByCod = new Map<string, string>();
      const repByNome = new Map<string, { cod_rc: string; nome: string }>();
      (reps ?? []).forEach((r) => {
        if (r.cod_rc) repByCod.set(String(r.cod_rc).trim(), r.nome);
        if (r.nome) repByNome.set(norm(r.nome), { cod_rc: String(r.cod_rc ?? "").trim(), nome: r.nome });
      });
      const linhasCanon = new Map<string, string>();
      (vendaLinhas ?? []).forEach((v: any) => {
        if (v.linha) {
          const k = norm(String(v.linha));
          if (!linhasCanon.has(k)) linhasCanon.set(k, String(v.linha).trim());
        }
      });

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Detecção tolerante de cabeçalho: procura nas primeiras 15 linhas a que contém pelo menos
      // 2 colunas reconhecíveis (cod_rc/representante/linha/mes/meta...).
      const colMap: Record<string, string> = {
        cod_rc: "cod_rc", "cod rc": "cod_rc", "codigo": "cod_rc", "código": "cod_rc",
        "código rc": "cod_rc", "codigo rc": "cod_rc", rc: "cod_rc",
        representante: "representante", nome: "representante", vendedor: "representante", "nome rc": "representante",
        linha: "linha", "linha de produto": "linha", solucao: "linha", "solução": "linha", produto: "linha",
        mes_ano: "mes_ano", mes: "mes_ano", "mes ano": "mes_ano", "mês": "mes_ano",
        "mes/ano": "mes_ano", periodo: "mes_ano", "período": "mes_ano", "ano mes": "mes_ano",
        meta_faturamento: "meta_faturamento", faturamento: "meta_faturamento",
        "meta faturamento": "meta_faturamento", "meta r$": "meta_faturamento",
        "valor": "meta_faturamento", "r$": "meta_faturamento", "fat": "meta_faturamento",
        meta_volume: "meta_volume", volume: "meta_volume", "meta volume": "meta_volume",
        "meta kg": "meta_volume", kg: "meta_volume", "volume kg": "meta_volume", "qtd": "meta_volume",
      };
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false }) as any;
      let headerIdx = -1;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(aoa.length, 15); i++) {
        const row = aoa[i] ?? [];
        const matched = row.filter((c) => c != null && colMap[norm(String(c))]).length;
        if (matched >= 2) { headerIdx = i; headers = row.map((c) => String(c ?? "")); break; }
      }
      if (headerIdx < 0) {
        toast.error("Não encontrei cabeçalho válido na planilha. Use as colunas: cod_rc, representante, linha, mes_ano, meta_faturamento, meta_volume.");
        setImporting(false);
        return;
      }

      // Fallback: layout pivotado se cabeçalho tem FATURAMENTO repetido OU meses (JANEIRO..DEZEMBRO)
      const fatCount = headers.filter((h) => norm(h).includes("faturamento")).length;
      const mesesPivot = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
      const mesCount = headers.filter((h) => mesesPivot.some((m) => norm(h).includes(m))).length;
      if (fatCount >= 2 || mesCount >= 6) {
        console.info("[metas-import] Layout pivotado detectado (FAT x" + fatCount + ", meses x" + mesCount + ") — redirecionando para handleRegional12");
        setImporting(false);
        return handleRegional12(file, wb);
      }
      const rows: any[] = aoa.slice(headerIdx + 1)
        .filter((r) => r.some((c: any) => c != null && String(c).trim() !== ""))
        .map((r) => {
          const o: any = {};
          headers.forEach((h, idx) => { o[h] = r[idx] ?? ""; });
          return o;
        });
      if (rows.length === 0) {
        toast.error(`Cabeçalho encontrado na linha ${headerIdx + 1} mas nenhuma linha de dados abaixo. Colunas detectadas: ${headers.join(", ")}`);
        setImporting(false);
        return;
      }
      const payload: any[] = [];
      const errors: { linha: number; valores: string; motivo: string }[] = [];
      const warnings: { linha: number; valores: string; aviso: string }[] = [];
      rows.forEach((raw, i) => {
        const m: any = {};
        for (const [k, v] of Object.entries(raw)) {
          const dest = colMap[norm(k)];
          if (dest) m[dest] = typeof v === "string" ? v.trim() : v;
        }
        const linhaArq = i + headerIdx + 2;
        let cod_rc = String(m.cod_rc ?? "").trim();
        let representante = m.representante ? String(m.representante).trim() : "";
        let linha = String(m.linha ?? "").trim();
        const mes_ano = toMesAno(m.mes_ano);
        const resumo = `cod_rc=${cod_rc || "—"} | rep=${representante || "—"} | linha=${linha || "—"} | mes=${m.mes_ano ?? "—"}`;

        // Auto-mapeia representante a partir do cod_rc, e vice-versa
        if (cod_rc && !representante && repByCod.has(cod_rc)) {
          representante = repByCod.get(cod_rc)!;
        } else if (!cod_rc && representante) {
          const hit = repByNome.get(norm(representante));
          if (hit) {
            cod_rc = hit.cod_rc;
            representante = hit.nome;
          }
        }

        // Validações obrigatórias
        if (!cod_rc) { errors.push({ linha: linhaArq, valores: resumo, motivo: "cod_rc ausente e não foi possível inferir pelo representante" }); return; }
        if (!linha)  { errors.push({ linha: linhaArq, valores: resumo, motivo: "linha ausente" }); return; }
        if (!mes_ano) { errors.push({ linha: linhaArq, valores: resumo, motivo: `mes_ano inválido: "${m.mes_ano ?? ""}"` }); return; }

        // Cross-check cod_rc → existe em representantes?
        if (!repByCod.has(cod_rc)) {
          errors.push({ linha: linhaArq, valores: resumo, motivo: `cod_rc "${cod_rc}" não cadastrado em Representantes` });
          return;
        }
        const nomeOficial = repByCod.get(cod_rc)!;
        if (representante && norm(representante) !== norm(nomeOficial)) {
          warnings.push({ linha: linhaArq, valores: resumo, aviso: `Nome do representante divergente — usando "${nomeOficial}" do cadastro` });
        }
        representante = nomeOficial;

        // Normaliza nome da linha contra histórico de vendas (case/acento-insensitive)
        const linhaCanon = linhasCanon.get(norm(linha));
        if (linhaCanon) {
          if (linhaCanon !== linha) {
            warnings.push({ linha: linhaArq, valores: resumo, aviso: `Linha "${linha}" normalizada para "${linhaCanon}"` });
          }
          linha = linhaCanon;
        } else if (linhasCanon.size > 0) {
          warnings.push({ linha: linhaArq, valores: resumo, aviso: `Linha "${linha}" não aparece no histórico de vendas — meta criada mesmo assim` });
        }

        const fat = Number(m.meta_faturamento ?? 0) || 0;
        const vol = Number(m.meta_volume ?? 0) || 0;
        if (fat === 0 && vol === 0) {
          errors.push({ linha: linhaArq, valores: resumo, motivo: "meta_faturamento e meta_volume ambos zerados" });
          return;
        }

        payload.push({
          organizacao_id: orgId,
          user_id: user.id,
          cod_rc,
          representante,
          linha,
          mes_ano,
          meta_faturamento: fat,
          meta_volume: vol,
        });
      });

      let inserted = 0;
      if (payload.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < payload.length; i += BATCH) {
          const chunk = payload.slice(i, i + BATCH);
         const { error } = await (supabase.from("metas") as any)
           .upsert(chunk, { onConflict: "organizacao_id,cod_rc,linha,mes_ano,solucao,subsolucao" });
          if (error) { toast.error(error.message); break; }
          inserted += chunk.length;
        }
        if (inserted > 0) await load();
      }

      setErrorReport({
        fileName: file.name,
        total: rows.length,
        inserted,
        skipped: errors.length,
        errors,
        warnings,
      });
      if (inserted > 0 && errors.length === 0) toast.success(`${inserted} meta(s) importada(s)/atualizada(s)`);
      else if (inserted > 0) toast.warning(`${inserted} importada(s) · ${errors.length} com erro`);
      else toast.error(`Nenhuma linha válida — ${errors.length} erro(s)`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteMes = async () => {
    if (!filterMes) return;
    if (!confirm(`Excluir TODAS as metas do mês ${filterMes}?`)) return;
    const { error } = await supabase.from("metas").delete().eq("mes_ano", filterMes);
    if (error) toast.error(error.message);
    else {
      toast.success("Metas do mês excluídas");
      load();
    }
  };

  const handleDeleteOne = async (m: Meta) => {
    if (!confirm(`Excluir a meta de ${m.representante ?? m.cod_rc} · ${m.linha} · ${m.mes_ano}?`)) return;
    const { error } = await supabase.from("metas").delete().eq("id", m.id);
    if (error) toast.error(error.message);
    else { toast.success("Meta excluída"); load(); }
  };

  const handleDeleteAll = async () => {
    if (!orgId) return;
    if (!confirm("Excluir TODAS as metas da organização? Essa ação não pode ser desfeita.")) return;
    if (!confirm("Confirma novamente: apagar TODAS as metas?")) return;
    const { error } = await supabase.from("metas").delete().eq("organizacao_id", orgId);
    if (error) toast.error(error.message);
    else { toast.success("Todas as metas excluídas"); load(); }
  };

  const openEditDialog = (m: Meta) => {
    setEditDialog({
      open: true, mode: "edit", meta: m,
      cod_rc: m.cod_rc,
      representante: m.representante ?? "",
      mes_ano: m.mes_ano,
      linha: m.linha ?? "",
      solucao: m.solucao ?? "",
      subsolucao: m.subsolucao ?? "",
      meta_faturamento: String(m.meta_faturamento ?? 0),
      meta_volume: String(m.meta_volume ?? 0),
    });
  };

  const openCreateDialog = (cod_rc: string, representante: string | null, mes_ano: string) => {
    setEditDialog({
      open: true, mode: "create",
      cod_rc, representante: representante ?? "", mes_ano,
      linha: "GERAL", solucao: "", subsolucao: "",
      meta_faturamento: "0", meta_volume: "0",
    });
  };

  const handleSaveDialog = async () => {
    if (!editDialog || !user || !orgId) return;
    const fat = Number(String(editDialog.meta_faturamento).replace(/\./g, "").replace(",", ".")) || 0;
    const vol = Number(String(editDialog.meta_volume).replace(/\./g, "").replace(",", ".")) || 0;
    if (editDialog.mode === "edit" && editDialog.meta) {
      const { error } = await supabase.from("metas")
        .update({
          meta_faturamento: fat, meta_volume: vol,
          linha: editDialog.linha || "GERAL",
          solucao: editDialog.solucao || null,
          subsolucao: editDialog.subsolucao || null,
          representante: editDialog.representante || null,
        })
        .eq("id", editDialog.meta.id);
      if (error) return toast.error(error.message);
      toast.success("Meta atualizada");
    } else {
      if (!editDialog.cod_rc.trim() || !editDialog.mes_ano.trim()) {
        return toast.error("Cód. RC e Mês são obrigatórios");
      }
      const { error } = await supabase.from("metas").insert({
        organizacao_id: orgId,
        user_id: user.id,
        cod_rc: editDialog.cod_rc.trim(),
        representante: editDialog.representante || null,
        linha: editDialog.linha || "GERAL",
        solucao: editDialog.solucao || null,
        subsolucao: editDialog.subsolucao || null,
        mes_ano: editDialog.mes_ano,
        meta_faturamento: fat,
        meta_volume: vol,
      });
      if (error) return toast.error(error.message);
      toast.success("Meta criada");
    }
    setEditDialog(null);
    load();
  };

  /** Importa o "Orçamento por RC" (export do Power BI) — 2 abas: *_r$ (faturamento) e *_% (volume kg).
   *  Pega cod_rc da coluna CODIGO, ignora linhas TOTAL ORCADO/DISTRIBUIDO, usa SOLUCAO como linha,
   *  e desdobra os 12 meses (JANEIRO..DEZEMBRO) em registros mes_ano YYYY-MM. */
  const handleOrcamento = async (file: File) => {
    try {
      const sniffBuf = await file.arrayBuffer();
      const sniffWb = XLSX.read(sniffBuf, { type: "array" });
      const firstWs = sniffWb.Sheets[sniffWb.SheetNames[0]];
      const aoaSniff: any[][] = XLSX.utils.sheet_to_json(firstWs, { header: 1, defval: "", raw: true }) as any;
      if (detectRegional12Layout(aoaSniff)) {
        toast.info("Formato Regional (12 meses) detectado — usando o importador correto.");
        return handleRegional12(file, sniffWb);
      }
    } catch {}
    return _orcInner(file);
  };

  /** Handler DIRETO para Regional FAT x VOL — sem detecção, com log em cada passo. */
  const handleRegionalDirect = async (file: File) => {
    if (!user || !orgId) return;
    setImporting(true);
    const L = (msg: string, ...args: any[]) => console.info(`[regional-direct] ${msg}`, ...args);
    try {
      L("1. Lendo arquivo:", file.name);
      const yearMatch = file.name.match(/(20\d{2})/);
      const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
      L("2. Ano extraído:", year);

      const buf = await file.arrayBuffer();
      const book = XLSX.read(buf, { type: "array" });
      const ws = book.Sheets[book.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as any;
      L("3. Total linhas AOA:", aoa.length);
      L("4. Linha 0 (primeiras 12 cols):", aoa[0]?.slice(0, 12));
      L("5. Linha 1 (primeiras 12 cols):", aoa[1]?.slice(0, 12));
      L("6. Linha 2 (primeiras 12 cols):", aoa[2]?.slice(0, 12));

      // Acha header: linha onde col 0 = "CODIGO"
      let headerIdx = -1;
      for (let i = 0; i < Math.min(aoa.length, 10); i++) {
        const n0 = norm(String(aoa[i]?.[0] ?? ""));
        if (n0 === "codigo" || n0 === "cod_rc") { headerIdx = i; break; }
      }
      L("7. headerIdx:", headerIdx);
      if (headerIdx < 0) { toast.error("Cabeçalho CODIGO não encontrado"); setImporting(false); return; }

      const hdr = (aoa[headerIdx] ?? []).map((c: any) => norm(String(c ?? "")));
      L("8. Header normalizado (primeiras 12):", hdr.slice(0, 12));

      // Detecta colunas por nome
      const idxSub = hdr.findIndex((h: string) => h === "subsolucao");
      const idxSol = hdr.findIndex((h: string) => h === "solucao");
      const idxFat = hdr.indexOf("faturamento");
      const monthStart = idxFat >= 0 ? idxFat : 10;
      L("9. idxSub:", idxSub, "idxSol:", idxSol, "idxFat:", idxFat, "monthStart:", monthStart);

      // Pula sub-header se existir
      const row2 = (aoa[headerIdx + 1] ?? []).map((c: any) => norm(String(c ?? "")));
      const hasSubHdr = row2.some((h: string) => h.includes("faturamento") || h.includes("volume"));
      const dataStart = headerIdx + (hasSubHdr ? 2 : 1);
      L("10. hasSubHdr:", hasSubHdr, "dataStart:", dataStart);

      // Busca representantes
      const { data: reps, error: repErr } = await (supabase.from("representantes") as any)
        .select("cod_rc, nome").eq("organizacao_id", orgId);
      L("11. Representantes carregados:", reps?.length ?? 0, "erro:", repErr?.message ?? "nenhum");
      if (!reps || reps.length === 0) { toast.error("Nenhum representante cadastrado"); setImporting(false); return; }

      const repByCod = new Map<string, { cod_rc: string; nome: string }>();
      (reps ?? []).forEach((r: any) => {
        const cod = String(r.cod_rc ?? "").trim();
        if (cod) repByCod.set(cod, { cod_rc: cod, nome: r.nome });
      });
      L("12. repByCod keys:", Array.from(repByCod.keys()));

      const payload: any[] = [];
      const errors: { linha: number; valores: string; motivo: string }[] = [];
      let skippedTotal = 0;
      let codRcAtual = "";

      for (let i = dataStart; i < aoa.length; i++) {
        const row = aoa[i];
        if (!row || row.length === 0) continue;
        const codRaw = String(row[0] ?? "").trim();
        if (/^totais?$/i.test(codRaw)) continue;
        if (codRaw) codRcAtual = codRaw;

        const sub = String(row[idxSub >= 0 ? idxSub : 5] ?? "").trim();
        const sol = String(row[idxSol >= 0 ? idxSol : 7] ?? "").trim();
        if (!sub && !sol) { skippedTotal++; continue; }
        if (!codRcAtual) continue;

        const padded = codRcAtual.padStart(6, "0");
        const noPad = codRcAtual.replace(/^0+/, "") || codRcAtual;
        const match = repByCod.get(codRcAtual) ?? repByCod.get(padded) ?? repByCod.get(noPad);
        if (!match) {
          errors.push({ linha: i + 1, valores: `cod=${codRcAtual}`, motivo: "RC não cadastrado" });
          continue;
        }

        for (let m = 0; m < 12; m++) {
          const fat = parsePlanNumber(row[monthStart + m * 2]);
          const vol = parsePlanNumber(row[monthStart + m * 2 + 1]);
          if (!fat && !vol) continue;
          payload.push({
            organizacao_id: orgId, user_id: user.id,
            cod_rc: match.cod_rc, representante: match.nome,
            linha: sol || sub, solucao: sol || null, subsolucao: sub || null,
            mes_ano: `${year}-${String(m + 1).padStart(2, "0")}`,
            meta_faturamento: fat, meta_volume: vol,
          });
        }
      }

      L("13. Resultado: payload=" + payload.length + " errors=" + errors.length + " skippedTotal=" + skippedTotal);
      if (payload.length > 0) L("14. Amostra payload[0]:", payload[0]);

      let inserted = 0;
      if (payload.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < payload.length; i += BATCH) {
          const chunk = payload.slice(i, i + BATCH);
          L("15. Upsert lote " + (i / BATCH + 1) + " (" + chunk.length + " registros)");
          const { error } = await (supabase.from("metas") as any)
            .upsert(chunk, { onConflict: "organizacao_id,cod_rc,linha,mes_ano,solucao,subsolucao" });
          if (error) {
            L("16. ERRO upsert:", error.message);
            toast.error("Erro upsert: " + error.message);
            break;
          }
          inserted += chunk.length;
        }
        if (inserted > 0) await load();
      }

      setErrorReport({
        fileName: file.name, total: payload.length + errors.length,
        inserted, skipped: errors.length, errors, warnings: [],
      });

      if (inserted > 0 && errors.length === 0) toast.success(`${inserted} meta(s) importada(s) (ano ${year})`);
      else if (inserted > 0) toast.warning(`${inserted} importada(s) · ${errors.length} com erro`);
      else toast.error(`Nenhuma linha válida — ${errors.length} erro(s)`);
    } catch (e: any) {
      L("ERRO FATAL:", e.message, e.stack);
      toast.error("Erro: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  /** Importa planilha "Regional":
   *  aceita tanto sem cabeçalho quanto com cabeçalho de meses em colunas.
   *  A=cod_rc, B=nome RC, F=sub-linha, H=grupo produto (linha),
   *  K..V = 12 meses de faturamento. Ano vem do nome do arquivo (4 dígitos) ou ano atual. */
  const handleRegional12 = async (file: File, wb?: XLSX.WorkBook) => {
    if (!user || !orgId) return;
    setImporting(true);
    try {
      const yearMatch = file.name.match(/(20\d{2})/);
      const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
      const buf = wb ? null : await file.arrayBuffer();
      const book = wb ?? XLSX.read(buf!, { type: "array" });
      const ws = book.Sheets[book.SheetNames[0]];
      const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true }) as any;

       const { data: reps } = await (supabase.from("representantes") as any)
         .select("cod_rc, nome")
         .eq("organizacao_id", orgId);
      const repByCod = new Map<string, { cod_rc: string; nome: string }>();
      const repByNome = new Map<string, { cod_rc: string; nome: string }>();
      const normNome = (s: string) => norm(String(s ?? ""))
        .replace(/[^a-z0-9]+/g, " ").trim();
      (reps ?? []).forEach((r: any) => {
        const entry = { cod_rc: String(r.cod_rc ?? "").trim(), nome: r.nome };
        if (entry.cod_rc) repByCod.set(entry.cod_rc, entry);
        if (r.nome) repByNome.set(normNome(r.nome), entry);
      });

      const payload: any[] = [];
      const errors: { linha: number; valores: string; motivo: string }[] = [];

      const isHeaderRow = (row: any[]) => {
        const n0 = norm(String(row?.[0] ?? ""));
        return n0 === "codigo" || n0 === "cod_rc" || n0 === "cod rc";
      };
      const headerIdx = aoa.findIndex(isHeaderRow);
      if (headerIdx < 0) {
        toast.error('Não encontrei o cabeçalho (linha começando com "CODIGO").');
        setImporting(false);
        return;
      }

      const hdr = (aoa[headerIdx] ?? []).map((c: any) => norm(String(c ?? "")));
      const colSub = hdr.findIndex((h: string) => h === "subsolucao" || h === "sub solucao");
      const colSol = hdr.findIndex((h: string) => h === "solucao" || h === "solução");
      const colFirstFat = hdr.indexOf("faturamento");
      const mesesNomes = ["janeiro","fevereiro","marco","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
      const colFirstMonth = hdr.findIndex((h: string) => mesesNomes.some((m) => h.includes(m)));

      const subHdr = (aoa[headerIdx + 1] ?? []).map((c: any) => norm(String(c ?? "")));
      const hasSubHeader = subHdr.some((h: string) => h.includes("faturamento") || h.includes("volume"));
      const subFatIdx = hasSubHeader ? subHdr.findIndex((h: string) => h.includes("faturamento")) : -1;
      const dataStart = headerIdx + (hasSubHeader ? 2 : 1);

      const idxSub = colSub >= 0 ? colSub : 5;
      const idxSol = colSol >= 0 ? colSol : 7;
      const monthStart = colFirstFat >= 0 ? colFirstFat
        : colFirstMonth >= 0 ? colFirstMonth
        : subFatIdx >= 0 ? subFatIdx
        : 10;

      console.info("[metas-import] idxSub=" + idxSub + " idxSol=" + idxSol + " monthStart=" + monthStart + " dataStart=" + dataStart);

      let codRcAtual = "";
      let nomeAtual = "";
      aoa.slice(dataStart).forEach((row, offset) => {
        const idx = dataStart + offset;
        if (!row || row.length === 0) return;
        const codRaw = String(row[0] ?? "").trim();
        const nomeRaw = String(row[1] ?? "").trim();
        if (/^totais?$/i.test(codRaw)) return;
        if (codRaw) { codRcAtual = codRaw; nomeAtual = nomeRaw || nomeAtual; }

        const subsolucao = String(row[idxSub] ?? "").trim();
        const solucao = String(row[idxSol] ?? "").trim();
        if (!solucao && !subsolucao) return;
        if (!codRcAtual) return;

        const padded6 = codRcAtual.padStart(6, "0");
        const semZero = codRcAtual.replace(/^0+/, "") || codRcAtual;
        let match = repByCod.get(codRcAtual) ?? repByCod.get(padded6) ?? repByCod.get(semZero);
        if (!match) {
          const nomeKey = normNome(nomeAtual);
          match = repByNome.get(nomeKey);
          if (!match && nomeKey) {
            for (const [k, v] of repByNome.entries()) {
              if (k.startsWith(nomeKey) || nomeKey.startsWith(k)) { match = v; break; }
            }
          }
        }
        if (!match) {
          errors.push({
            linha: idx + 1,
            valores: `cod=${codRcAtual} nome="${nomeAtual}"`,
            motivo: `Representante não cadastrado (código ou nome não bate)`,
          });
          return;
        }
        const cod_rc = match.cod_rc;
        const representante = match.nome;

        for (let m = 0; m < 12; m++) {
          const fat = parsePlanNumber(row[monthStart + m * 2]);
          const vol = parsePlanNumber(row[monthStart + m * 2 + 1]);
          if (!fat && !vol) continue;
          const mes_ano = `${year}-${String(m + 1).padStart(2, "0")}`;
          payload.push({
            organizacao_id: orgId,
            user_id: user.id,
            cod_rc,
            representante,
            linha: solucao || subsolucao,
            solucao: solucao || null,
            subsolucao: subsolucao || null,
            mes_ano,
            meta_faturamento: fat,
            meta_volume: vol,
          });
        }
      });

      // Deduplica por (cod_rc, solucao, subsolucao, mes_ano) — soma fat e vol
      const dedupMap = new Map<string, any>();
      for (const item of payload) {
        const key = `${item.user_id}|${item.cod_rc}|${item.solucao ?? ""}|${item.subsolucao ?? ""}|${item.mes_ano}`;
        const ex = dedupMap.get(key);
        if (ex) {
          ex.meta_faturamento = (ex.meta_faturamento || 0) + (item.meta_faturamento || 0);
          ex.meta_volume = (ex.meta_volume || 0) + (item.meta_volume || 0);
        } else {
          dedupMap.set(key, { ...item });
        }
      }
      const dedupedPayload = Array.from(dedupMap.values());

      let inserted = 0;
      if (dedupedPayload.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < dedupedPayload.length; i += BATCH) {
          const chunk = dedupedPayload.slice(i, i + BATCH);
          const { error } = await supabase.from("metas").upsert(chunk, {
            onConflict: "organizacao_id,cod_rc,linha,mes_ano,solucao,subsolucao",
          });
          if (error) { toast.error(error.message); break; }
          inserted += chunk.length;
        }
        if (inserted > 0) await load();
      }
      setErrorReport({
        fileName: file.name, total: dedupedPayload.length + errors.length,
        inserted, skipped: errors.length, errors, warnings: [],
      });
      if (inserted > 0 && errors.length === 0) toast.success(`${inserted} meta(s) importada(s) (ano ${year})`);
      else if (inserted > 0) toast.warning(`${inserted} importada(s) · ${errors.length} com erro`);
      else toast.error(`Nenhuma linha válida — ${errors.length} erro(s)`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const _orcInner = async (file: File) => {
    if (!user || !orgId) return;
    setImporting(true);
    try {
      const [{ data: reps }, { data: vendaLinhas }] = await Promise.all([
        supabase.from("representantes").select("cod_rc, nome").eq("organizacao_id", orgId),
        supabase.from("vendas").select("linha").eq("organizacao_id", orgId).not("linha", "is", null).limit(5000),
      ]);
      const repByCod = new Map<string, string>();
      (reps ?? []).forEach((r) => { if (r.cod_rc) repByCod.set(String(r.cod_rc).trim(), r.nome); });
      const linhasCanon = new Map<string, string>();
      (vendaLinhas ?? []).forEach((v: any) => {
        if (v.linha) {
          const k = norm(String(v.linha));
          if (!linhasCanon.has(k)) linhasCanon.set(k, String(v.linha).trim());
        }
      });

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetFat = wb.SheetNames.find((n) => /r\$/i.test(n)) ?? wb.SheetNames[0];
      const sheetVol = wb.SheetNames.find((n) => /%/.test(n) && n !== sheetFat);
      const meses = ["JANEIRO","FEVEREIRO","MARCO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
      // Linhas de "total" no arquivo: ANO = "TOTAL" OU não tem SOLUCAO/ESPECIE preenchidos.
      // (DESCRICAO é sempre "TOTAL ORCADO" no export — não serve para filtrar.)

      const parseSheet = (name: string | undefined) => {
        if (!name) return [];
        const ws = wb.Sheets[name];
        return XLSX.utils.sheet_to_json<any>(ws, { defval: "", raw: true });
      };

      const rowsFat = parseSheet(sheetFat);
      const rowsVol = parseSheet(sheetVol);

      const errors: { linha: number; valores: string; motivo: string }[] = [];
      const warnings: { linha: number; valores: string; aviso: string }[] = [];
      const map = new Map<string, any>();
      const ingest = (rows: any[], field: "meta_faturamento" | "meta_volume", origemAba: string) => {
        rows.forEach((r, ri) => {
          const ano = String(r.ANO ?? "").trim();
          if (!/^\d{4}$/.test(ano)) return; // pula a linha "TOTAL" do topo
          const cod_rc = String(r.CODIGO ?? "").trim();
          let linha = String(r.SOLUCAO ?? "").trim();
          const subsolucao = String(r.SUBSOLUCAO ?? "").trim();
          const linhaArq = ri + 2;
          const resumo = `[${origemAba}] cod_rc=${cod_rc || "—"} | linha=${linha || "—"} | sub=${subsolucao || "—"} | ano=${ano}`;
          if (!cod_rc || !linha) {
            // linhas em branco / subtotais: ignora silenciosamente
            return;
          }
          if (!repByCod.has(cod_rc)) {
            errors.push({ linha: linhaArq, valores: resumo, motivo: `cod_rc "${cod_rc}" não cadastrado em Representantes` });
            return;
          }
          const representanteOficial = repByCod.get(cod_rc)!;
          const linhaCanon = linhasCanon.get(norm(linha));
          if (linhaCanon) {
            if (linhaCanon !== linha) warnings.push({ linha: linhaArq, valores: resumo, aviso: `Linha "${linha}" → "${linhaCanon}"` });
            linha = linhaCanon;
          }
          meses.forEach((mNome, idx) => {
            const v = Number(r[mNome] ?? 0) || 0;
            if (!v) return;
            const mes_ano = `${ano}-${String(idx + 1).padStart(2, "0")}`;
            const key = `${cod_rc}|${linha}|${mes_ano}`;
            const cur = map.get(key) ?? {
              organizacao_id: orgId,
              user_id: user.id,
              cod_rc,
              representante: representanteOficial,
              linha,
              mes_ano,
              meta_faturamento: 0,
              meta_volume: 0,
            };
            cur[field] = (cur[field] ?? 0) + v;
            map.set(key, cur);
          });
        });
      };
      ingest(rowsFat, "meta_faturamento", sheetFat ?? "fat");
      ingest(rowsVol, "meta_volume", sheetVol ?? "vol");

      const payload = Array.from(map.values());
      let total = 0;
      if (payload.length > 0) {
        const BATCH = 500;
        for (let i = 0; i < payload.length; i += BATCH) {
          const chunk = payload.slice(i, i + BATCH);
           const { error } = await (supabase.from("metas") as any)
             .upsert(chunk, { onConflict: "organizacao_id,cod_rc,linha,mes_ano,solucao,subsolucao" });
          if (error) throw error;
          total += chunk.length;
        }
        await load();
      }
      setErrorReport({
        fileName: file.name,
        total: rowsFat.length + rowsVol.length,
        inserted: total,
        skipped: errors.length,
        errors,
        warnings,
      });
      if (total > 0 && errors.length === 0) toast.success(`${total} meta(s) importada(s) do orçamento`);
      else if (total > 0) toast.warning(`${total} importada(s) · ${errors.length} erro(s)`);
      else toast.error(`Nenhuma meta válida — ${errors.length} erro(s)`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const rcsComMeta = useMemo(() => {
    const map = new Map<string, string>();
    metas.forEach((m) => {
      if (m.cod_rc) map.set(m.cod_rc, m.representante ?? m.cod_rc);
    });
    return Array.from(map.entries())
      .map(([cod_rc, nome]) => ({ cod_rc, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [metas]);

  const repsAtivos = useMemo(() => {
    return reps
      .filter((r) => r.cod_rc)
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
  }, [reps]);

  const handleTransferir = async () => {
    if (!user || !orgId) return toast.error("Sem organização");
    if (!transfer.origemRc) return toast.error("Escolha o RC de origem");
    if (!transfer.destinoRc) return toast.error("Escolha o RC de destino");
    if (transfer.origemRc === transfer.destinoRc) {
      return toast.error("Origem e destino devem ser representantes diferentes");
    }
    const pct = Number(transfer.percentual);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      return toast.error("Percentual inválido. Informe um valor entre 1 e 100");
    }
    if (transfer.escopo === "mes" && !transfer.mes) return toast.error("Escolha o mês");

    const mesCorrente = new Date().toISOString().slice(0, 7);
    const elegivel = (mes: string) => {
      if (transfer.escopo === "futuros") return mes >= mesCorrente;
      if (transfer.escopo === "mes") return mes === transfer.mes;
      return true; // ano todo
    };

    const origemMetas = metas.filter((m) => m.cod_rc === transfer.origemRc && elegivel(m.mes_ano));
    if (origemMetas.length === 0) return toast.error("Nenhuma meta da origem no escopo selecionado");

    const fator = pct / 100;
    const origemNome = rcsComMeta.find((r) => r.cod_rc === transfer.origemRc)?.nome ?? transfer.origemRc;
    const destinoNome = repsAtivos.find((r) => r.cod_rc === transfer.destinoRc)?.nome ?? transfer.destinoRc;
    const totalFat = origemMetas.reduce((s, m) => s + Number(m.meta_faturamento ?? 0), 0) * fator;
    const totalVol = origemMetas.reduce((s, m) => s + Number(m.meta_volume ?? 0), 0) * fator;
    const escopoLabel =
      transfer.escopo === "futuros" ? `meses futuros (a partir de ${mesCorrente})`
      : transfer.escopo === "mes" ? `mês ${transfer.mes}`
      : "ano inteiro";

    const ok = window.confirm(
      `Confirmar transferência?\n\n` +
      `• Origem: ${origemNome}\n` +
      `• Destino: ${destinoNome}\n` +
      `• Percentual: ${pct}%\n` +
      `• Escopo: ${escopoLabel}\n` +
      `• Metas afetadas: ${origemMetas.length}\n` +
      `• Faturamento a transferir: ${fmtBRL(totalFat)}\n` +
      `• Volume a transferir: ${fmtNum(totalVol)}\n\n` +
      `Esta ação irá subtrair da origem e somar no destino.`
    );
    if (!ok) return;

    setTransferring(true);
    try {
      let atualizadas = 0, criadas = 0, somadas = 0;
      for (const m of origemMetas) {
        const transFat = Math.round((Number(m.meta_faturamento ?? 0) * fator) * 100) / 100;
        const transVol = Math.round((Number(m.meta_volume ?? 0) * fator) * 100) / 100;
        if (transFat === 0 && transVol === 0) continue;

        // 1) Subtrai da origem
        const novoFat = Number(m.meta_faturamento ?? 0) - transFat;
        const novoVol = Number(m.meta_volume ?? 0) - transVol;
        const { error: e1 } = await supabase
          .from("metas")
          .update({ meta_faturamento: novoFat, meta_volume: novoVol })
          .eq("id", m.id);
        if (e1) throw e1;
        atualizadas++;

        // 2) Procura meta equivalente no destino (mesma linha/solucao/subsolucao/mes)
        const existente = metas.find(
          (x) =>
            x.cod_rc === transfer.destinoRc &&
            x.mes_ano === m.mes_ano &&
            (x.linha ?? "") === (m.linha ?? "") &&
            (x.solucao ?? "") === (m.solucao ?? "") &&
            (x.subsolucao ?? "") === (m.subsolucao ?? "")
        );

        if (existente) {
          const { error: e2 } = await supabase
            .from("metas")
            .update({
              meta_faturamento: Number(existente.meta_faturamento ?? 0) + transFat,
              meta_volume: Number(existente.meta_volume ?? 0) + transVol,
            })
            .eq("id", existente.id);
          if (e2) throw e2;
          somadas++;
        } else {
           const { error: e3 } = await (supabase.from("metas") as any).insert({
            organizacao_id: orgId,
            user_id: user.id,
            cod_rc: transfer.destinoRc,
            representante: destinoNome,
            linha: m.linha,
            solucao: m.solucao,
            subsolucao: m.subsolucao,
            mes_ano: m.mes_ano,
            meta_faturamento: transFat,
            meta_volume: transVol,
          });
          if (e3) throw e3;
          criadas++;
        }
      }
      toast.success(
        `Transferência concluída: ${atualizadas} metas reduzidas · ${somadas} somadas no destino · ${criadas} criadas`
      );
      setTransferOpen(false);
      await load();
    } catch (err: any) {
      toast.error("Erro na transferência: " + (err.message ?? String(err)));
    } finally {
      setTransferring(false);
    }
  };

  if (roleLoading) return null;
  if (!isGestor) {
    return (
      <>
        <PageHeader title="Metas" subtitle="Acesso restrito ao gestor" />
        <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-muted-foreground">Apenas usuários com perfil gestor podem cadastrar e visualizar metas.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Metas" description="Cadastro e acompanhamento de metas por representante, linha de produto e mês com importação Excel e transferência entre RCs." path="/metas" />
      <PageHeader
        title="Metas"
        subtitle="Metas por Representante, Linha de Produto e Mês"
      />
      <div className="space-y-4">
        <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleTemplate}>
              <Download className="h-4 w-4 mr-2" /> Baixar modelo Excel
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar planilha
            </Button>
            <input
              ref={inputRefOrc}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleOrcamento(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => inputRefOrc.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
              Importar Orçamento RC (Power BI)
            </Button>
            <input
              ref={inputRefRegional}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRegionalDirect(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => inputRefRegional.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar Regional (FAT x VOL)
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferir Metas
            </Button>
            {errorReport && (
              <Button size="sm" variant="ghost" onClick={() => setErrorReport({ ...errorReport })}>
                <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                Ver último relatório ({errorReport.errors.length} erro{errorReport.errors.length === 1 ? "" : "s"})
              </Button>
            )}
            <p className="text-xs text-muted-foreground ml-auto">
              Reimportar a mesma combinação RC + Linha + Mês <strong>atualiza</strong> a meta.
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Colunas esperadas: <span className="font-mono">cod_rc, representante, linha, mes_ano, meta_faturamento, meta_volume</span>.
            Mês aceita formatos: <span className="font-mono">2026-04</span>, <span className="font-mono">04/2026</span>, <span className="font-mono">abr/2026</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Orçamento RC:</strong> arquivo do Power BI com 2 abas (<span className="font-mono">*_r$</span> = faturamento e <span className="font-mono">*_%</span> = volume kg).
            Importa automaticamente todas as SOLUÇÕES por representante e desdobra os 12 meses do ano.
          </p>
        </div>

        <div className="bg-card rounded-2xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1 flex-1 sm:flex-none">
                <label className="text-xs text-muted-foreground">Filtrar mês</label>
                <Select value={filterMes || "all"} onValueChange={(v) => setFilterMes(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-10 w-full sm:w-[160px]">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {mesesDisponiveis.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {filterMes && (
                  <Button variant="outline" size="sm" onClick={handleDeleteMes} className="flex-1 sm:flex-none h-10 text-xs">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir Mês
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDeleteAll} className="flex-1 sm:flex-none h-10 text-destructive hover:text-destructive text-xs">
                  <Trash2 className="h-4 w-4 mr-2" /> Limpar Tudo
                </Button>
                <Button size="sm" onClick={() => openCreateDialog("", "", filterMes || mesCorrente)} className="flex-1 sm:flex-none h-10 text-xs">
                  <Pencil className="h-4 w-4 mr-2" /> Nova Meta
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-end border-t border-slate-100 dark:border-white/5 pt-3">
              <Badge variant="secondary" className="text-[10px]">Linhas: {filtered.length}</Badge>
              <Badge className="bg-primary text-primary-foreground text-[10px]">
                Fat.: {fmtBRL(totals.fat)}
              </Badge>
              <Badge className="bg-secondary text-secondary-foreground text-[10px]">
                Vol.: {fmtNum(totals.vol)} kg
              </Badge>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden max-h-[520px] overflow-y-auto -mx-1 sm:mx-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px] md:min-w-full">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Cód. RC</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-right">Meta Fat. (R$)</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="text-right">+ Aberto</TableHead>
                  <TableHead className="text-right">% Atg / % Proj</TableHead>
                  <TableHead className="text-right">Meta Vol. (kg)</TableHead>
                  <TableHead className="text-right w-20">Linhas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                ) : grupos.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma meta cadastrada.</TableCell></TableRow>
                ) : (
                  grupos.map((g) => {
                    const isOpen = expanded.has(g.key);
                    const proj = g.realizado_fat + g.aberto_fat;
                    const pctAtg = g.meta_faturamento > 0 ? g.realizado_fat / g.meta_faturamento : 0;
                    const pctProj = g.meta_faturamento > 0 ? proj / g.meta_faturamento : 0;
                    const isAtual = g.mes_ano === mesCorrente;
                    return (
                      <Fragment key={g.key}>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggle(g.key)}>
                          <TableCell>
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{g.mes_ano}</TableCell>
                          <TableCell className="font-mono text-xs">{g.cod_rc}</TableCell>
                          <TableCell className="font-medium">{g.representante ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{fmtBRL(g.meta_faturamento)}</TableCell>
                          <TableCell className="text-right">
                            {g.realizado_fat > 0 ? fmtBRL(g.realizado_fat) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {isAtual && g.aberto_fat > 0 ? fmtBRL(g.aberto_fat) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {g.meta_faturamento > 0 ? (
                              <div className="flex flex-col items-end leading-tight">
                                <span className={pctAtg >= 1 ? "text-primary font-semibold" : ""}>{fmtPct(pctAtg)}</span>
                                {isAtual && g.aberto_fat > 0 && (
                                  <span className={`text-[11px] ${pctProj >= 1 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                                    proj: {fmtPct(pctProj)}
                                  </span>
                                )}
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{fmtNum(g.meta_volume)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {g.itens.length === 0 ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => { e.stopPropagation(); openCreateDialog(g.cod_rc, g.representante, g.mes_ano); }}
                              >
                                + Meta
                              </Button>
                            ) : g.itens.length}
                          </TableCell>
                        </TableRow>
                        {isOpen && g.itens.map((m) => (
                          <TableRow key={m.id} className="bg-muted/20">
                            <TableCell></TableCell>
                            <TableCell colSpan={2} className="pl-8 text-xs text-muted-foreground">
                              ↳ {m.solucao ?? m.linha}
                              {m.subsolucao ? <span className="text-foreground/60"> · {m.subsolucao}</span> : null}
                            </TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-sm">{fmtBRL(Number(m.meta_faturamento ?? 0))}</TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right text-sm">{fmtNum(Number(m.meta_volume ?? 0))}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditDialog(m); }} title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteOne(m); }} title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!editDialog?.open} onOpenChange={(o) => !o && setEditDialog(null)}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 md:p-8 pb-0 text-left">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-primary/5 rounded-[18px]">
                <Pencil className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">{editDialog?.mode === "edit" ? "Editar Meta" : "Nova Meta"}</DialogTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração de Alvo</p>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6 md:p-8 space-y-4 max-h-[70vh] overflow-y-auto border-y border-slate-100 dark:border-white/5 mt-4">
            {editDialog && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Cód. RC *</Label>
                    <Input
                      value={editDialog.cod_rc}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, cod_rc: e.target.value })}
                      disabled={editDialog.mode === "edit"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Mês (YYYY-MM) *</Label>
                    <Input
                      value={editDialog.mes_ano}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, mes_ano: e.target.value })}
                      placeholder="2026-04"
                      disabled={editDialog.mode === "edit"}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Representante</Label>
                  <Input
                    value={editDialog.representante}
                    className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                    onChange={(e) => setEditDialog({ ...editDialog, representante: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Linha</Label>
                    <Input
                      value={editDialog.linha}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, linha: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Solução</Label>
                    <Input
                      value={editDialog.solucao}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, solucao: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Subsolução</Label>
                    <Input
                      value={editDialog.subsolucao}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, subsolucao: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Faturamento (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={editDialog.meta_faturamento}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, meta_faturamento: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Volume (kg)</Label>
                    <Input
                      inputMode="decimal"
                      value={editDialog.meta_volume}
                      className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-transparent px-4 font-semibold"
                      onChange={(e) => setEditDialog({ ...editDialog, meta_volume: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-6 md:p-8 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 bg-slate-50/30 dark:bg-white/[0.02]">
            <Button variant="ghost" onClick={() => setEditDialog(null)} className="rounded-xl h-14 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 order-2 sm:order-1">Cancelar</Button>
            <Button onClick={handleSaveDialog} className="rounded-xl h-14 px-12 font-black uppercase tracking-widest text-[10px] shadow-xl hover:shadow-primary/30 active:scale-95 order-1 sm:order-2">Salvar Meta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!errorReport} onOpenChange={(o) => !o && setErrorReport(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Relatório de importação</DialogTitle>
            <DialogDescription>
              {errorReport?.fileName} — {errorReport?.total} linha(s) lida(s) ·{" "}
              <span className="text-primary font-medium">{errorReport?.inserted} importada(s)</span> ·{" "}
              <span className="text-destructive font-medium">{errorReport?.errors.length} com erro</span>
              {errorReport && errorReport.warnings.length > 0 && (
                <> · <span className="text-foreground font-medium">{errorReport.warnings.length} aviso(s)</span></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-4 pr-2">
            {errorReport && errorReport.errors.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-destructive">Erros (linhas ignoradas)</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorReport.errors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{e.linha}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{e.valores}</TableCell>
                          <TableCell className="text-xs text-destructive">{e.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {errorReport && errorReport.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 text-foreground">Avisos (importadas com correção automática)</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted">
                      <TableRow>
                        <TableHead className="w-16">Linha</TableHead>
                        <TableHead>Valores</TableHead>
                        <TableHead>Aviso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorReport.warnings.slice(0, 200).map((w, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{w.linha}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{w.valores}</TableCell>
                          <TableCell className="text-xs">{w.aviso}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            {errorReport && errorReport.errors.length === 0 && errorReport.warnings.length === 0 && (
              <p className="text-sm text-muted-foreground">Tudo importado sem erros nem ajustes.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-[24px] md:rounded-[32px] p-0 overflow-hidden border-none shadow-premium bg-white dark:bg-slate-950">
          <DialogHeader className="p-6 md:p-8 pb-0 text-left">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-primary/5 rounded-[18px]">
                <ArrowRightLeft className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tightest text-slate-900 dark:text-white uppercase leading-none">Transferir Metas</DialogTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Remanejamento de Equipe</p>
              </div>
            </div>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed">
              Subtrai das metas do RC origem e soma no RC destino.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 md:p-8 space-y-4 max-h-[70vh] overflow-y-auto border-y border-slate-100 dark:border-white/5 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">RC origem (de quem sai)</label>
                <Select value={transfer.origemRc} onValueChange={(v) => setTransfer({ ...transfer, origemRc: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {rcsComMeta.map((r) => (
                      <SelectItem key={r.cod_rc} value={r.cod_rc}>{r.nome} ({r.cod_rc})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">RC destino (para quem vai)</label>
                <Select value={transfer.destinoRc} onValueChange={(v) => setTransfer({ ...transfer, destinoRc: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {repsAtivos.map((r) => (
                      <SelectItem key={r.cod_rc!} value={r.cod_rc!}>{r.nome} ({r.cod_rc})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Percentual a transferir (%)</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={transfer.percentual}
                  onChange={(e) => setTransfer({ ...transfer, percentual: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground">100% = transfere tudo (uso típico para desligamento).</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Escopo</label>
                <Select
                  value={transfer.escopo}
                  onValueChange={(v: any) => setTransfer({ ...transfer, escopo: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="futuros">Meses futuros (a partir de hoje)</SelectItem>
                    <SelectItem value="ano">Ano todo (todas as metas)</SelectItem>
                    <SelectItem value="mes">Mês específico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {transfer.escopo === "mes" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Mês</label>
                <Select value={transfer.mes} onValueChange={(v) => setTransfer({ ...transfer, mes: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
                  <SelectContent>
                    {mesesDisponiveis.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
              💡 A operação <strong>subtrai</strong> da origem e <strong>soma</strong> no destino. Se o destino não tiver meta para a mesma linha/mês, ela é criada automaticamente.
            </div>
          </div>
          <div className="p-6 md:p-8 pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 bg-slate-50/30 dark:bg-white/[0.02]">
            <Button variant="ghost" onClick={() => setTransferOpen(false)} disabled={transferring} className="rounded-xl h-12 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 order-2 sm:order-1">Cancelar</Button>
            <Button onClick={handleTransferir} disabled={transferring} className="rounded-xl h-12 px-10 font-black uppercase tracking-widest text-[10px] shadow-xl hover:shadow-primary/30 active:scale-95 order-1 sm:order-2">
              {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
              Transferir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
