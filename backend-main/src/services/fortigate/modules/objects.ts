import { CliWriter, netToString, parseNet, quote } from '../cli.ts';
import { ValidationError, type TemplateDef } from '../types.ts';
import { list, str } from '../validate.ts';

const CATEGORY = 'Objetos';

export const objectTemplates: TemplateDef[] = [
  {
    id: 'address',
    category: CATEGORY,
    title: 'Endereço',
    description: 'Objeto de endereço do tipo rede/host, faixa de IPs ou FQDN.',
    fields: [
      { name: 'name', label: 'Nome do objeto', type: 'text', required: true, format: 'name', maxLength: 79, placeholder: 'SRV-WEB' },
      {
        name: 'kind', label: 'Tipo', type: 'select', default: 'subnet',
        options: [
          { value: 'subnet', label: 'Host / rede (ipmask)' },
          { value: 'iprange', label: 'Faixa de IPs (iprange)' },
          { value: 'fqdn', label: 'FQDN' },
        ],
      },
      { name: 'subnet', label: 'IP ou rede', type: 'text', required: true, format: 'host-or-subnet', placeholder: '192.168.1.10 ou 192.168.1.0/24', showIf: { field: 'kind', equals: ['subnet'] } },
      { name: 'startIp', label: 'IP inicial', type: 'text', required: true, format: 'ipv4', showIf: { field: 'kind', equals: ['iprange'] } },
      { name: 'endIp', label: 'IP final', type: 'text', required: true, format: 'ipv4', showIf: { field: 'kind', equals: ['iprange'] } },
      { name: 'fqdn', label: 'FQDN', type: 'text', required: true, format: 'fqdn', placeholder: 'portal.exemplo.com.br ou *.exemplo.com', showIf: { field: 'kind', equals: ['fqdn'] } },
      { name: 'comment', label: 'Comentário', type: 'text', format: 'name', maxLength: 255 },
    ],
    build(v) {
      const cli = new CliWriter();
      cli.config('firewall address', () => {
        cli.edit(str(v, 'name'), () => {
          switch (str(v, 'kind')) {
            case 'iprange':
              cli.set('type', 'iprange').set('start-ip', str(v, 'startIp')).set('end-ip', str(v, 'endIp'));
              break;
            case 'fqdn':
              cli.set('type', 'fqdn').setq('fqdn', str(v, 'fqdn'));
              break;
            default:
              cli.set('type', 'ipmask').set('subnet', str(v, 'subnet'));
          }
          if (str(v, 'comment')) cli.setq('comment', str(v, 'comment'));
        });
      });
      return { script: cli.toString(), notes: [] };
    },
  },

  {
    id: 'address-bulk',
    category: CATEGORY,
    title: 'Endereços em lote',
    description: 'Vários objetos de uma vez a partir de uma lista "NOME;IP/máscara", com grupo opcional.',
    fields: [
      {
        name: 'entries', label: 'Objetos (um por linha: NOME;IP ou rede)', type: 'lines', required: true,
        placeholder: 'SRV-AD01;192.168.1.10\nSRV-AD02;192.168.1.11\nREDE-CFTV;192.168.50.0/24',
      },
      { name: 'group', label: 'Criar grupo com todos (opcional)', type: 'text', format: 'name', maxLength: 79, placeholder: 'GRP-SERVIDORES' },
    ],
    build(v) {
      const errors: string[] = [];
      const parsed = list(v, 'entries').map((line, i) => {
        const [name = '', addr = ''] = line.split(/[;\t]/).map((p) => p.trim());
        const net = parseNet(addr, { allowBareIp: true });
        if (!name || /["\\?]/.test(name)) errors.push(`Linha ${i + 1}: nome inválido`);
        if (typeof net === 'string') errors.push(`Linha ${i + 1}: ${net}`);
        return { name, subnet: typeof net === 'string' ? '' : netToString(net) };
      });
      if (errors.length) throw new ValidationError({ entries: errors.slice(0, 3).join(' · ') });

      const cli = new CliWriter();
      cli.config('firewall address', () => {
        for (const entry of parsed) {
          cli.edit(entry.name, () => cli.set('type', 'ipmask').set('subnet', entry.subnet));
        }
      });
      if (str(v, 'group')) {
        cli.config('firewall addrgrp', () => {
          cli.edit(str(v, 'group'), () => cli.setq('member', ...parsed.map((e) => e.name)));
        });
      }
      return { script: cli.toString(), notes: [`${parsed.length} objeto(s) gerado(s).`] };
    },
  },

  {
    id: 'address-group',
    category: CATEGORY,
    title: 'Grupo de endereços',
    description: 'Agrupa objetos de endereço já existentes.',
    fields: [
      { name: 'name', label: 'Nome do grupo', type: 'text', required: true, format: 'name', maxLength: 79, placeholder: 'GRP-SERVIDORES' },
      { name: 'members', label: 'Membros (nomes dos objetos)', type: 'list', required: true, format: 'name', placeholder: 'SRV-AD01, SRV-AD02' },
      { name: 'append', label: 'Adicionar aos membros atuais (append) em vez de substituir', type: 'checkbox', default: false },
      { name: 'comment', label: 'Comentário', type: 'text', format: 'name', maxLength: 255 },
    ],
    build(v) {
      const cli = new CliWriter();
      const members = list(v, 'members');
      cli.config('firewall addrgrp', () => {
        cli.edit(str(v, 'name'), () => {
          if (v.append === true) cli.raw(`append member ${members.map(quote).join(' ')}`);
          else cli.setq('member', ...members);
          if (str(v, 'comment')) cli.setq('comment', str(v, 'comment'));
        });
      });
      const notes = v.append === true
        ? []
        : ['"set member" substitui a lista inteira; em grupo existente, marque a opção append para não perder membros.'];
      return { script: cli.toString(), notes };
    },
  },

  {
    id: 'service',
    category: CATEGORY,
    title: 'Serviço customizado',
    description: 'Serviço TCP/UDP com uma ou mais portas ou faixas.',
    fields: [
      { name: 'name', label: 'Nome do serviço', type: 'text', required: true, format: 'name', maxLength: 79, placeholder: 'TCP-8080' },
      {
        name: 'protocol', label: 'Protocolo', type: 'select', default: 'tcp',
        options: [
          { value: 'tcp', label: 'TCP' },
          { value: 'udp', label: 'UDP' },
          { value: 'both', label: 'TCP e UDP' },
        ],
      },
      { name: 'ports', label: 'Portas de destino', type: 'list', required: true, format: 'port-range', placeholder: '8080, 8443, 9000-9010' },
      { name: 'comment', label: 'Comentário', type: 'text', format: 'name', maxLength: 255 },
    ],
    build(v) {
      const ports = list(v, 'ports').join(' ');
      const proto = str(v, 'protocol');
      const cli = new CliWriter();
      cli.config('firewall service custom', () => {
        cli.edit(str(v, 'name'), () => {
          if (proto !== 'udp') cli.set('tcp-portrange', ports);
          if (proto !== 'tcp') cli.set('udp-portrange', ports);
          if (str(v, 'comment')) cli.setq('comment', str(v, 'comment'));
        });
      });
      return { script: cli.toString(), notes: [] };
    },
  },

  {
    id: 'service-group',
    category: CATEGORY,
    title: 'Grupo de serviços',
    description: 'Agrupa serviços existentes (predefinidos ou customizados).',
    fields: [
      { name: 'name', label: 'Nome do grupo', type: 'text', required: true, format: 'name', maxLength: 79, placeholder: 'GRP-SVC-ERP' },
      { name: 'members', label: 'Serviços', type: 'list', required: true, format: 'name', placeholder: 'HTTPS, RDP, TCP-8080' },
    ],
    build(v) {
      const cli = new CliWriter();
      cli.config('firewall service group', () => {
        cli.edit(str(v, 'name'), () => cli.setq('member', ...list(v, 'members')));
      });
      return { script: cli.toString(), notes: [] };
    },
  },
];

export const addressBlock = (cli: CliWriter, entries: Array<{ name: string; subnet: string; comment?: string }>): void => {
  cli.config('firewall address', () => {
    for (const entry of entries) {
      cli.edit(entry.name, () => {
        cli.set('type', 'ipmask').set('subnet', entry.subnet);
        if (entry.comment) cli.setq('comment', entry.comment);
      });
    }
  });
};

export const groupBlock = (cli: CliWriter, name: string, members: string[]): void => {
  cli.config('firewall addrgrp', () => {
    cli.edit(name, () => cli.setq('member', ...members));
  });
};

