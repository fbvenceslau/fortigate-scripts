import { CliWriter } from '../cli.ts';
import type { TemplateDef } from '../types.ts';
import { bool, list, str } from '../validate.ts';

const CATEGORY = 'Políticas';

export interface PolicySpec {
  name: string;
  srcintf: string[];
  dstintf: string[];
  srcaddr: string[];
  dstaddr: string[];
  service: string[];
  action: 'accept' | 'deny';
  nat?: boolean;
  schedule?: string;
  logtraffic?: string;
  comments?: string;
  utm?: {
    sslProfile: string;
    av?: string;
    webfilter?: string;
    ips?: string;
    app?: string;
  };
}

// Bloco "edit 0" de firewall policy; usado também pelos templates de VPN e VIP.
export const writePolicy = (cli: CliWriter, p: PolicySpec): void => {
  cli.edit(0, () => {
    cli.setq('name', p.name.slice(0, 35));
    cli.setq('srcintf', ...p.srcintf);
    cli.setq('dstintf', ...p.dstintf);
    cli.set('action', p.action);
    cli.setq('srcaddr', ...p.srcaddr);
    cli.setq('dstaddr', ...p.dstaddr);
    cli.setq('schedule', p.schedule ?? 'always');
    cli.setq('service', ...p.service);
    if (p.action === 'accept' && p.utm) {
      cli.set('utm-status', 'enable');
      cli.setq('ssl-ssh-profile', p.utm.sslProfile);
      if (p.utm.av) cli.setq('av-profile', p.utm.av);
      if (p.utm.webfilter) cli.setq('webfilter-profile', p.utm.webfilter);
      if (p.utm.ips) cli.setq('ips-sensor', p.utm.ips);
      if (p.utm.app) cli.setq('application-list', p.utm.app);
    }
    cli.set('logtraffic', p.logtraffic ?? 'all');
    if (p.action === 'accept' && p.nat) cli.set('nat', 'enable');
    if (p.comments) cli.setq('comments', p.comments);
  });
};

// Portas que não deveriam ficar abertas para a internet sem restrição de origem.
const SENSITIVE_PORTS: Record<string, string> = {
  '21': 'FTP', '22': 'SSH', '23': 'Telnet', '135': 'RPC', '139': 'NetBIOS', '445': 'SMB',
  '1433': 'SQL Server', '1521': 'Oracle', '3306': 'MySQL', '3389': 'RDP', '5432': 'PostgreSQL',
  '5900': 'VNC', '8291': 'Winbox',
};

