import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export const BentoGrid = ({ children, className }: BentoGridProps) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4", className)}>
      {children}
    </div>
  );
};

interface BentoCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const BentoCard = ({ title, subtitle, children, className, icon }: BentoCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "premium-card overflow-hidden flex flex-col h-full",
        className
      )}
    >
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-0.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">{subtitle}</p>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
          </div>
          {icon && <div className="p-2 bg-primary/5 rounded-lg text-primary">{icon}</div>}
        </div>
        <div className="flex-1">
          {children}
        </div>
      </div>
    </motion.div>
  );
};
