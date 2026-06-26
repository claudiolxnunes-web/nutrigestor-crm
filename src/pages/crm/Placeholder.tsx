import { PageHeader } from "@/components/layout/AppLayout";

const Placeholder = ({ title, subtitle, description }: { title: string; subtitle: string; description: string }) => (
  <>
    <PageHeader title={title} subtitle={subtitle} />
    <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-card)" }}>
      <h3 className="text-primary font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </>
);

export default Placeholder;