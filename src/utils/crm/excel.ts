import { norm } from "./formatters";

/** Detecta a linha de cabeçalho dentro das primeiras N linhas: a que mais reconhece colunas */
export const detectHeaderRow = (rows: any[][], colMap: Record<string, string>, maxScan = 15): number => {
  let bestRow = 0, bestScore = 0;
  const limit = Math.min(rows.length, maxScan);
  for (let r = 0; r < limit; r++) {
    const score = (rows[r] ?? []).reduce((acc: number, h: any) => {
      const key = norm(String(h ?? ""));
      return acc + (key && colMap[key] ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestScore >= 5 ? bestRow : -1;
};

export const toIsoDate = (v: any): string | null => {
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

export const parseExcelNumber = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/[^\d\.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

export const detectRegional12Layout = (aoa: any[][]): boolean => {
  if (aoa.length < 5) return false;
  // Heurística simplificada baseada no que foi visto nos arquivos
  const firstRow = aoa[0] ?? [];
  return firstRow.some(c => norm(String(c)).includes("jan")) && 
         firstRow.some(c => norm(String(c)).includes("dez"));
};

export const parsePlanNumber = (v: any): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/[^\d\.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