export const policyTemplates: TemplateDef[] = [
  {
    id: 'policy',
    category: CATEGORY,
    title: 'Política de firewall',
    description: 'IPv4 policy com NAT e perfis de segurança (UTM) opcionais.',
    fields: [
      { name: 'name', label: 'Nome da política', type: 'text', required: true, format: 'name', maxLength: 35, placeholder: 'LAN-INTERNET' },
      { name: 'srcintf', label: 'Interface(s) de origem', type: 'list', required: true, format: 'name', placeholder: 'internal' },
      { name: 'dstintf', label: 'Interface(s) de destino', type: 'list', required: true, format: 'name', placeholder: 'wan1 ou virtual-wan-link' },
      { name: 'srcaddr', label: 'Origem', type: 'list', required: true, format: 'name', default: 'all' },
      { name: 'dstaddr', label: 'Destino', type: 'list', required: true, format: 'name', default: 'all' },
      { name: 'service', label: 'Serviços', type: 'list', required: true, format: 'name', default: 'ALL', placeholder: 'HTTP, HTTPS, DNS' },
      {
        name: 'action', label: 'Ação', type: 'select', default: 'accept',
        options: [{ value: 'accept', label: 'Accept' }, { value: 'deny', label: 'Deny' }],
      },
      { name: 'nat', label: 'NAT (IP da interface de saída)', type: 'checkbox', default: false, showIf: { field: 'action', equals: ['accept'] } },
      { name: 'schedule', label: 'Schedule', type: 'text', format: 'name', default: 'always' },
      {
        name: 'logtraffic', label: 'Log', type: 'select', default: 'all',
        options: [
          { value: 'all', label: 'Todas as sessões' },
          { value: 'utm', label: 'Somente eventos de segurança' },
          { value: 'disable', label: 'Desativado' },
        ],
      },
      { name: 'comments', label: 'Comentário', type: 'text', format: 'name', maxLength: 1023 },
      { name: 'utm', label: 'Aplicar perfis de segurança', type: 'checkbox', default: false, section: 'Perfis de segurança', showIf: { field: 'action', equals: ['accept'] } },
      {
        name: 'sslProfile', label: 'Inspeção SSL', type: 'select', default: 'certificate-inspection', showIf: { field: 'utm', equals: [true] },
        options: [
          { value: 'certificate-inspection', label: 'certificate-inspection' },
          { value: 'deep-inspection', label: 'deep-inspection' },
          { value: 'custom-deep-inspection', label: 'custom-deep-inspection' },
        ],
      },
      { name: 'av', label: 'Antivírus', type: 'text', format: 'name', default: 'default', showIf: { field: 'utm', equals: [true] } },
      { name: 'webfilter', label: 'Web filter', type: 'text', format: 'name', default: 'default', showIf: { field: 'utm', equals: [true] } },
      { name: 'ips', label: 'IPS', type: 'text', format: 'name', default: 'default', showIf: { field: 'utm', equals: [true] } },
      { name: 'app', label: 'Application control', type: 'text', format: 'name', default: 'default', showIf: { field: 'utm', equals: [true] } },
    ],
    build(v) {
      const cli = new CliWriter();
      const action = str(v, 'action') === 'deny' ? 'deny' : 'accept';
      cli.config('firewall policy', () =>
        writePolicy(cli, {
          name: str(v, 'name'),
          srcintf: list(v, 'srcintf'),
          dstintf: list(v, 'dstintf'),
          srcaddr: list(v, 'srcaddr'),
          dstaddr: list(v, 'dstaddr'),
          service: list(v, 'service'),
          action,
          nat: bool(v, 'nat'),
          schedule: str(v, 'schedule') || 'always',
          logtraffic: str(v, 'logtraffic'),
          comments: str(v, 'comments'),
          ...(bool(v, 'utm') && {
            utm: {
              sslProfile: str(v, 'sslProfile'),
              av: str(v, 'av'),
              webfilter: str(v, 'webfilter'),
              ips: str(v, 'ips'),
              app: str(v, 'app'),
            },
          }),
        }),
      );
      const notes = ['"edit 0" cria a política no fim da lista; use "move <id> before <id>" para posicioná-la.'];
      if (action === 'accept' && list(v, 'srcaddr').includes('all') && list(v, 'dstaddr').includes('all') && list(v, 'service').includes('ALL')) {
        notes.push('Política any/any/ALL: considere restringir origem, destino ou serviço.');
      }
      if (str(v, 'sslProfile') !== 'certificate-inspection' && bool(v, 'utm')) {
        notes.push('Deep inspection exige a CA do FortiGate instalada nas estações.');
      }
      return { script: cli.toString(), notes };
    },
  },

  {
    id: 'vip',
    category: CATEGORY,
    title: 'VIP / port forward',
    description: 'Publica um serviço interno (DNAT) e cria a política de entrada.',
    fields: [
      { name: 'name', label: 'Nome do VIP', type: 'text', required: true, format: 'name', maxLength: 79, placeholder: 'VIP-SRV-WEB-443' },
      { name: 'extintf', label: 'Interface externa', type: 'text', required: true, format: 'name', default: 'wan1' },
      { name: 'extip', label: 'IP público', type: 'text', required: true, format: 'ipv4' },
      { name: 'mappedip', label: 'IP interno', type: 'text', required: true, format: 'ipv4' },
      { name: 'portforward', label: 'Port forward (só portas específicas)', type: 'checkbox', default: true },
      {
        name: 'protocol', label: 'Protocolo', type: 'select', default: 'tcp', showIf: { field: 'portforward', equals: [true] },
        options: [{ value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }],
      },
      { name: 'extport', label: 'Porta externa', type: 'text', required: true, format: 'port-range', showIf: { field: 'portforward', equals: [true] } },
      { name: 'mappedport', label: 'Porta interna (vazio = mesma)', type: 'text', format: 'port-range', showIf: { field: 'portforward', equals: [true] } },
      { name: 'policy', label: 'Criar política de entrada', type: 'checkbox', default: true, section: 'Política' },
      { name: 'dstintf', label: 'Interface interna', type: 'text', required: true, format: 'name', default: 'internal', showIf: { field: 'policy', equals: [true] } },
      { name: 'srcaddr', label: 'Origens permitidas (vazio = qualquer)', type: 'list', format: 'name', placeholder: 'GRP-IPS-PARCEIRO', showIf: { field: 'policy', equals: [true] } },
      { name: 'service', label: 'Serviço', type: 'list', format: 'name', default: 'ALL', showIf: { field: 'policy', equals: [true] } },
      { name: 'ips', label: 'Aplicar IPS (default)', type: 'checkbox', default: true, showIf: { field: 'policy', equals: [true] } },
    ],
    build(v) {
      const pf = bool(v, 'portforward');
      const extport = str(v, 'extport');
      const mappedport = str(v, 'mappedport') || extport;
      const notes: string[] = [];

      const cli = new CliWriter();
      cli.config('firewall vip', () => {
        cli.edit(str(v, 'name'), () => {
          cli.set('extip', str(v, 'extip'));
          cli.setq('mappedip', str(v, 'mappedip'));
          cli.setq('extintf', str(v, 'extintf'));
          if (pf) {
            cli.set('portforward', 'enable');
            if (str(v, 'protocol') === 'udp') cli.set('protocol', 'udp');
            cli.set('extport', extport).set('mappedport', mappedport);
          }
        });
      });

      if (bool(v, 'policy')) {
        const srcaddr = list(v, 'srcaddr');
        cli.config('firewall policy', () =>
          writePolicy(cli, {
            name: `IN-${str(v, 'name')}`,
            srcintf: [str(v, 'extintf')],
            dstintf: [str(v, 'dstintf')],
            srcaddr: srcaddr.length ? srcaddr : ['all'],
            dstaddr: [str(v, 'name')],
            service: list(v, 'service').length ? list(v, 'service') : ['ALL'],
            action: 'accept',
            ...(bool(v, 'ips') && { utm: { sslProfile: 'certificate-inspection', ips: 'default' } }),
          }),
        );
        if (!srcaddr.length) notes.push('Política aberta para qualquer origem: se possível, restrinja aos IPs que realmente acessam.');
      }

      const exposed = SENSITIVE_PORTS[mappedport.split('-')[0] ?? ''];
      if (!pf) notes.push('Sem port forward o VIP mapeia todas as portas do IP público para o host interno.');
      else if (exposed) notes.push(`Atenção: ${exposed} exposto na internet. Prefira acesso via VPN ou restrinja a origem.`);
      return { script: cli.toString(), notes };
    },
  },
];
