import { useMemo, useRef, useState } from "react";
import * as XLSX from "@e965/xlsx";
import { z, ZodType } from "zod";
import { Upload, Download, CheckCircle2, XCircle, Loader2, RefreshCw, Database, Target } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import VendasImport from "@/components/crm/VendasImport";
import { useEffect } from "react";
import LimparDados from "@/components/crm/LimparDados";

type TableKey = "representantes" | "clientes" | "produtos";

interface ImportConfig {
  table: TableKey;
  label: string;
  /** mapeamento: cabeçalho aceito (lowercased) -> coluna do banco */
  columnMap: Record<string, string>;
  schema: ZodType<any>;
  /** colunas que serão exibidas no template Excel */
  templateHeaders: string[];
  /** colunas válidas no banco (whitelist) */
  dbColumns: string[];
  /** chave usada para detectar duplicidade */
  dedupeKey: (row: Record<string, any>) => string | null;
  dedupeLabel: string;
  /** transformação opcional aplicada à linha bruta da planilha (após o columnMap) */
  preprocess?: (mapped: Record<string, any>, raw: Record<string, any>) => Record<string, any>;
}

const repSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(120),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  regiao: z.string().trim().max(120).optional().or(z.literal("")),
  meta_mensal: z.coerce.number().min(0).optional(),
  status: z.string().trim().max(20).optional().or(z.literal("")),
  cod_rc: z.string().trim().max(20).optional().or(z.literal("")),
});

const cliSchema = z.object({
  codigo: z.string().trim().max(50).optional().or(z.literal("")),
  razao_social: z.string().trim().min(1, "Razão social é obrigatória").max(200),
  cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  telefone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  representante: z.string().trim().max(120).optional().or(z.literal("")),
  segmento: z.string().trim().max(20).optional().or(z.literal("")),
  ultima_compra: z.string().trim().max(10).optional().or(z.literal("")),
  linha_principal: z.string().trim().max(120).optional().or(z.literal("")),
});

const prodSchema = z.object({
  codigo: z.string().trim().min(1, "Código é obrigatório").max(50),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200),
  categoria: z.string().trim().max(120).optional().or(z.literal("")),
  unidade: z.string().trim().max(20).optional().or(z.literal("")),
  preco: z.coerce.number().min(0).optional(),
});

const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const cleanDigits = (s: any) => String(s ?? "").replace(/\D/g, "");
const lc = (s: any) => String(s ?? "").trim().toLowerCase();

const DYNAMICS_HEADERS = new Set([
  "data nf", "data da nf", "data pedido", "data do pedido", "nota fiscal", "pedido",
  "cod produto", "código produto", "nome do produto", "grupo produto", "preco kg", "preço kg",
  "qtde. sacos", "qtde sacos", "faturamento realizado", "faturamento s/ encargos", "mes/ano",
  "cod cfop", "comissao realizada", "comissão realizada", "volume (convertido)",
]);

const isLikelyVendasFile = (headers: string[]) =>
  headers.reduce((score, header) => score + (DYNAMICS_HEADERS.has(norm(header)) ? 1 : 0), 0) >= 4;

