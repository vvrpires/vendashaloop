import { createFileRoute } from "@tanstack/react-router";
import { ConfigGate } from "@/components/config-gate";
import { EmpresaPage } from "@/components/empresa-page";

export const Route = createFileRoute("/_app/empresa")({
  component: () => (
    <ConfigGate>
      <EmpresaPage />
    </ConfigGate>
  ),
});
