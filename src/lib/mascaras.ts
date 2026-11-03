// rev.42: máscaras e padronização dos cadastros (clientes, catálogo e Minha empresa).

export function soDigitos(valor: string): string {
  return String(valor ?? "").replace(/\D/g, "");
}

/** Texto em CAIXA ALTA (todos os campos, menos e-mail). */
export function caixaAlta(valor: string): string {
  return String(valor ?? "").toLocaleUpperCase("pt-BR");
}

/** CPF 000.000.000-00 (até 11 dígitos) ou CNPJ 00.000.000/0000-00 (12 a 14 dígitos). */
export function mascaraDocumento(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
  }
  return mascaraCnpj(d);
}

/** CNPJ 00.000.000/0000-00. */
export function mascaraCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/\/(\d{4})(\d{1,2})$/, "/$1-$2");
}

/** Telefone (DD) 0000-0000 ou, com o 9º dígito, (DD) 00000-0000. */
export function mascaraTelefone(valor: string): string {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

/** CEP 00000-000. */
export function mascaraCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export type EnderecoCep = {
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigoMunicipio: string;
};

/** Busca o endereço do CEP no ViaCEP (gratuito). Devolve null se não encontrar. */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (!dados || dados.erro) return null;
    return {
      logradouro: caixaAlta(dados.logradouro ?? ""),
      bairro: caixaAlta(dados.bairro ?? ""),
      municipio: caixaAlta(dados.localidade ?? ""),
      uf: caixaAlta(dados.uf ?? ""),
      codigoMunicipio: String(dados.ibge ?? ""),
    };
  } catch {
    return null;
  }
}