/** Excel serial date -> "YYYY-MM-DD" (também aceita Date e strings dd/mm/yyyy) */
const toIsoDate = (v: any): string => {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial (base 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // dd/mm/yyyy ou dd-mm-yyyy (formato BR)
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    let [, a, b, yy] = br;
    let dd = a, mm = b;
    // se o "mês" > 12, assume que veio invertido (mm/dd)
    if (parseInt(mm, 10) > 12 && parseInt(dd, 10) <= 12) {
      [dd, mm] = [mm, dd];
    }
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // YYYY-MM-DD ou YYYY-DD-MM (alguns exports BR exportam o dia antes do mês)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, yyyy, a, b] = iso;
    let mm = a, dd = b;
    // se o "mês" > 12, troca: o segundo grupo é o dia (formato BR YYYY-DD-MM)
    if (parseInt(mm, 10) > 12 && parseInt(dd, 10) <= 12) {
      [mm, dd] = [dd, mm];
    }
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** Pega o 1º e-mail de uma string que pode ter vários separados por ; , ou espaço */
const firstEmail = (v: any): string => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const parts = s.split(/[;,\s]+/).map((p) => p.trim()).filter(Boolean);
  return parts[0] ?? "";
};

/** Gera o modelo padrão de metas (Regional 12 meses) — mesmo formato reconhecido pelo importador. */
const downloadModeloMetas = () => {
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
      if (i < 3) row.push(200000 + i * 10000, 40000 + i * 2000);
      else row.push(0, 0);
    });
  });
  const ws = XLSX.utils.aoa_to_sheet([header1, header2, exemplo1, exemplo2, exemplo3]);
  ws["!merges"] = meses.map((_, i) => ({
    s: { r: 0, c: 4 + i * 2 },
    e: { r: 0, c: 5 + i * 2 },
  }));
  ws["!cols"] = [
    { wch: 10 }, { wch: 32 }, { wch: 22 }, { wch: 22 },
    ...Array(24).fill({ wch: 12 }),
  ];
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
    ["• CODIGO deve existir em Representantes"],
    ["• Chave única: organização + cod_rc + solução + subsolução + mes_ano"],
    ["  → re-importar o mesmo arquivo ATUALIZA, não duplica"],
    ["• Linhas com totais (TOTAL, TOTAIS) e linhas vazias são ignoradas"],
    ["• Valores aceitos em formato BR (1.234,56) ou US (1234.56)"],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(instrucoes);
  wsInfo["!cols"] = [{ wch: 80 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Metas");
  XLSX.utils.book_append_sheet(wb, wsInfo, "Instruções");
  XLSX.writeFile(wb, "modelo_metas_padrao.xlsx");
};

const configs: Record<TableKey, ImportConfig> = {
  representantes: {
    table: "representantes",
    label: "Representantes",
    schema: repSchema,
    templateHeaders: ["cod_rc", "nome", "email", "telefone", "regiao", "meta_mensal", "status"],
    dbColumns: ["cod_rc", "nome", "email", "telefone", "regiao", "meta_mensal", "status"],
    dedupeLabel: "código RC (ou e-mail / nome)",
    dedupeKey: (r) => lc(r.cod_rc) || lc(r.email) || lc(r.nome) || null,
    columnMap: {
      cod_rc: "cod_rc", "cod rc": "cod_rc", "código rc": "cod_rc", "codigo rc": "cod_rc",
      "cod. rc": "cod_rc", rc: "cod_rc", codigo: "cod_rc", "código": "cod_rc",
      cod: "cod_rc", "cod vendedor": "cod_rc", "codigo vendedor": "cod_rc",
      "código vendedor": "cod_rc", "cod representante": "cod_rc",
      "codigo representante": "cod_rc", "código representante": "cod_rc",
      matricula: "cod_rc", matrícula: "cod_rc",
      nome: "nome", "nome completo": "nome",
      representante: "nome", vendedor: "nome", "nome rc": "nome",
      "nome representante": "nome", "nome do representante": "nome",
      "nome vendedor": "nome", "nome do vendedor": "nome",
      email: "email", "e-mail": "email",
      telefone: "telefone", celular: "telefone", fone: "telefone",
      regiao: "regiao", "região": "regiao",
      area: "regiao", "área": "regiao", territorio: "regiao", "território": "regiao",
      filial: "regiao",
      meta_mensal: "meta_mensal", meta: "meta_mensal", "meta mensal": "meta_mensal",
      status: "status", situacao: "status", "situação": "status",
    },
    preprocess: (m) => {
      // cod_rc vira string trim (Excel pode dar número); mantém zeros à esquerda
      if (m.cod_rc !== undefined && m.cod_rc !== "") {
        m.cod_rc = String(m.cod_rc).trim();
      }
      // se nome vier "001370 - CAROLINA PIERONI", separa código e nome
      if (m.nome) {
        const s = String(m.nome).trim();
        const match = s.match(/^(\d{3,})\s*-\s*(.+)$/);
        if (match) {
          if (!m.cod_rc) m.cod_rc = match[1];
          m.nome = match[2].split(" - ")[0].trim();
        }
      }
      if (m.email) m.email = firstEmail(m.email);
      return m;
    },
  },
  clientes: {
    table: "clientes",
    label: "Clientes",
    schema: cliSchema,
    templateHeaders: [
      "Cod. Cliente", "Cliente", "CNPJ", "Municipio", "Estado",
      "DDD", "Telefone", "E-mail", "Segmento", "Linha", "Última compra", "Representante",
    ],
    dbColumns: [
      "codigo", "razao_social", "cnpj", "cidade", "estado", "telefone", "email",
      "representante", "segmento", "linha_principal", "ultima_compra",
    ],
    dedupeLabel: "Código do cliente (ou CNPJ / razão social)",
    dedupeKey: (r) =>
      lc(r.codigo) || cleanDigits(r.cnpj) || lc(r.razao_social) || null,
    columnMap: {
      codigo: "codigo", "cod cliente": "codigo", "cod. cliente": "codigo",
      "codigo cliente": "codigo", "código cliente": "codigo", "cod": "codigo",
      razao_social: "razao_social", "razao social": "razao_social", "razão social": "razao_social",
      cliente: "razao_social", nome: "razao_social",
      "nome cliente": "razao_social", "nome do cliente": "razao_social",
      "razao social cliente": "razao_social", "razão social cliente": "razao_social",
      cnpj: "cnpj", "cnpj/cpf": "cnpj",
      cidade: "cidade", municipio: "cidade", "município": "cidade",
      estado: "estado", uf: "estado",
      telefone: "telefone", celular: "telefone", fone: "telefone",
      ddd: "__ddd",
      email: "email", "e-mail": "email",
      representante: "representante", vendedor: "representante",
      erc: "representante", "rc": "representante", "cod rc": "representante",
      segmento: "segmento", classificacao: "segmento", "classificação": "segmento",
      linha: "linha_principal", "linha de produto": "linha_principal",
      "ultima compra": "ultima_compra", "última compra": "ultima_compra",
      "data ultima compra": "ultima_compra", "data última compra": "ultima_compra",
    },
    preprocess: (m) => {
      // Concatena DDD + Telefone se vier separado
      if (m.__ddd && m.telefone) {
        const ddd = cleanDigits(m.__ddd);
        const tel = cleanDigits(m.telefone);
        m.telefone = ddd ? `(${ddd}) ${tel}` : tel;
      } else if (m.telefone) {
        m.telefone = String(m.telefone).trim();
      }
      delete m.__ddd;
      // Pega só o 1º e-mail (planilha pode ter "a@x.com; b@y.com")
      if (m.email) m.email = firstEmail(m.email);
      // Normaliza UF (2 letras maiúsculas)
      if (m.estado) m.estado = String(m.estado).trim().toUpperCase().slice(0, 2);
      // Converte data Excel/BR para ISO
      if (m.ultima_compra !== undefined) {
        const iso = toIsoDate(m.ultima_compra);
        if (iso) m.ultima_compra = iso;
        else delete m.ultima_compra;
      }
      // Código vira string trim (Excel pode dar número)
      if (m.codigo !== undefined) m.codigo = String(m.codigo).trim();
      // Representante vindo de ERC tipo "001370 - CAROLINA PIERONI - SANTA TEREZA"
      // mantém o nome inteiro mas limita a 120 chars (schema)
      if (m.representante) {
        const s = String(m.representante).trim();
        // se tem padrão "código - nome", pega tudo após o primeiro " - "
        const parts = s.split(" - ");
        m.representante = (parts.length > 1 ? parts.slice(1).join(" - ") : s).slice(0, 120);
      }
      return m;
    },
  },
  produtos: {
    table: "produtos",
    label: "Produtos",
    schema: prodSchema,
    templateHeaders: ["codigo", "nome", "categoria", "unidade", "preco", "preco_medio_venda"],
    dbColumns: ["codigo", "nome", "categoria", "unidade", "preco", "preco_medio_venda"],
    dedupeLabel: "código",
    dedupeKey: (r) => lc(r.codigo) || null,
    columnMap: {
      codigo: "codigo", "código": "codigo", cod: "codigo", sku: "codigo",
      "cod produto": "codigo", "cod.produto": "codigo", "cod. produto": "codigo",
      "codigo produto": "codigo", "código produto": "codigo",
      nome: "nome", produto: "nome", descricao: "nome", "descrição": "nome",
      "desc produto": "nome", "desc. produto": "nome", "descricao produto": "nome", "descrição produto": "nome",
      categoria: "categoria", linha: "categoria",
      grupo: "categoria", "desc grupo": "categoria", "desc. grupo": "categoria",
      "classif prod": "categoria", "classif. prod": "categoria", "classificacao": "categoria", "classificação": "categoria",
      unidade: "unidade", un: "unidade", medida: "unidade",
      moeda: "unidade",
      preco: "preco", "preço": "preco", valor: "preco",
      "preco base": "preco", "preço base": "preco",
      "preco base tab vigente": "preco", "preço base tab vigente": "preco",
      "preco base tab.vigente": "preco", "preço base tab.vigente": "preco",
      "preco vigente": "preco", "preço vigente": "preco",
      "preco_medio_venda": "preco_medio_venda", "preco medio": "preco_medio_venda", "preço médio": "preco_medio_venda",
    },
  },
};

interface RowResult {
  line: number;
  data?: Record<string, any>;
  errors: string[];
  inserted?: boolean;
  duplicate?: "db" | "file" | null;
  dedupeKey?: string | null;
}

const ImportPanel = ({ cfg }: { cfg: ImportConfig }) => {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [results, setResults] = useState<RowResult[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [headerInfo, setHeaderInfo] = useState<{
    recognized: { original: string; dbCol: string }[];
    ignored: string[];
    missingRequired: string[];
  } | null>(null);

  // Revalida prévia atual contra o banco (sem reler arquivo): atualiza duplicatas
  const revalidate = async () => {
    if (!user || results.length === 0) return;
     const { data: existing, error } = await (supabase.from(cfg.table) as any)
       .select("*")
       .eq("organizacao_id", orgId);
    if (error) return;
    const existingKeys = new Set<string>(
      (existing ?? [])
        .map((row: any) => cfg.dedupeKey(row))
        .filter((k: any): k is string => !!k)
    );
    setResults((prev) => {
      const seenInFile = new Set<string>();
      return prev.map((r) => {
        if (r.errors.length > 0 || !r.dedupeKey) return r;
        let duplicate: "db" | "file" | null = null;
        let inserted = r.inserted;
        if (existingKeys.has(r.dedupeKey)) {
          duplicate = "db";
          inserted = true; // já está no banco
        } else if (seenInFile.has(r.dedupeKey)) {
          duplicate = "file";
        } else {
          seenInFile.add(r.dedupeKey);
        }
        return { ...r, duplicate, inserted };
      });
    });
  };

  useEffect(() => {
    const handler = () => {
      console.log("Recarregando prévia de importação...");
      revalidate();
    };
    
    const channel = new BroadcastChannel("importacoes_refresh");
    channel.onmessage = (event) => {
      if (event.data === "refresh") handler();
    };

    window.addEventListener("importacoes:refresh-all", handler);
    
    return () => {
      channel.close();
      window.removeEventListener("importacoes:refresh-all", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length, user?.id, orgId]);

  const stats = useMemo(() => {
    const total = results.length;
    const invalid = results.filter((r) => r.errors.length > 0).length;
    const duplicate = results.filter((r) => r.errors.length === 0 && r.duplicate).length;
    const importable = results.filter((r) => r.errors.length === 0 && !r.duplicate && !r.inserted).length;
    const inserted = results.filter((r) => r.inserted).length;
    return { total, invalid, duplicate, importable, inserted };
  }, [results]);

  const handleTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([cfg.templateHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.label);
    XLSX.writeFile(wb, `modelo_${cfg.table}.xlsx`);
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    setFileName(file.name);
    setParsing(true);
    setResults([]);
    setHeaderInfo(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // 1) Lê tudo como matriz para detectar a linha de cabeçalho real
      const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1, defval: "", raw: true, blankrows: false,
      });
      if (matrix.length === 0) {
        toast.error("Planilha vazia");
        setParsing(false);
        return;
      }
      // Detecta automaticamente a melhor linha de cabeçalho (até as primeiras 15 linhas)
      // = a linha que mais reconhece colunas conhecidas via columnMap
      let bestRow = 0, bestScore = -1;
      const limit = Math.min(matrix.length, 15);
      for (let r = 0; r < limit; r++) {
        const row = matrix[r] ?? [];
        const score = row.reduce((acc: number, h: any) => {
          const key = norm(String(h ?? ""));
          return acc + (key && cfg.columnMap[key] ? 1 : 0);
        }, 0);
        if (score > bestScore) { bestScore = score; bestRow = r; }
      }
      if (bestScore < 1) {
        toast.error("Não consegui identificar o cabeçalho. Verifique se a planilha tem nomes de coluna reconhecíveis.");
        setParsing(false);
        return;
      }
      const headers: string[] = (matrix[bestRow] ?? []).map((h: any) => String(h ?? ""));
      if (isLikelyVendasFile(headers)) {
        setHeaderInfo(null);
        setResults([]);
        toast.error('Esse arquivo parece ser a Dinâmica de vendas. Use a aba "Vendas (Dinâmica)", que já importa vendas e faz auto-cadastro de RCs, clientes e produtos.');
        setParsing(false);
        return;
      }
      const rawRows: any[] = matrix.slice(bestRow + 1)
        .filter((row) => row.some((c: any) => c !== "" && c != null))
        .map((row) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
          return obj;
        });
      if (rawRows.length === 0) {
        toast.error("Nenhuma linha de dados após o cabeçalho");
        setParsing(false);
        return;
      }
      const recognized: { original: string; dbCol: string }[] = [];
      const ignored: string[] = [];
      const recognizedDbCols = new Set<string>();
      for (const h of headers) {
        const dbCol = cfg.columnMap[norm(h)];
        if (dbCol) {
          recognized.push({ original: h, dbCol });
          if (!dbCol.startsWith("__")) recognizedDbCols.add(dbCol);
        } else if (String(h).trim() !== "") {
          ignored.push(h);
        }
      }
      // Campos obrigatórios = chaves do schema Zod sem .isOptional()
      // Compatível com Zod v3 (_def.shape()) e v4 (.shape ou _def.shape como objeto)
      const sAny = cfg.schema as any;
      const rawShape =
        sAny?.shape ??
        (typeof sAny?._def?.shape === "function" ? sAny._def.shape() : sAny?._def?.shape) ??
        {};
      const shape: Record<string, any> = rawShape;
      const requiredFields = Object.entries(shape)
        .filter(([, def]: any) => typeof def?.isOptional === "function" && !def.isOptional())
        .map(([k]) => k);
      // telefone aceita ddd+telefone, então considera reconhecido se veio o __ddd ou telefone
      const effectiveRecognized = new Set(recognizedDbCols);
      const missingRequired = requiredFields.filter((f) => !effectiveRecognized.has(f));
      setHeaderInfo({ recognized, ignored, missingRequired });

      // 1) parse + valida + filtra somente colunas conhecidas (whitelist)
      const parsed: RowResult[] = rawRows.map((raw, idx) => {
        const mapped: Record<string, any> = {};
        const errors: string[] = [];
        for (const [k, v] of Object.entries(raw)) {
          const dbCol = cfg.columnMap[norm(k)];
          if (dbCol) mapped[dbCol] = typeof v === "string" ? v.trim() : v;
        }
        const transformed = cfg.preprocess ? cfg.preprocess(mapped, raw) : mapped;
        const result = cfg.schema.safeParse(transformed);
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push(`${issue.path.join(".") || "campo"}: ${issue.message}`);
          }
        }
        const data = result.success ? result.data : transformed;
        // mantém apenas colunas válidas do banco
        const filtered: Record<string, any> = {};
        for (const col of cfg.dbColumns) {
          if (data[col] !== undefined && data[col] !== "") filtered[col] = data[col];
        }
        const key = cfg.dedupeKey(filtered);
        return { line: idx + bestRow + 2, data: filtered, errors, dedupeKey: key };
      });

      // 2) busca chaves já existentes no banco (toda a organização)
      const { data: existing, error: fetchErr } = await (supabase.from(cfg.table) as any)
        .select("*")
        .eq("organizacao_id", orgId);
      if (fetchErr) {
        toast.error("Erro ao consultar base: " + fetchErr.message);
        setParsing(false);
        return;
      }
      const existingKeys = new Set<string>(
        (existing ?? [])
          .map((row: any) => cfg.dedupeKey(row))
          .filter((k: any): k is string => !!k)
      );

      // 3) marca duplicados (vs banco e dentro do próprio arquivo)
      const seenInFile = new Set<string>();
      for (const r of parsed) {
        if (r.errors.length > 0 || !r.dedupeKey) continue;
        if (existingKeys.has(r.dedupeKey)) {
          r.duplicate = "db";
        } else if (seenInFile.has(r.dedupeKey)) {
          r.duplicate = "file";
        } else {
          seenInFile.add(r.dedupeKey);
        }
      }

      setResults(parsed);
      const dups = parsed.filter((r) => r.duplicate).length;
      toast.success(`${parsed.length} linha(s) processada(s)${dups ? ` · ${dups} duplicada(s) ignorada(s)` : ""}`);
    } catch (e: any) {
      toast.error("Erro ao ler arquivo: " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!user || !orgId) return;
    const importable = results.filter((r) => r.errors.length === 0 && !r.duplicate && !r.inserted);
    if (importable.length === 0) {
      toast.error("Nenhuma linha nova para importar");
      return;
    }
    setImporting(true);
    const payload = importable.map((r) => ({ ...r.data, user_id: user.id, organizacao_id: orgId }));
    // Insere uma a uma para que falhas individuais não derrubem o lote inteiro
    let ok = 0;
    const failed: { line: number; msg: string }[] = [];
    const insertedKeys = new Set<string>();
    for (const r of importable) {
      const row = { ...r.data, user_id: user.id, organizacao_id: orgId };
      const { error } = await (supabase.from(cfg.table) as any).insert(row);
      if (error) {
        failed.push({ line: r.line, msg: error.message });
      } else {
        ok++;
        if (r.dedupeKey) insertedKeys.add(r.dedupeKey);
      }
    }
    if (ok > 0) toast.success(`${ok} ${cfg.label.toLowerCase()} importado(s)`);
    if (failed.length > 0) {
      console.error("Falhas na importação:", failed);
      toast.error(`${failed.length} linha(s) falharam — veja o console (F12) para detalhes`);
    }
    setResults((prev) =>
      prev.map((r) =>
        r.dedupeKey && insertedKeys.has(r.dedupeKey) ? { ...r, inserted: true } : r
      )
    );
    setImporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleTemplate} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 mr-2" /> Modelo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={parsing} className="flex-1 sm:flex-none">
            {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Selecionar
          </Button>
        </div>
        {fileName && <span className="text-xs text-muted-foreground truncate italic px-1">{fileName}</span>}
      </div>

      <p className="text-xs text-muted-foreground">
        Cabeçalhos aceitos (qualquer um destes nomes funciona; acentos e maiúsculas são ignorados):{" "}
        <span className="font-mono">{Object.keys(cfg.columnMap).join(", ")}</span>
      </p>

      {headerInfo && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm">
          <div className="font-medium">Diagnóstico do cabeçalho</div>
          {headerInfo.missingRequired.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2">
              <div className="text-xs font-medium text-destructive mb-1">
                Colunas obrigatórias faltando ({headerInfo.missingRequired.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {headerInfo.missingRequired.map((c) => (
                  <Badge key={c} variant="destructive" className="font-mono text-[10px]">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              Colunas reconhecidas ({headerInfo.recognized.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {headerInfo.recognized.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma</span>
              )}
              {headerInfo.recognized.map((c, i) => (
                <Badge
                  key={i}
                  className="bg-primary/10 text-primary hover:bg-primary/10 font-mono text-[10px]"
                >
                  {c.original} → {c.dbCol.replace(/^__/, "")}
                </Badge>
              ))}
            </div>
          </div>
          {headerInfo.ignored.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Colunas ignoradas ({headerInfo.ignored.length}) — não correspondem a nenhum campo conhecido
              </div>
              <div className="flex flex-wrap gap-1">
                {headerInfo.ignored.map((c) => (
                  <Badge key={c} variant="outline" className="font-mono text-[10px]">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Total: {stats.total}</Badge>
            <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary">
              Novas: {stats.importable}
            </Badge>
            {stats.duplicate > 0 && (
              <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                Duplicadas: {stats.duplicate}
              </Badge>
            )}
            <Badge variant="destructive">Com erro: {stats.invalid}</Badge>
            {stats.inserted > 0 && (
              <Badge className="bg-primary text-primary-foreground">Importadas: {stats.inserted}</Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Duplicidade detectada por: <span className="font-mono">{cfg.dedupeLabel}</span>. Linhas duplicadas (já no
            sistema ou repetidas no arquivo) serão ignoradas.
          </p>

          <div className="flex justify-end">
            <Button onClick={handleImport} disabled={importing || stats.importable === 0}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Importar {stats.importable} linha(s) nova(s)
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden max-h-[420px] overflow-y-auto -mx-1 sm:mx-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px] sm:min-w-full">
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead className="w-16">Linha</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Dados / Erros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.line}>
                    <TableCell className="font-mono text-xs">{r.line}</TableCell>
                    <TableCell>
                      {r.inserted ? (
                        <span className="inline-flex items-center text-xs text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> OK
                        </span>
                      ) : r.errors.length > 0 ? (
                        <span className="inline-flex items-center text-xs text-destructive">
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Erro
                        </span>
                      ) : r.duplicate === "db" ? (
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Já existe
                        </span>
                      ) : r.duplicate === "file" ? (
                        <span className="inline-flex items-center text-xs text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Repetida
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-primary">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Nova
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.errors.length > 0 ? (
                        <ul className="list-disc list-inside text-destructive space-y-0.5">
                          {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      ) : (
                        <span className="text-muted-foreground font-mono break-all">
                          {Object.entries(r.data ?? {}).map(([k, v]) => `${k}=${v}`).join(" · ")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatusBaseAtual = () => {
  const { orgId } = useOrg();
  const [counts, setCounts] = useState<Record<string, number | null>>({
    vendas: null, clientes: null, produtos: null, representantes: null, metas: null,
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refresh = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const tables = ["vendas", "clientes", "produtos", "representantes", "metas"] as const;
      const results = await Promise.all(
        tables.map((t) =>
          (supabase.from(t) as any)
            .select("*", { count: "exact", head: true })
            .eq("organizacao_id", orgId)
        )
      );
      const next: Record<string, number | null> = {};
      tables.forEach((t, i) => {
        next[t] = (results[i] as any).count ?? 0;
      });
      setCounts(next);
      setLastUpdate(new Date());
      toast.success("Contagens atualizadas");
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const labels: Record<string, string> = {
    vendas: "Vendas (Dinâmica)",
    clientes: "Clientes",
    produtos: "Produtos",
    representantes: "Representantes",
    metas: "Metas",
  };

  return (
    <div className="bg-card rounded-2xl p-5 mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Status da base atual</h3>
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              · atualizado às {lastUpdate.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar contagens
          </Button>
          <Button
            size="sm"
            onClick={async () => {
              await refresh();
              window.dispatchEvent(new CustomEvent("importacoes:refresh-all"));
              toast.success("Prévias revalidadas");
            }}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar tudo
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {Object.entries(counts).map(([t, c]) => (
          <div
            key={t}
            className="rounded-lg border border-border bg-muted/30 p-3 text-center"
          >
            <div className="text-xs text-muted-foreground">{labels[t]}</div>
            <div className={`text-2xl font-semibold ${c === 0 ? "text-destructive" : "text-foreground"}`}>
              {c === null ? "—" : c.toLocaleString("pt-BR")}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Se um número estiver em <span className="text-destructive font-medium">vermelho (0)</span>, a importação daquela aba não foi concluída.
        Lembre-se: após selecionar o arquivo, é preciso clicar em <strong>"Importar X linha(s) nova(s)"</strong> para gravar.
      </p>
    </div>
  );
};

const Importacoes = () => {
  const { isGestor, loading: roleLoading } = useRole();

  if (roleLoading) return null;
  if (!isGestor) return <Navigate to="/" replace />;

  return (
    <>
      <Seo title="Importações" description="Carga inicial e atualização de representantes, clientes, produtos e vendas via planilhas Excel ou CSV." path="/importacoes" />
      <PageHeader title="Importações" subtitle="Carga inicial por Excel (.xlsx, .xls, .csv)" />
      <div className="flex justify-end mb-3">
        <LimparDados />
      </div>
      <StatusBaseAtual />
      <div className="bg-card rounded-2xl p-4 sm:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <Tabs defaultValue="representantes">
          <div className="overflow-x-auto -mx-5 px-5 mb-4 scrollbar-none">
            <TabsList className="w-full flex justify-start sm:justify-center lg:justify-start min-w-max h-12 p-1 bg-slate-100/50 dark:bg-white/5 rounded-xl">
              <TabsTrigger value="representantes" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Equipe</TabsTrigger>
              <TabsTrigger value="clientes" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Clientes</TabsTrigger>
              <TabsTrigger value="produtos" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Produtos</TabsTrigger>
              <TabsTrigger value="vendas" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Vendas</TabsTrigger>
              <TabsTrigger value="metas" className="rounded-lg px-4 font-bold text-xs uppercase tracking-wider">Metas</TabsTrigger>
            </TabsList>
          </div>
          <div className="mt-2 sm:mt-4">
            <TabsContent value="representantes"><ImportPanel cfg={configs.representantes} /></TabsContent>
            <TabsContent value="clientes"><ImportPanel cfg={configs.clientes} /></TabsContent>
            <TabsContent value="produtos"><ImportPanel cfg={configs.produtos} /></TabsContent>
            <TabsContent value="vendas"><VendasImport /></TabsContent>
          </div>
          <TabsContent value="metas">
            <div className="flex flex-col items-start gap-4 py-6">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Importar Metas</h3>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                A importação de metas usa um layout específico (CODIGO, REPRESENTANTE, ESPECIE, SUBSOLUCAO, SOLUCAO + colunas mensais JANEIRO a DEZEMBRO).
                Clique no botão abaixo para abrir a tela de Metas, onde está o importador dedicado a esse formato.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/metas">
                    <Upload className="h-4 w-4 mr-2" />
                    Ir para importar Metas
                  </Link>
                </Button>
                <Button variant="outline" onClick={downloadModeloMetas}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar modelo padrão (.xlsx)
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default Importacoes;