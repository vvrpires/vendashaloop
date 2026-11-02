import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const field =
  "h-11 w-full rounded border border-line bg-form px-3 text-ink outline-none transition-[border-color] duration-150 focus:border-accent";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded border border-line bg-form px-3 py-2 text-ink outline-none focus:border-accent ${props.className ?? ""}`}
    />
  );
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${field} ${props.className ?? ""}`} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const look = {
    primary: "border border-accent bg-accent text-accent-fg hover:opacity-90",
    quiet: "border border-line bg-transparent text-ink hover:border-accent hover:text-accent",
    danger: "border border-danger bg-danger text-white hover:opacity-90",
    ghost: "border border-transparent text-ink hover:text-accent",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold transition-opacity duration-150 disabled:opacity-50 ${look} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-4 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

const badges: Record<string, string> = {
  pendente: "bg-[#3d2e12] text-warn",
  aprovado: "bg-[#123224] text-ok",
  rejeitado: "bg-[#3f1d1d] text-danger",
  venda: "bg-[#102a4a] text-[#7dd3fc]",
  cancelado: "bg-form text-muted",
  aberto: "bg-[#3f1d1d] text-danger",
  parcial: "bg-[#3d2e12] text-warn",
  pago: "bg-[#123224] text-ok",
};

const labels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  venda: "Venda",
  cancelado: "Cancelado",
  aberto: "Em aberto",
  parcial: "Parcial",
  pago: "Pago",
  admin: "Administrador",
  superadmin: "Superadmin",
  vendedor: "Vendedor",
};

export function statusLabel(value: string): string {
  return labels[value] ?? value;
}

export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badges[value] ?? "bg-bg text-muted"}`}
    >
      {statusLabel(value)}
    </span>
  );
}
