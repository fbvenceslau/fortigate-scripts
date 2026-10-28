import { CliWriter, inNet, splitNet } from '../cli.ts';
import { ValidationError, type TemplateDef } from '../types.ts';
import { bool, list, str } from '../validate.ts';

const CATEGORY = 'Rede';

export const networkTemplates: TemplateDef[] = [
  {
    id: 'interface',
    category: CATEGORY,
    title: 'Interface / VLAN',
    description: 'Endereça uma porta física ou cria uma VLAN, com servidor DHCP opcional.',
    fields: [
      {
        name: 'mode', label: 'Tipo', type: 'select', default: 'vlan',
        options: [
          { value: 'vlan', label: 'Nova VLAN' },
          { value: 'physical', label: 'Porta existente (física/agregada)' },
        ],
      },
      { name: 'name', label: 'Nome da interface', type: 'text', required: true, format: 'name', maxLength: 15, placeholder: 'VLAN20', help: 'Máximo de 15 caracteres.' },
      { name: 'parent', label: 'Interface pai', type: 'text', required: true, format: 'name', placeholder: 'internal / port2 / lag1', showIf: { field: 'mode', equals: ['vlan'] } },
      { name: 'vlanId', label: 'VLAN ID', type: 'number', required: true, min: 1, max: 4094, showIf: { field: 'mode', equals: ['vlan'] } },
      { name: 'vdom', label: 'VDOM', type: 'text', default: 'root', format: 'name', showIf: { field: 'mode', equals: ['vlan'] } },
      { name: 'alias', label: 'Alias', type: 'text', format: 'name', maxLength: 25, placeholder: 'WIFI-VISITANTES' },
      { name: 'address', label: 'IP / máscara da interface', type: 'text', required: true, format: 'ip-cidr', placeholder: '192.168.20.1/24' },
      {
        name: 'role', label: 'Role', type: 'select', default: 'lan',
        options: [
          { value: 'lan', label: 'LAN' },
          { value: 'wan', label: 'WAN' },
          { value: 'dmz', label: 'DMZ' },
          { value: 'undefined', label: 'Undefined' },
        ],
      },
      {
        name: 'allowaccess', label: 'Acesso administrativo', type: 'multi', default: ['ping'],
        options: ['ping', 'https', 'ssh', 'http', 'snmp', 'fgfm', 'fabric', 'radius-acct'].map((o) => ({ value: o, label: o })),
      },
      { name: 'dhcp', label: 'Criar servidor DHCP', type: 'checkbox', default: false, section: 'DHCP' },
      { name: 'dhcpStart', label: 'Início da faixa', type: 'text', required: true, format: 'ipv4', showIf: { field: 'dhcp', equals: [true] } },
      { name: 'dhcpEnd', label: 'Fim da faixa', type: 'text', required: true, format: 'ipv4', showIf: { field: 'dhcp', equals: [true] } },
      { name: 'dhcpDns', label: 'DNS (vazio = DNS do sistema)', type: 'list', format: 'ipv4', placeholder: '8.8.8.8, 1.1.1.1', showIf: { field: 'dhcp', equals: [true] } },
      { name: 'leaseTime', label: 'Lease (segundos)', type: 'number', default: '86400', min: 300, max: 8640000, showIf: { field: 'dhcp', equals: [true] } },
    ],
    build(v) {
      const net = splitNet(str(v, 'address'));
      const isVlan = str(v, 'mode') === 'vlan';
      const access = list(v, 'allowaccess');
      const notes: string[] = [];

      if (bool(v, 'dhcp')) {
        const errors: Record<string, string> = {};
        for (const key of ['dhcpStart', 'dhcpEnd']) {
          if (!inNet(str(v, key), net)) errors[key] = `Fora da rede ${net.ip}/${net.prefix}`;
        }
        if (Object.keys(errors).length) throw new ValidationError(errors);
      }

      const cli = new CliWriter();
      cli.config('system interface', () => {
        cli.edit(str(v, 'name'), () => {
          // Na criação de VLAN, vdom/interface/vlanid vêm primeiro.
          if (isVlan) {
            cli.setq('vdom', str(v, 'vdom') || 'root');
            cli.setq('interface', str(v, 'parent')).set('vlanid', str(v, 'vlanId'));
          }
          cli.set('ip', `${net.ip} ${net.mask}`);
          if (access.length) cli.set('allowaccess', access.join(' '));
          if (str(v, 'alias')) cli.setq('alias', str(v, 'alias'));
          cli.set('role', str(v, 'role'));
        });
      });

      if (bool(v, 'dhcp')) {
        const dns = list(v, 'dhcpDns');
        cli.config('system dhcp server', () => {
          cli.edit(0, () => {
            if (dns.length) {
              cli.set('dns-service', 'specify');
              dns.slice(0, 4).forEach((server, i) => cli.set(`dns-server${i + 1}`, server));
            } else {
              cli.set('dns-service', 'default');
            }
            cli.set('default-gateway', net.ip).set('netmask', net.mask);
            cli.setq('interface', str(v, 'name'));
            cli.set('lease-time', str(v, 'leaseTime'));
            cli.config('ip-range', () => {
              cli.edit(1, () => cli.set('start-ip', str(v, 'dhcpStart')).set('end-ip', str(v, 'dhcpEnd')));
            });
          });
        });
      }

      if (access.some((a) => ['http', 'ssh', 'https'].includes(a)) && str(v, 'role') === 'wan') {
        notes.push('Acesso administrativo habilitado em interface WAN: restrinja com trusted hosts ou local-in policy.');
      }
      if (!isVlan) notes.push('A porta precisa estar livre (fora de switch/hardware-switch) para receber IP próprio.');
      return { script: cli.toString(), notes };
    },
  },

  {
    id: 'zone',
    category: CATEGORY,
    title: 'Zona',
    description: 'Agrupa interfaces numa zona para simplificar políticas.',
    fields: [
      { name: 'name', label: 'Nome da zona', type: 'text', required: true, format: 'name', maxLength: 35, placeholder: 'ZONA-LAN' },
      { name: 'interfaces', label: 'Interfaces', type: 'list', required: true, format: 'name', placeholder: 'VLAN10, VLAN20' },
      {
        name: 'intrazone', label: 'Tráfego entre interfaces da zona', type: 'select', default: 'deny',
        options: [
          { value: 'deny', label: 'Bloquear (deny)' },
          { value: 'allow', label: 'Permitir (allow)' },
        ],
      },
    ],
    build(v) {
      const cli = new CliWriter();
      cli.config('system zone', () => {
        cli.edit(str(v, 'name'), () => {
          cli.set('intrazone', str(v, 'intrazone'));
          cli.setq('interface', ...list(v, 'interfaces'));
        });
      });
      return {
        script: cli.toString(),
        notes: ['Interfaces referenciadas por políticas ou rotas não podem entrar numa zona: remova essas referências antes.'],
      };
    },
  },

  {
    id: 'static-route',
    category: CATEGORY,
    title: 'Rota estática',
    description: 'Rota para rede de destino via gateway/interface, com blackhole opcional.',
    fields: [
      { name: 'dst', label: 'Rede de destino', type: 'text', required: true, format: 'subnet', placeholder: '10.10.0.0/16 ou 0.0.0.0/0' },
      { name: 'device', label: 'Interface de saída', type: 'text', required: true, format: 'name', placeholder: 'wan1 / VPN-FILIAL' },
      { name: 'gateway', label: 'Gateway (vazio em túnel IPsec)', type: 'text', format: 'ipv4' },
      { name: 'distance', label: 'Distância administrativa', type: 'number', default: '10', min: 1, max: 255 },
      { name: 'blackhole', label: 'Adicionar rota blackhole (distância 254) para a mesma rede', type: 'checkbox', default: false },
      { name: 'comment', label: 'Comentário', type: 'text', format: 'name', maxLength: 255 },
    ],
    build(v) {
      const cli = new CliWriter();
      cli.config('router static', () => {
        cli.edit(0, () => {
          cli.set('dst', str(v, 'dst'));
          if (str(v, 'gateway')) cli.set('gateway', str(v, 'gateway'));
          cli.setq('device', str(v, 'device'));
          if (str(v, 'distance') !== '10') cli.set('distance', str(v, 'distance'));
          if (str(v, 'comment')) cli.setq('comment', str(v, 'comment'));
        });
        if (bool(v, 'blackhole')) {
          cli.edit(0, () => cli.set('dst', str(v, 'dst')).set('blackhole', 'enable').set('distance', 254));
        }
      });
      return { script: cli.toString(), notes: [] };
    },
  },
];
