import { useRef, useState } from "react";
import * as XLSX from "@e965/xlsx";
import { Upload, Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
 import { useOrg } from "@/hooks/useOrg";
 import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const toIsoDate = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    const [, dd, mm, yy] = br;
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
};

const toMesAno = (iso: string | null) => (iso ? iso.slice(0, 7) : null);

const num = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/[^\d\.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const txt = (v: any) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

/** Normaliza nome para comparação (uppercase + sem acento + espaços compactados) */
const normName = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const onlyDigits = (s: any) => String(s ?? "").replace(/\D/g, "");

/** Busca todas as linhas de uma tabela paginando (PostgREST limita a 1000 por request). */
const fetchAllPaged = async <T,>(
  table: string,
  cols: string,
  orgId: string,
): Promise<T[]> => {
  const PAGE = 1000;
  let from = 0;
  const all: T[] = [];
  // hard cap de segurança: 500k linhas
  for (let i = 0; i < 500; i++) {
    const { data, error } = await supabase
      .from(table as any)
      .select(cols)
      .eq("organizacao_id", orgId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

const shouldUpdateText = (current: any, incoming: any) => {
  const cur = txt(current);
  const next = txt(incoming);
  return !cur && !!next;
};

const shouldUpdateDate = (current: any, incoming: any) => {
  const cur = txt(current);
  const next = txt(incoming);
  return !!next && (!cur || next > cur);
};

/**
 * Auto-cadastro de RCs, Clientes e Produtos a partir das vendas importadas.
 * Não sobrescreve registros existentes — apenas insere novos.
 */
const autoCadastrar = async (
  vendas: any[],
  orgId: string,
  userId: string,
  setProgress: (s: string) => void,
) => {
  const result = {
    rcsNovos: 0,
    rcsAtualizados: 0,
    clientesNovos: 0,
    clientesAtualizados: 0,
    produtosNovos: 0,
    produtosAtualizados: 0,
    conflitos: [] as string[],
  };

  // ---------- REPRESENTANTES ----------
  setProgress("Auto-cadastro: representantes…");
  const rcMap = new Map<string, { cod_rc: string | null; nome: string }>();
  for (const v of vendas) {
    const cod = txt(v.cod_rc);
    const nome = txt(v.representante);
    if (!cod && !nome) continue;
    const key = cod ?? `__NOME__${normName(nome)}`;
    if (!rcMap.has(key)) rcMap.set(key, { cod_rc: cod, nome: nome ?? cod ?? "" });
  }
  if (rcMap.size > 0) {
    const existRcs = await fetchAllPaged<{ id: string; cod_rc: string | null; nome: string; regiao: string | null }>(
      "representantes",
      "id, cod_rc, nome, regiao",
      orgId,
    );
    const existByCode = new Map((existRcs ?? []).filter((r) => r.cod_rc).map((r) => [r.cod_rc as string, r]));
    const existByName = new Map((existRcs ?? []).map((r) => [normName(r.nome), r]));
    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    for (const r of rcMap.values()) {
      const existing = (r.cod_rc ? existByCode.get(r.cod_rc) : undefined) ?? existByName.get(normName(r.nome));
      if (existing) {
        const patch: Record<string, any> = { id: existing.id };
        if (shouldUpdateText(existing.cod_rc, r.cod_rc)) patch.cod_rc = r.cod_rc;
        if (shouldUpdateText(existing.nome, r.nome)) patch.nome = r.nome;
        if (Object.keys(patch).length > 1) toUpdate.push(patch);
        continue;
      }
      toInsert.push({
        organizacao_id: orgId,
        user_id: userId,
        cod_rc: r.cod_rc,
        nome: r.nome || r.cod_rc || "(sem nome)",
        status: "ativo",
      });
    }
    if (toInsert.length) {
      const { data, error } = await supabase
        .from("representantes")
        .insert(toInsert)
        .select("id");
      if (error) result.conflitos.push(`RCs: ${error.message}`);
      else result.rcsNovos = data?.length ?? 0;
    }
    for (const item of toUpdate) {
      const { id, ...patch } = item;
      const { error } = await supabase.from("representantes").update(patch).eq("id", id);
      if (error) result.conflitos.push(`RC ${id}: ${error.message}`);
      else result.rcsAtualizados += 1;
    }
  }

  // ---------- CLIENTES ----------
  setProgress("Auto-cadastro: clientes…");
  const cliMap = new Map<string, any>();
  for (const v of vendas) {
    const cod = txt(v.cod_cliente);
    const nome = txt(v.nome_cliente);
    if (!cod && !nome) continue;
    const key = cod ?? `__NOME__${normName(nome)}|${normName(v.municipio)}`;
    if (!cliMap.has(key)) {
      cliMap.set(key, {
        codigo: cod,
        razao_social: nome ?? cod ?? "(sem nome)",
        cidade: txt(v.municipio),
        estado: txt(v.uf),
        segmento: txt(v.segmentacao),
        linha_principal: txt(v.linha),
        representante: txt(v.representante),
        ultima_compra: v.data_nf ?? null,
      });
    } else {
      // mantém o mais recente como ultima_compra
      const prev = cliMap.get(key);
      if (v.data_nf && (!prev.ultima_compra || v.data_nf > prev.ultima_compra)) {
        prev.ultima_compra = v.data_nf;
      }
    }
  }
  if (cliMap.size > 0) {
    const existCli = await fetchAllPaged<{
      id: string;
      codigo: string | null;
      razao_social: string;
      cidade: string | null;
      estado: string | null;
      segmento: string | null;
      linha_principal: string | null;
      representante: string | null;
      ultima_compra: string | null;
    }>(
      "clientes",
      "id, codigo, razao_social, cidade, estado, segmento, linha_principal, representante, ultima_compra",
      orgId,
    );
    const existByCode = new Map((existCli ?? []).filter((c) => c.codigo).map((c) => [c.codigo as string, c]));
    const existByName = new Map((existCli ?? []).map((c) => [`${normName(c.razao_social)}|${normName(c.cidade)}`, c]));
    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    for (const c of cliMap.values()) {
      const existing = (c.codigo ? existByCode.get(c.codigo) : undefined) ?? existByName.get(`${normName(c.razao_social)}|${normName(c.cidade)}`);
      if (existing) {
        const patch: Record<string, any> = { id: existing.id };
        if (shouldUpdateText(existing.codigo, c.codigo)) patch.codigo = c.codigo;
        if (shouldUpdateText(existing.estado, c.estado)) patch.estado = c.estado;
        if (shouldUpdateText(existing.segmento, c.segmento)) patch.segmento = c.segmento;
        if (shouldUpdateText(existing.linha_principal, c.linha_principal)) patch.linha_principal = c.linha_principal;
        if (shouldUpdateText(existing.representante, c.representante)) patch.representante = c.representante;
        if (shouldUpdateDate(existing.ultima_compra, c.ultima_compra)) patch.ultima_compra = c.ultima_compra;
        if (Object.keys(patch).length > 1) toUpdate.push(patch);
        continue;
      }
      toInsert.push({
        organizacao_id: orgId,
        user_id: userId,
        ...c,
      });
    }
    if (toInsert.length) {
      // Insere em lotes para evitar payload gigante
      const BATCH = 500;
      let total = 0;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const chunk = toInsert.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("clientes")
          .insert(chunk)
          .select("id");
        if (error) {
          result.conflitos.push(`Clientes lote ${i / BATCH + 1}: ${error.message}`);
          continue;
        }
        total += data?.length ?? 0;
      }
      result.clientesNovos = total;
    }
    for (const item of toUpdate) {
      const { id, ...patch } = item;
      const { error } = await supabase.from("clientes").update(patch).eq("id", id);
      if (error) result.conflitos.push(`Cliente ${id}: ${error.message}`);
      else result.clientesAtualizados += 1;
    }
  }

  // ---------- PRODUTOS ----------
  setProgress("Auto-cadastro: produtos…");
  const prodMap = new Map<string, any>();
  for (const v of vendas) {
    const cod = txt(v.cod_produto);
    const nome = txt(v.nome_produto);
    if (!cod && !nome) continue;
    const key = cod ?? `__NOME__${normName(nome)}`;
    
    // Calcula o preço médio desta venda específica para atualizar se o produto não tiver preço
    const faturamento = num(v.faturamento_realizado) || 0;
    const volume = num(v.volume_kg) || 0;
    const precoMedioVenda = volume > 0 ? faturamento / volume : null;

    if (!prodMap.has(key)) {
      prodMap.set(key, {
        codigo: cod ?? `AUTO-${normName(nome).slice(0, 40)}`,
        nome: nome ?? cod ?? "(sem nome)",
        categoria: txt(v.grupo_produto) ?? txt(v.linha),
        preco: typeof v.preco_kg === "number" ? v.preco_kg : (precoMedioVenda || null),
        preco_medio_venda: precoMedioVenda,
      });
    } else {
      // Se já existe no mapa desta importação, podemos opcionalmente atualizar se o preço for nulo
      const prev = prodMap.get(key);
      if (prev.preco == null && precoMedioVenda != null) prev.preco = precoMedioVenda;
      if (prev.preco_medio_venda == null && precoMedioVenda != null) prev.preco_medio_venda = precoMedioVenda;
    }
  }
  if (prodMap.size > 0) {
    const existProd = await fetchAllPaged<{ id: string; codigo: string | null; nome: string; categoria: string | null; preco: number | null; preco_medio_venda: number | null }>(
      "produtos",
      "id, codigo, nome, categoria, preco, preco_medio_venda",
      orgId,
    );
    const existByCode = new Map((existProd ?? []).filter((p) => p.codigo).map((p) => [p.codigo as string, p]));
    const existByName = new Map((existProd ?? []).map((p) => [normName(p.nome), p]));
    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    for (const p of prodMap.values()) {
      const existing = (p.codigo ? existByCode.get(p.codigo) : undefined) ?? existByName.get(normName(p.nome));
      if (existing) {
        const patch: Record<string, any> = { id: existing.id };
        if (shouldUpdateText(existing.categoria, p.categoria)) patch.categoria = p.categoria;
        if ((existing.preco == null || existing.preco === 0) && typeof p.preco === "number") patch.preco = p.preco;
        if ((existing.preco_medio_venda == null || existing.preco_medio_venda === 0) && typeof p.preco_medio_venda === "number") patch.preco_medio_venda = p.preco_medio_venda;
        if (Object.keys(patch).length > 1) toUpdate.push(patch);
        continue;
      }
      toInsert.push({
        organizacao_id: orgId,
        user_id: userId,
        ...p,
      });
    }
    if (toInsert.length) {
      const BATCH = 500;
      let total = 0;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const chunk = toInsert.slice(i, i + BATCH);
        const { data, error } = await supabase
          .from("produtos")
          .insert(chunk)
          .select("id");
        if (error) {
          result.conflitos.push(`Produtos lote ${i / BATCH + 1}: ${error.message}`);
          continue;
        }
        total += data?.length ?? 0;
      }
      result.produtosNovos = total;
    }
    for (const item of toUpdate) {
      const { id, ...patch } = item;
      const { error } = await supabase.from("produtos").update(patch).eq("id", id);
      if (error) result.conflitos.push(`Produto ${id}: ${error.message}`);
      else result.produtosAtualizados += 1;
    }
  }

  // Log resumido para depurar (visível no console do navegador)
  console.info("[auto-cadastro] resultado:", result);

  return result;
};

/** Mapeamento cabeçalho normalizado -> coluna do banco */
const COL_MAP: Record<string, string> = {
  "mes": "mes",
  "data nf": "data_nf", "data nota": "data_nf",
  "data da nf": "data_nf", "data da nota": "data_nf",
  "data pedido": "data_pedido",
  "data do pedido": "data_pedido",
  "nota fiscal": "nota_fiscal", "nf": "nota_fiscal", "n nf": "nota_fiscal",
  "pedido": "pedido", "n pedido": "pedido",
  "tipo operacao": "tipo_operacao", "tipo operação": "tipo_operacao", "tipo de operacao": "tipo_operacao",
  "tipo de operação": "tipo_operacao",
  "filial": "filial",
  "cod filial": "cod_filial", "cod. filial": "cod_filial",
  "cód filial": "cod_filial", "cód. filial": "cod_filial",
  "cod cfop": "cod_cfop", "cfop": "cod_cfop",
  "moeda": "moeda",
  "mes ano": "mes_ano", "mês/ano": "mes_ano", "mes/ano": "mes_ano",
  "fl vef": "fl_vef",
  "cod grupo": "cod_grupo", "cód grupo": "cod_grupo", "cód. grupo": "cod_grupo",
  "grupo cliente": "grupo_cliente", "grupo de cliente": "grupo_cliente",
  "cod cliente": "cod_cliente", "cód. cliente": "cod_cliente", "cod. cliente": "cod_cliente", "código cliente": "cod_cliente",
  "cliente": "nome_cliente", "nome cliente": "nome_cliente", "nome do cliente": "nome_cliente",
  "segmentacao": "segmentacao", "segmentação": "segmentacao", "segmento": "segmentacao",
  "categoria": "categoria",
  "municipio": "municipio", "município": "municipio", "cidade": "municipio",
  "uf": "uf", "estado": "uf",
  "regiao": "regiao", "região": "regiao",
  "cod produto": "cod_produto", "cód. produto": "cod_produto", "cod. produto": "cod_produto", "código produto": "cod_produto",
  "produto": "nome_produto", "nome produto": "nome_produto", "descricao produto": "nome_produto",
  "nome do produto": "nome_produto", "desc produto": "nome_produto", "desc. produto": "nome_produto",
  "cod grupo produto": "cod_grupo_produto", "cód. grupo produto": "cod_grupo_produto",
  "grupo produto": "grupo_produto", "grupo de produto": "grupo_produto",
  "linha": "linha",
  "solucao": "solucao", "solução": "solucao",
  "subsolucao": "subsolucao", "subsolução": "subsolucao", "sub solucao": "subsolucao",
  "customizado": "customizado",
  "cod rc": "cod_rc", "cód. rc": "cod_rc", "cod. rc": "cod_rc", "rc": "cod_rc",
  "representante": "representante", "vendedor": "representante", "nome rc": "representante",
  "qtde sacos": "qtde_sacos", "qtd sacos": "qtde_sacos", "quantidade sacos": "qtde_sacos",
  "preco saco": "preco_saco", "preço saco": "preco_saco",
  "preco kg": "preco_kg", "preço kg": "preco_kg",
  "pmr": "pmr",
  "desconto": "desconto_pct", "desconto %": "desconto_pct", "desconto pct": "desconto_pct", "% desconto": "desconto_pct",
   "volume kg": "volume_kg", "volume": "volume_kg", "kg": "volume_kg", "peso": "volume_kg",
  "volume (vendas + bon.)": "volume_kg", "volume vendas + bon.": "volume_kg",
  "volume vendas + bon": "volume_kg", "volume (vendas + bon)": "volume_kg",
  "volume convertido": "volume_convertido",
  "volume (convertido)": "volume_convertido",
  "bonificacao": "bonificacao", "bonificação": "bonificacao",
   "faturamento realizado": "faturamento_realizado", "faturamento": "faturamento_realizado", "valor": "faturamento_realizado", "total": "faturamento_realizado",
  "faturamento sem encargos": "faturamento_sem_encargos", "fat sem encargos": "faturamento_sem_encargos",
  "faturamento s/ encargos": "faturamento_sem_encargos",
  "mb cb %": "mb_cb_pct", "mb %": "mb_cb_pct", "mb cb pct": "mb_cb_pct",
  "mg bruta %": "mb_cb_pct", "margem bruta %": "mb_cb_pct", "mg bruta pct": "mb_cb_pct",
  "mb cb": "mb_cb_total", "mb cb total": "mb_cb_total", "mb r$": "mb_cb_total", "margem bruta": "mb_cb_total",
  "mg bruta": "mb_cb_total", "mg bruta nominal": "mb_cb_total", "margem bruta nominal": "mb_cb_total", "mg bruta r$": "mb_cb_total",
  "ml cb %": "ml_cb_pct", "ml %": "ml_cb_pct", "ml cb pct": "ml_cb_pct",
  "ml cb % (estimada)": "ml_cb_pct",
  "mg liquida %": "ml_cb_pct", "mg líquida %": "ml_cb_pct", "margem liquida %": "ml_cb_pct", "margem líquida %": "ml_cb_pct",
  "ml cb": "ml_cb_total", "ml cb total": "ml_cb_total", "ml r$": "ml_cb_total", "margem liquida": "ml_cb_total", "margem líquida": "ml_cb_total",
  "ml cb total (estimada)": "ml_cb_total",
  "mg liquida": "ml_cb_total", "mg líquida": "ml_cb_total",
  "mg liquida nominal": "ml_cb_total", "mg líquida nominal": "ml_cb_total",
  "margem liquida nominal": "ml_cb_total", "margem líquida nominal": "ml_cb_total",
  "mg liquida r$": "ml_cb_total", "mg líquida r$": "ml_cb_total",
  "icms": "icms_total", "icms total": "icms_total",
  "pis": "pis_total", "pis total": "pis_total",
  "cofins": "cofins_total", "cofins total": "cofins_total",
  "custo brill": "custo_brill_total", "custo brill total": "custo_brill_total", "custo": "custo_brill_total",
  "desp comercial": "desp_comercial", "despesa comercial": "desp_comercial",
  "frete": "frete_carga", "frete carga": "frete_carga", "frete carga realizado": "frete_carga",
  "comissao": "comissao_realizada", "comissão": "comissao_realizada", "comissao realizada": "comissao_realizada",
  "comissao realizado": "comissao_realizada", "comissão realizado": "comissao_realizada",
  "comissao %": "comissao_pct", "comissão %": "comissao_pct", "comissao pct": "comissao_pct",
  "comissao realizado %": "comissao_pct", "comissão realizado %": "comissao_pct",
};

const NUMERIC_COLS = new Set([
  "qtde_sacos", "preco_saco", "preco_kg", "pmr", "desconto_pct",
  "volume_kg", "volume_convertido", "bonificacao",
  "faturamento_realizado", "faturamento_sem_encargos",
  "mb_cb_pct", "mb_cb_total", "ml_cb_pct", "ml_cb_total",
  "icms_total", "pis_total", "cofins_total",
  "custo_brill_total", "desp_comercial", "frete_carga",
  "comissao_pct", "comissao_realizada",
]);
const DATE_COLS = new Set(["data_nf", "data_pedido"]);

/** Detecta a linha de cabeçalho dentro das primeiras N linhas: a que mais reconhece colunas */
const detectHeaderRow = (rows: any[][], maxScan = 15): number => {
  let bestRow = 0, bestScore = 0;
  const limit = Math.min(rows.length, maxScan);
  for (let r = 0; r < limit; r++) {
    const score = (rows[r] ?? []).reduce((acc: number, h: any) => {
      const key = norm(String(h ?? ""));
      return acc + (key && COL_MAP[key] ? 1 : 0);
    }, 0);
    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  return bestScore >= 5 ? bestRow : -1;
};

   const VendasImport = () => {
     const { user } = useAuth();
     const { isGestor, loading: roleLoading } = useRole();
     const { orgId } = useOrg();
     const queryClient = useQueryClient();
     const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [autoCadastro, setAutoCadastro] = useState(true);

  const handleFile = async (file: File) => {
    if (!user || !orgId) return;
    setBusy(true);
    setProgress("Lendo arquivo…");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      // Procura aba "Base de Dados" ou pega a primeira
      const sheetName =
        wb.SheetNames.find((n) => norm(n).includes("base")) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const allRows: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        raw: true,
      });
      const headerRow = detectHeaderRow(allRows);
      if (headerRow < 0 || allRows.length < headerRow + 2) {
        toast.error('Cabeçalho não reconhecido. Verifique se a aba é a "Base de Dados" da Dinâmica.');
        return;
      }
      const headers = (allRows[headerRow] as any[]).map((h) => String(h ?? ""));
      const dataRows = allRows.slice(headerRow + 1);

      // Mapeia índices das colunas conhecidas
      const colIdx: Record<string, number> = {};
      headers.forEach((h, i) => {
        const dest = COL_MAP[norm(h)];
        if (dest) colIdx[dest] = i;
      });

      const knownCount = Object.keys(colIdx).length;
      if (knownCount < 5) {
        toast.error(
          `Cabeçalho com poucas colunas reconhecidas (linha ${headerRow + 1}, ${knownCount} colunas). Verifique se a aba é a "Base de Dados".`
        );
        return;
      }

      setProgress(`Processando ${dataRows.length.toLocaleString("pt-BR")} linhas…`);

      const seen = new Set<string>();
      const payload: any[] = [];
      for (const row of dataRows) {
        if (!row || row.every((c) => c === "" || c == null)) continue;
        const obj: any = { user_id: user.id, organizacao_id: orgId };
        for (const [col, idx] of Object.entries(colIdx)) {
          const v = row[idx];
          if (v === "" || v == null) continue;
          if (DATE_COLS.has(col)) obj[col] = toIsoDate(v);
          else if (NUMERIC_COLS.has(col)) obj[col] = num(v);
          else obj[col] = txt(v);
        }
        // mes_ano: SEMPRE derivar de data_nf (a coluna "Mês/Ano" da Dinâmica
        // vem com conteúdo trocado em algumas planilhas — nome do gerente etc.)
        if (obj.data_nf) obj.mes_ano = toMesAno(obj.data_nf);
        // Se mes_ano veio como string sem padrão YYYY-MM, descarta
        if (obj.mes_ano && !/^\d{4}-\d{2}$/.test(obj.mes_ano)) {
          obj.mes_ano = obj.data_nf ? toMesAno(obj.data_nf) : null;
        }
        // Chave dedup: NF + cod_produto + cod_cliente
        const key = `${obj.nota_fiscal ?? ""}|${obj.cod_produto ?? ""}|${obj.cod_cliente ?? ""}`;
        if (key === "||") continue;
        if (seen.has(key)) continue;
        seen.add(key);
        payload.push(obj);
      }

      if (payload.length === 0) {
        toast.error("Nenhuma linha válida encontrada.");
        return;
      }

      if (
        !confirm(
          `Importar ${payload.length.toLocaleString(
            "pt-BR"
          )} linhas? Linhas com a mesma Nota Fiscal + Produto + Cliente serão atualizadas (sem duplicar). Continuar?`
        )
      ) {
        return;
      }

      // Log de uma amostra do payload para debug
      console.info("[vendas-import] amostra do payload (1ª linha):", payload[0]);
      console.info(
        "[vendas-import] colunas detectadas:",
        Object.keys(colIdx),
      );

      // Upsert em lotes — idempotente por (organizacao_id, nota_fiscal, cod_produto, cod_cliente)
      const BATCH = 500;
      let processed = 0;
      const errosLote: string[] = [];
      for (let i = 0; i < payload.length; i += BATCH) {
        const chunk = payload.slice(i, i + BATCH);
        setProgress(`Importando ${i + chunk.length} / ${payload.length}…`);
     const { error, data } = await (supabase.from("vendas") as any)
       .upsert(chunk, {
         onConflict: "organizacao_id,nota_fiscal,cod_produto,cod_cliente",
         ignoreDuplicates: false,
       })
       .select("id");
        if (error) {
          console.error(
            `[vendas-import] erro lote ${i / BATCH + 1}:`,
            error,
            "primeira linha do lote:",
            chunk[0],
          );
          errosLote.push(`Lote ${i / BATCH + 1}: ${error.message}`);
          continue; // não aborta — segue tentando os próximos lotes
        }
        processed += data?.length ?? chunk.length;
      }

      if (processed === 0) {
        toast.error(
          `Nenhuma linha importada. ${errosLote[0] ?? "Verifique o console (F12) para detalhes."}`,
          { duration: 10000 },
        );
        return;
      }
      toast.success(
        `${processed.toLocaleString("pt-BR")} linhas processadas (novas inseridas + existentes atualizadas, sem duplicar).` +
          (errosLote.length ? ` ${errosLote.length} lote(s) com erro — ver console.` : ""),
      );
      if (errosLote.length) {
        toast.warning(errosLote.slice(0, 3).join(" | "), { duration: 10000 });
      }

      // Auto-cadastro de RCs, Clientes e Produtos
      if (autoCadastro) {
        try {
          const r = await autoCadastrar(payload, orgId, user.id, setProgress);
          const partes: string[] = [];
          if (r.rcsNovos) partes.push(`${r.rcsNovos} RC(s)`);
          if (r.rcsAtualizados) partes.push(`${r.rcsAtualizados} RC(s) atualizados`);
          if (r.clientesNovos) partes.push(`${r.clientesNovos} cliente(s)`);
          if (r.clientesAtualizados) partes.push(`${r.clientesAtualizados} cliente(s) atualizados`);
          if (r.produtosNovos) partes.push(`${r.produtosNovos} produto(s)`);
          if (r.produtosAtualizados) partes.push(`${r.produtosAtualizados} produto(s) atualizados`);
          if (partes.length) toast.success(`Auto-cadastro: ${partes.join(", ")} novo(s).`);
          else toast.info("Auto-cadastro: nada novo (todos já existiam).");
          if (r.conflitos.length) toast.warning(r.conflitos.join(" | "));
        } catch (e: any) {
          toast.error("Auto-cadastro falhou: " + e.message);
        }
      }

      const channel = new BroadcastChannel("importacoes_refresh");
      channel.postMessage("refresh");
      channel.close();
       window.dispatchEvent(new Event("importacoes:refresh-all"));
       queryClient.invalidateQueries({ queryKey: ["metas"] });
       queryClient.invalidateQueries({ queryKey: ["crm-kpis"] });
      setProgress("");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (roleLoading) return null;
  if (!isGestor) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Importação de vendas é restrita ao perfil <strong>gestor</strong>.
        </p>
      </div>
    );
  }

  const downloadHints = () => {
    const sample = [["mes", "data_nf", "nota_fiscal", "cod_cliente", "cliente", "cod_produto", "produto", "linha", "cod_rc", "representante", "volume_kg", "faturamento_realizado", "mb_cb_total", "ml_cb_total"]];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base de Dados");
    XLSX.writeFile(wb, "modelo_vendas.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p><strong>Formato esperado:</strong> a aba <span className="font-mono">Base de Dados</span> com cabeçalho na <strong>linha 7</strong> (formato da Dinâmica do Power BI).</p>
        <p><strong>Estratégia:</strong> <strong>upsert seguro</strong> — pode reimportar quantas vezes quiser. Linhas com a mesma <strong>Nota Fiscal + Cód. Produto + Cód. Cliente</strong> são atualizadas; linhas novas são inseridas. Duplicatas são bloqueadas pelo banco.</p>
      </div>
      <label className="flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 cursor-pointer hover:bg-white dark:hover:bg-white/[0.08] transition-all">
        <Checkbox
          checked={autoCadastro}
          onCheckedChange={(v) => setAutoCadastro(!!v)}
          className="mt-0.5"
        />
        <div className="text-sm">
          <div className="font-medium">Cadastrar automaticamente RCs, Clientes e Produtos novos</div>
          <div className="text-xs text-muted-foreground">
            Após importar vendas, identifica registros novos pelos códigos (cod_rc, cod_cliente, cod_produto) e cria os que ainda não existem. Não sobrescreve dados existentes.
          </div>
        </div>
      </label>
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={downloadHints} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-2" /> Modelo
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
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy} className="flex-1 sm:flex-none">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar (.xlsx)
          </Button>
        </div>
        {progress && (
          <div className="w-full sm:w-auto">
            <Badge variant="secondary" className="w-full sm:w-auto justify-center py-1.5">{progress}</Badge>
          </div>
        )}
      </div>
    </div>
  );
};

export default VendasImport;