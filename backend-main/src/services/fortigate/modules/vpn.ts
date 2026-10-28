import { CliWriter, netLabel, splitNet } from '../cli.ts';
import { ValidationError, type FieldDef, type TemplateDef } from '../types.ts';
import { bool, list, str } from '../validate.ts';
import { addressBlock, groupBlock } from './objects.ts';
import { writePolicy } from './policies.ts';

const CATEGORY = 'VPN IPsec';

// Proposta de phase1 -> proposta equivalente na phase2.
const PROPOSALS: Record<string, { label: string; p2: string; ikev2Only?: boolean }> = {
  'aes256-sha256': { label: 'AES256-SHA256', p2: 'aes256-sha256' },
  'aes256gcm-prfsha384': { label: 'AES256-GCM / PRF-SHA384 (só IKEv2)', p2: 'aes256gcm', ikev2Only: true },
  'aes128-sha256 aes256-sha256': { label: 'AES128-SHA256 + AES256-SHA256', p2: 'aes128-sha256 aes256-sha256' },
  'aes256-sha1': { label: 'AES256-SHA1 (legado)', p2: 'aes256-sha1' },
};

const DH_GROUPS = ['14', '15', '19', '20', '21', '5'];

const tunnelNameField: FieldDef = {
  name: 'name', label: 'Nome do túnel', type: 'text', required: true, format: 'name', maxLength: 15,
  placeholder: 'VPN-FILIAL01', help: 'Vira nome de interface: máximo de 15 caracteres.',
};

const pskNotes = (psk: string): string[] =>
  psk.includes('?')
    ? ['A PSK contém "?": no console do FortiGate o "?" abre a ajuda. Digite Ctrl+V antes dele ou troque o caractere.']
    : [];

const objectName = (cidr: string): string => `NET_${netLabel(splitNet(cidr))}`;

