alter table empresa add column if not exists ie text not null default '';
alter table empresa add column if not exists im text not null default '';
alter table empresa add column if not exists crt text not null default '1';
alter table empresa add column if not exists cep text not null default '';
alter table empresa add column if not exists logradouro text not null default '';
alter table empresa add column if not exists numero_end text not null default '';
alter table empresa add column if not exists bairro text not null default '';
alter table empresa add column if not exists municipio text not null default 'ARAGUAINA';
alter table empresa add column if not exists uf text not null default 'TO';
alter table empresa add column if not exists codigo_municipio text not null default '1702109';
alter table empresa add column if not exists ambiente text not null default 'homologacao';
alter table empresa add column if not exists serie_nfe text not null default '1';
alter table empresa add column if not exists proximo_nfe integer not null default 1;
alter table empresa add column if not exists codigo_servico text not null default '0107';
alter table empresa add column if not exists aliquota_iss numeric(8,2) not null default 5;
alter table empresa add column if not exists proximo_nfse integer not null default 1;

alter table produtos add column if not exists tipo text not null default 'servico';
alter table produtos add column if not exists ncm text not null default '';
alter table produtos add column if not exists cfop text not null default '5102';
alter table produtos add column if not exists cst text not null default '102';

alter table clientes add column if not exists cep text not null default '';
alter table clientes add column if not exists numero text not null default '';
alter table clientes add column if not exists bairro text not null default '';
alter table clientes add column if not exists municipio text not null default '';
alter table clientes add column if not exists uf text not null default '';

alter table orcamentos add column if not exists nfe_chave text not null default '';
alter table orcamentos add column if not exists nfe_protocolo text not null default '';
alter table orcamentos add column if not exists nfe_numero text not null default '';
alter table orcamentos add column if not exists nfse_numero text not null default '';
alter table orcamentos add column if not exists nfse_protocolo text not null default '';
