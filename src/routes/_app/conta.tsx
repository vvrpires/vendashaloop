import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { definirSenha, ensureProfile } from "@/lib/vendas.functions";

export const Route = createFileRoute("/_app/conta")({ component: ContaPage });

export function ContaPage() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    ensureProfile()
      .then((profile) => {
        setUsername(profile.username);
        setName(profile.name);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar."));
  }, []);
  async function onPassword(event) {
    event.preventDefault();
    setError("");
    setSaved("");
    try {
      await definirSenha({
        data: {
          atual: currentPassword,
          nova: newPassword,
        },
      });
      setCurrentPassword("");
      setNewPassword("");
      setSaved("Senha alterada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a senha.");
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted">Altere a senha deste usuário.</p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-ok">{saved}</p> : null}
      <Card>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onPassword}>
          <Field label="Nome">
            <TextInput value={name} disabled />
          </Field>
          <Field label="Usuário">
            <TextInput value={username} disabled />
          </Field>
          <Field label="Senha atual">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </Field>
          <Field label="Nova senha">
            <TextInput
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="sm:w-fit">
            Alterar senha
          </Button>
        </form>
      </Card>
    </div>
  );
}