export const vpnTemplates: TemplateDef[] = [
  {
    id: 'vpn-s2s',
    category: CATEGORY,
    title: 'Site-to-site',
    description: 'Túnel IPsec completo: objetos, phase1/phase2, rotas com blackhole e políticas nos dois sentidos.',
    fields: [
      tunnelNameField,
      { name: 'wanIntf', label: 'Interface WAN', type: 'text', required: true, format: 'name', default: 'wan1' },
      {
        name: 'remoteType', label: 'Peer remoto', type: 'select', default: 'static',
        options: [{ value: 'static', label: 'IP fixo' }, { value: 'ddns', label: 'FQDN / DDNS' }],
      },
      { name: 'remoteGw', label: 'IP público do peer', type: 'text', required: true, format: 'ipv4', showIf: { field: 'remoteType', equals: ['static'] } },
      { name: 'remoteFqdn', label: 'FQDN do peer', type: 'text', required: true, format: 'fqdn', showIf: { field: 'remoteType', equals: ['ddns'] } },
      { name: 'psk', label: 'Pre-shared key', type: 'password', required: true, maxLength: 128 },
      {
        name: 'ikeVersion', label: 'IKE', type: 'select', default: '2', section: 'Criptografia',
        options: [{ value: '2', label: 'IKEv2' }, { value: '1', label: 'IKEv1 (main mode)' }],
      },
      {
        name: 'proposal', label: 'Proposta', type: 'select', default: 'aes256-sha256',
        options: Object.entries(PROPOSALS).map(([value, p]) => ({ value, label: p.label })),
      },
      { name: 'dhgrp', label: 'DH group (phase1 e PFS)', type: 'select', default: '14', options: DH_GROUPS.map((g) => ({ value: g, label: g === '5' ? '5 (legado)' : g })) },
      { name: 'keylife1', label: 'Lifetime phase1 (s)', type: 'number', default: '86400', min: 120, max: 172800 },
      { name: 'keylife2', label: 'Lifetime phase2 (s)', type: 'number', default: '43200', min: 120, max: 172800 },
      { name: 'localid', label: 'Local ID (opcional)', type: 'text', format: 'name', maxLength: 63, help: 'Use quando houver mais de um túnel para o mesmo peer; o outro lado configura como peer ID.' },
      { name: 'localNets', label: 'Redes locais', type: 'list', required: true, format: 'subnet', placeholder: '192.168.1.0/24, 192.168.2.0/24', section: 'Redes' },
      { name: 'remoteNets', label: 'Redes remotas', type: 'list', required: true, format: 'subnet', placeholder: '10.10.0.0/24' },
      { name: 'routes', label: 'Criar rotas estáticas + blackhole', type: 'checkbox', default: true },
      { name: 'policies', label: 'Criar políticas LAN ⇄ VPN', type: 'checkbox', default: true },
      { name: 'lanIntf', label: 'Interface/zona da LAN', type: 'text', required: true, format: 'name', default: 'internal', showIf: { field: 'policies', equals: [true] } },
      { name: 'service', label: 'Serviços permitidos', type: 'list', format: 'name', default: 'ALL', showIf: { field: 'policies', equals: [true] } },
    ],
    build(v) {
      const name = str(v, 'name');
      const proposal = PROPOSALS[str(v, 'proposal')];
      const ikev2 = str(v, 'ikeVersion') === '2';
      if (proposal?.ikev2Only && !ikev2) {
        throw new ValidationError({ proposal: 'AES-GCM com PRF só é suportado em IKEv2' });
      }
      const localNets = list(v, 'localNets');
      const remoteNets = list(v, 'remoteNets');
      const pairs = localNets.flatMap((l) => remoteNets.map((r) => [l, r] as const));
      if (pairs.length > 20) {
        throw new ValidationError({ remoteNets: `${pairs.length} pares de seletores: agrupe as redes (máximo 20 pares)` });
      }
      const localGroup = `${name}-LOCAL`;
      const remoteGroup = `${name}-REMOTE`;
      const cli = new CliWriter();

      if (bool(v, 'policies')) {
        addressBlock(cli, [...localNets, ...remoteNets].map((cidr) => ({ name: objectName(cidr), subnet: cidr })));
        groupBlock(cli, localGroup, localNets.map(objectName));
        groupBlock(cli, remoteGroup, remoteNets.map(objectName));
      }

      cli.config('vpn ipsec phase1-interface', () => {
        cli.edit(name, () => {
          cli.setq('interface', str(v, 'wanIntf'));
          if (ikev2) cli.set('ike-version', 2);
          cli.set('peertype', 'any');
          cli.set('net-device', 'disable');
          cli.set('proposal', str(v, 'proposal'));
          cli.set('dhgrp', str(v, 'dhgrp'));
          if (str(v, 'localid')) cli.setq('localid', str(v, 'localid'));
          cli.set('dpd', 'on-idle');
          if (str(v, 'keylife1') !== '86400') cli.set('keylife', str(v, 'keylife1'));
          if (str(v, 'remoteType') === 'ddns') cli.set('type', 'ddns').setq('remotegw-ddns', str(v, 'remoteFqdn'));
          else cli.set('remote-gw', str(v, 'remoteGw'));
          cli.setq('psksecret', str(v, 'psk'));
        });
      });

      cli.config('vpn ipsec phase2-interface', () => {
        pairs.forEach(([local, remote], i) => {
          cli.edit(pairs.length === 1 ? `${name}-P2` : `${name}-P2-${i + 1}`, () => {
            cli.setq('phase1name', name);
            cli.set('proposal', proposal?.p2 ?? 'aes256-sha256');
            cli.set('dhgrp', str(v, 'dhgrp'));
            cli.set('auto-negotiate', 'enable');
            if (str(v, 'keylife2') !== '43200') cli.set('keylifeseconds', str(v, 'keylife2'));
            cli.set('src-subnet', local);
            cli.set('dst-subnet', remote);
          });
        });
      });

      if (bool(v, 'routes')) {
        cli.config('router static', () => {
          for (const remote of remoteNets) {
            cli.edit(0, () => cli.set('dst', remote).setq('device', name).setq('comment', `VPN ${name}`));
            cli.edit(0, () =>
              cli.set('dst', remote).set('blackhole', 'enable').set('distance', 254).setq('comment', `Blackhole VPN ${name}`),
            );
          }
        });
      }

      if (bool(v, 'policies')) {
        const service = list(v, 'service').length ? list(v, 'service') : ['ALL'];
        const lan = str(v, 'lanIntf');
        cli.config('firewall policy', () => {
          writePolicy(cli, { name: `${lan}->${name}`, srcintf: [lan], dstintf: [name], srcaddr: [localGroup], dstaddr: [remoteGroup], service, action: 'accept' });
          writePolicy(cli, { name: `${name}->${lan}`, srcintf: [name], dstintf: [lan], srcaddr: [remoteGroup], dstaddr: [localGroup], service, action: 'accept' });
        });
      }

      const p2Proposal = proposal?.p2 ?? '';
      const notes = [
        `Do outro lado: IKEv${ikev2 ? 2 : 1}, phase1 ${str(v, 'proposal')} DH ${str(v, 'dhgrp')} ${str(v, 'keylife1')}s; phase2 ${p2Proposal} PFS DH ${str(v, 'dhgrp')} ${str(v, 'keylife2')}s; mesma PSK e redes invertidas (local ⇄ remota).`,
        `${pairs.length} seletor(es) de phase2: o peer precisa ter exatamente os mesmos pares de redes, senão o túnel sobe e cai.`,
        ...pskNotes(str(v, 'psk')),
      ];
      if (str(v, 'localid')) notes.push(`No peer, configure peer ID = "${str(v, 'localid')}".`);
      if (!bool(v, 'policies')) notes.push('Sem políticas o túnel não sobe por tráfego: crie ao menos uma política usando a interface do túnel.');
      return { script: cli.toString(), notes };
    },
  },

  {
    id: 'vpn-dialup',
    category: CATEGORY,
    title: 'Acesso remoto (FortiClient)',
    description: 'IPsec dial-up com XAuth por grupo de usuários, pool de IPs, split tunnel e política.',
    fields: [
      tunnelNameField,
      { name: 'wanIntf', label: 'Interface WAN', type: 'text', required: true, format: 'name', default: 'wan1' },
      { name: 'psk', label: 'Pre-shared key', type: 'password', required: true, maxLength: 128 },
      { name: 'userGroup', label: 'Grupo de usuários (XAuth)', type: 'text', required: true, format: 'name', placeholder: 'GRP-VPN-USUARIOS' },
      { name: 'poolStart', label: 'Pool: IP inicial', type: 'text', required: true, format: 'ipv4', default: '10.212.134.200', section: 'Endereçamento do cliente' },
      { name: 'poolEnd', label: 'Pool: IP final', type: 'text', required: true, format: 'ipv4', default: '10.212.134.250' },
      {
        name: 'dnsMode', label: 'DNS do cliente', type: 'select', default: 'auto',
        options: [{ value: 'auto', label: 'Automático (DNS do FortiGate)' }, { value: 'manual', label: 'Manual' }],
      },
      { name: 'dnsServers', label: 'Servidores DNS', type: 'list', required: true, format: 'ipv4', placeholder: '192.168.1.10, 192.168.1.11', showIf: { field: 'dnsMode', equals: ['manual'] } },
      { name: 'split', label: 'Split tunnel (só as redes internas passam pela VPN)', type: 'checkbox', default: true, section: 'Acesso' },
      { name: 'splitNets', label: 'Redes internas acessíveis', type: 'list', required: true, format: 'subnet', placeholder: '192.168.1.0/24', showIf: { field: 'split', equals: [true] } },
      { name: 'lanIntf', label: 'Interface/zona da LAN', type: 'text', required: true, format: 'name', default: 'internal' },
    ],
    build(v) {
      const name = str(v, 'name');
      const split = bool(v, 'split');
      const pool = `${name}-POOL`;
      const splitGroup = `${name}-SPLIT`;
      const splitNets = list(v, 'splitNets');
      const cli = new CliWriter();

      cli.config('firewall address', () => {
        cli.edit(pool, () => cli.set('type', 'iprange').set('start-ip', str(v, 'poolStart')).set('end-ip', str(v, 'poolEnd')));
      });
      if (split) {
        addressBlock(cli, splitNets.map((cidr) => ({ name: objectName(cidr), subnet: cidr })));
        groupBlock(cli, splitGroup, splitNets.map(objectName));
      }

      cli.config('vpn ipsec phase1-interface', () => {
        cli.edit(name, () => {
          cli.set('type', 'dynamic');
          cli.setq('interface', str(v, 'wanIntf'));
          cli.set('mode', 'aggressive');
          cli.set('peertype', 'any');
          cli.set('net-device', 'disable');
          cli.set('mode-cfg', 'enable');
          cli.set('proposal', 'aes256-sha256');
          cli.set('dpd', 'on-idle');
          cli.set('dhgrp', 14);
          cli.set('xauthtype', 'auto');
          cli.setq('authusrgrp', str(v, 'userGroup'));
          cli.set('ipv4-start-ip', str(v, 'poolStart'));
          cli.set('ipv4-end-ip', str(v, 'poolEnd'));
          cli.set('ipv4-netmask', '255.255.255.255');
          if (str(v, 'dnsMode') === 'manual') {
            cli.set('dns-mode', 'manual');
            list(v, 'dnsServers').slice(0, 3).forEach((dns, i) => cli.set(`ipv4-dns-server${i + 1}`, dns));
          } else {
            cli.set('dns-mode', 'auto');
          }
          if (split) cli.setq('ipv4-split-include', splitGroup);
          cli.set('save-password', 'enable');
          cli.set('client-auto-negotiate', 'enable');
          cli.set('client-keep-alive', 'enable');
          cli.setq('psksecret', str(v, 'psk'));
          cli.set('dpd-retryinterval', 60);
        });
      });

      cli.config('vpn ipsec phase2-interface', () => {
        cli.edit(name, () => {
          cli.setq('phase1name', name);
          cli.set('proposal', 'aes256-sha256');
          cli.set('dhgrp', 14);
        });
      });

      const lan = str(v, 'lanIntf');
      const wan = str(v, 'wanIntf');
      cli.config('firewall policy', () => {
        writePolicy(cli, { name: `${name}->${lan}`, srcintf: [name], dstintf: [lan], srcaddr: [pool], dstaddr: [split ? splitGroup : 'all'], service: ['ALL'], action: 'accept' });
        if (!split) {
          writePolicy(cli, { name: `${name}->INTERNET`, srcintf: [name], dstintf: [wan], srcaddr: [pool], dstaddr: ['all'], service: ['ALL'], action: 'accept', nat: true });
        }
      });

      return {
        script: cli.toString(),
        notes: [
          `O grupo "${str(v, 'userGroup')}" precisa existir (usuários locais, LDAP ou RADIUS).`,
          'No FortiClient: IPsec VPN, gateway remoto = IP da WAN, autenticação PSK + XAuth com usuário e senha.',
          ...pskNotes(str(v, 'psk')),
        ],
      };
    },
  },
];
