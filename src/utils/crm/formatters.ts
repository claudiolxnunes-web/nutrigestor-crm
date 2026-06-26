export const norm = (s: string) =>
  s.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const fmtBRL = (n: number | null | undefined, dec = 2) => {
  if (n == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { 
    style: "currency", 
    currency: "BRL",
    minimumFractionDigits: dec,
    maximumFractionDigits: dec 
  }).format(n);
};

export const fmtNum = (n: number | null | undefined, dec = 0) => {
  if (n == null) return "0";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
};

export const fmtPct = (n: number | null | undefined) => {
  if (n == null) return "0,0%";
  const value = typeof n === "number" ? n : Number(n);
  // Se o valor for menor que 2 (ex: 0.441 ou 44.1/100), tratamos como decimal (0 a 1)
  // Caso contrário, tratamos como percentual inteiro (ex: 44.1)
  const normalized = value > 2 ? value / 100 : value;
  
  return new Intl.NumberFormat("pt-BR", { 
    style: "percent", 
    minimumFractionDigits: 1, 
    maximumFractionDigits: 1 
  }).format(normalized);
};

export const toMesAno = (iso: string | null) => (iso ? iso.slice(0, 7) : null);

export const fmtMoneyAbbr = (n: number) => {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${Math.round(n / 1_000)}K`;
  return `R$ ${n.toFixed(0)}`;
};

 export const formatCell = (value: any, format?: "date" | "currency" | "number") => {
  if (value == null || value === "") return "—";
   if (format === "currency") return fmtBRL(Number(value));
   if (format === "number") return fmtNum(Number(value), 2);
  if (format === "date") {
    const s = String(value);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${d.getFullYear()}`;
    }
  }
  return String(value);
};
