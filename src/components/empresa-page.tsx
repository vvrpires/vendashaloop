import { useEffect, useState } from "react";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { getBanco, saveBanco } from "@/lib/banco.functions";
import { salvarCertificado, statusCertificado } from "@/lib/certificado.functions";
import { pode } from "@/lib/permissoes";
import { ensureProfile, getEmpresa, saveEmpresa } from "@/lib/vendas.functions";
import { buscarCep, caixaAlta, mascaraCep, mascaraCnpj, mascaraTelefone, soDigitos } from "@/lib/mascaras";

export function EmpresaPage() {
  const [form, setForm] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [dono, setDono] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [ready, setReady] = useState(false);
  const [cepAviso, setCepAviso] = useState("");
  async function onCep(valor) {
    const cep = mascaraCep(valor);
    setForm((atual) => (atual ? { ...atual, cep } : atual));
    setCepAviso("");
    if (soDigitos(cep).length !== 8) return;
    setCepAviso("Buscando endereço…");
    const endereco = await buscarCep(cep);
    if (!endereco) {
      setCepAviso("CEP não encontrado. Preencha o endereço à mão.");
      return;
    }
    setCepAviso("");
    setForm((atual) =>
      atual
        ? {
            ...atual,
            logradouro: endereco.logradouro || atual.logradouro,
            bairro: endereco.bairro || atual.bairro,
            municipio: endereco.municipio || atual.municipio,
            uf: endereco.uf || atual.uf,
            codigoMunicipio: endereco.codigoMunicipio || atual.codigoMunicipio,
          }
        : atual,
    );
  }
  useEffect(() => {
    ensureProfile()
      .then(async (profile) => {
        const isAdmin = pode(profile.role, profile.permissoes, "empresa");
        setAdmin(isAdmin);
        setDono(profile.role === "superadmin");
        if (isAdmin) setForm(await getEmpresa());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar."))
      .finally(() => setReady(true));
  }, []);
  async function onSubmit(event) {
    event.preventDefault();
    if (!form) return;
    setError("");
    setSaved("");
    try {
      await saveEmpresa({ data: form });
      setSaved("Dados da empresa atualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Minha empresa</h1>
        <p className="text-sm text-muted">
          Opcional para começar. É necessário para cadastrar produtos, clientes e emitir nota.
        </p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {saved ? <p className="text-sm text-ok">{saved}</p> : null}
      {ready && !admin ? <p className="text-sm text-muted">Você não tem acesso a esta tela.</p> : null}
      {admin && form ? (
        <>
          <Card>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
              <Field label="Nome">
                <TextInput
                  value={form.nome}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nome: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="CNPJ">
                <TextInput
                  value={form.cnpj}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      cnpj: mascaraCnpj(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Telefone">
                <TextInput
                  value={form.telefone}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      telefone: mascaraTelefone(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="E-mail">
                <TextInput
                  value={form.email}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      email: e.target.value,
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Localização">
                  <TextInput
                    value={form.local}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        local: caixaAlta(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Inscrição estadual">
                <TextInput
                  value={form.ie}
                  placeholder="Vazio se for isento"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ie: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Inscrição municipal">
                <TextInput
                  value={form.im}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      im: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="CEP">
                <TextInput
                  value={form.cep}
                  inputMode="numeric"
                  placeholder="00000-000"
                  onChange={(e) => void onCep(e.target.value)}
                />
                {cepAviso ? <span className="text-xs text-muted">{cepAviso}</span> : null}
              </Field>
              <Field label="Logradouro">
                <TextInput
                  value={form.logradouro}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      logradouro: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Número">
                <TextInput
                  value={form.numeroEnd}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      numeroEnd: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Bairro">
                <TextInput
                  value={form.bairro}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bairro: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Município">
                <TextInput
                  value={form.municipio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      municipio: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="UF">
                <TextInput
                  value={form.uf}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      uf: caixaAlta(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Código IBGE">
                <TextInput
                  value={form.codigoMunicipio}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      codigoMunicipio: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Regime">
                <select
                  className="h-11 w-full rounded border border-line bg-form px-3"
                  value={form.crt}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      crt: e.target.value === "2" || e.target.value === "3" ? e.target.value : "1",
                    })
                  }
                >
                  <option value="1">Simples Nacional</option>
                  <option value="2">Simples Nacional, excesso de sublimite</option>
                  <option value="3">Regime normal</option>
                </select>
              </Field>
              <Field label="Ambiente da nota">
                <select
                  className="h-11 w-full rounded border border-line bg-form px-3"
                  value={form.ambiente}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ambiente: e.target.value === "producao" ? "producao" : "homologacao",
                    })
                  }
                >
                  <option value="homologacao">Homologação, para testes</option>
                  <option value="producao">Produção</option>
                </select>
              </Field>
              <Field label="Série da NF-e">
                <TextInput
                  value={form.serieNfe}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serieNfe: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Código do serviço (LC 116)">
                <TextInput
                  value={form.codigoServico}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      codigoServico: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Alíquota ISS (%)">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.aliquotaIss}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      aliquotaIss: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Button type="submit" className="sm:col-span-2 sm:w-fit">
                Salvar empresa
              </Button>
            </form>
          </Card>
          {dono ? <CertificadoCard /> : null}
          {dono ? <BancoCard /> : null}
        </>
      ) : null}
    </div>
  );
}
function CertificadoCard() {
  const [instalado, setInstalado] = useState(false);
  const [senha, setSenha] = useState("");
  const [arquivo, setArquivo] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    statusCertificado()
      .then((status) => setInstalado(status.instalado))
      .catch((err) =>
        setErro(err instanceof Error ? err.message : "Não foi possível verificar o certificado."),
      );
  }, []);
  async function onArquivo(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pfx") || file.size > 2e5) {
      setErro("Envie um arquivo .pfx de até 200 KB.");
      return;
    }
    const texto = await file.arrayBuffer();
    const bytes = new Uint8Array(texto);
    let binario = "";
    bytes.forEach((byte) => {
      binario += String.fromCharCode(byte);
    });
    setArquivo(btoa(binario));
    setErro("");
  }
  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    setAviso("");
    try {
      const salvo = await salvarCertificado({
        data: {
          arquivo,
          senha,
        },
      });
      setInstalado(true);
      setSenha("");
      setArquivo("");
      setAviso(salvo.titular ? `Certificado salvo. Titular: ${salvo.titular}` : "Certificado salvo.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o certificado.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div>
          <h2 className="text-lg font-semibold">Certificado digital</h2>
          <p className="mt-1 text-sm text-muted">
            Cada cliente usa o próprio certificado A1. Ele não aparece para os outros usuários.
          </p>
        </div>
        <p className="text-sm">{instalado ? "Certificado instalado." : "Nenhum certificado enviado."}</p>
        <Field label="Arquivo .pfx">
          <input
            type="file"
            accept=".pfx,application/x-pkcs12"
            className="block w-full text-sm text-muted"
            onChange={(e) => void onArquivo(e.target.files?.[0])}
          />
        </Field>
        <Field label="Senha do certificado">
          <TextInput
            type="password"
            value={senha}
            autoComplete="new-password"
            onChange={(e) => setSenha(e.target.value)}
          />
        </Field>
        {erro ? <p className="text-sm text-danger">{erro}</p> : null}
        {aviso ? <p className="text-sm text-ok">{aviso}</p> : null}
        <Button type="submit" disabled={busy || !arquivo || !senha} className="w-fit">
          {busy ? "Salvando..." : "Salvar certificado"}
        </Button>
      </form>
    </Card>
  );
}
function BancoCard() {
  const [destino, setDestino] = useState("");
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getBanco()
      .then((banco) => setDestino(banco.destino))
      .catch((err) => setErro(err instanceof Error ? err.message : "Não foi possível ler o banco."));
  }, []);
  async function onSubmit(event) {
    event.preventDefault();
    setErro("");
    setAviso("");
    setBusy(true);
    try {
      const salvo = await saveBanco({ data: { url } });
      setDestino(salvo.destino);
      setUrl("");
      setAviso(
        salvo.reiniciando
          ? "Conexão aceita. O sistema está reiniciando para usar esse banco."
          : "Esse banco já estava em uso. As tabelas foram conferidas.",
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível conectar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <div>
          <h2 className="text-lg font-semibold">Banco de dados</h2>
          <p className="mt-1 text-sm text-muted">
            Cole o URI do Supabase, em Project Settings, Database, Connection string. Trocar o endereço aponta
            esta instalação para outro banco. Os dados atuais não são copiados.
          </p>
        </div>
        <p className="text-sm">
          {"Em uso: "}
          {destino || "não configurado"}
        </p>
        <Field label="Endereço do Supabase">
          <TextInput
            value={url}
            autoComplete="off"
            placeholder="postgresql://postgres....supabase.com:5432/postgres"
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
        {erro ? <p className="text-sm text-danger">{erro}</p> : null}
        {aviso ? <p className="text-sm text-ok">{aviso}</p> : null}
        <Button type="submit" disabled={busy || !url.trim()} className="w-fit">
          {busy ? "Testando conexão..." : "Salvar banco"}
        </Button>
      </form>
    </Card>
  );
}
