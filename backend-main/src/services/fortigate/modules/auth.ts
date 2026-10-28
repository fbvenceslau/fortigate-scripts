import { CliWriter } from '../cli.ts';
import type { TemplateDef } from '../types.ts';
import { bool, list, str } from '../validate.ts';

export const authTemplates: TemplateDef[] = [
  {
    id: 'radius-portal',
    category: 'Autenticação',
    title: 'RADIUS + captive portal',
    description: 'Servidor RADIUS, grupo de usuários e captive portal (interno ou externo) com walled garden.',
    fields: [
      { name: 'radiusName', label: 'Nome do servidor RADIUS', type: 'text', required: true, format: 'name', maxLength: 35, placeholder: 'RADIUS-PORTAL' },
      { name: 'server', label: 'IP/FQDN do servidor', type: 'text', required: true, format: 'host' },
      { name: 'secret', label: 'Secret', type: 'password', required: true, maxLength: 128 },
      { name: 'nasIp', label: 'NAS IP (opcional)', type: 'text', format: 'ipv4', help: 'IP com que o FortiGate se identifica no RADIUS.' },
      { name: 'accounting', label: 'Enviar accounting para o mesmo servidor', type: 'checkbox', default: true },
      { name: 'group', label: 'Grupo de usuários', type: 'text', required: true, format: 'name', maxLength: 35, default: 'GRP-RADIUS' },
      { name: 'portal', label: 'Aplicar captive portal numa interface', type: 'checkbox', default: true, section: 'Captive portal' },
      { name: 'interface', label: 'Interface/VLAN de visitantes', type: 'text', required: true, format: 'name', placeholder: 'WIFI-VISITANTES', showIf: { field: 'portal', equals: [true] } },
      { name: 'externalUrl', label: 'URL do portal externo (vazio = portal do FortiGate)', type: 'text', format: 'url', showIf: { field: 'portal', equals: [true] } },
      { name: 'redirectUrl', label: 'Redirecionar após login (opcional)', type: 'text', format: 'url', showIf: { field: 'portal', equals: [true] } },
      { name: 'walledGarden', label: 'Domínios liberados antes do login', type: 'list', format: 'fqdn', placeholder: 'portal.provedor.com.br, *.provedor.com.br', showIf: { field: 'portal', equals: [true] } },
    ],
    build(v) {
      const radius = str(v, 'radiusName');
      const iface = str(v, 'interface');
      const garden = list(v, 'walledGarden');
      const exemptName = `EXEMPT-${iface}`.slice(0, 35);
      const cli = new CliWriter();

      cli.config('user radius', () => {
        cli.edit(radius, () => {
          cli.setq('server', str(v, 'server'));
          cli.setq('secret', str(v, 'secret'));
          if (str(v, 'nasIp')) cli.set('nas-ip', str(v, 'nasIp'));
          cli.set('auth-type', 'auto');
          if (bool(v, 'accounting')) {
            cli.config('accounting-server', () => {
              cli.edit(1, () => {
                cli.set('status', 'enable');
                cli.setq('server', str(v, 'server'));
                cli.setq('secret', str(v, 'secret'));
              });
            });
          }
        });
      });

      cli.config('user group', () => {
        cli.edit(str(v, 'group'), () => cli.setq('member', radius));
      });

      if (bool(v, 'portal')) {
        if (garden.length) {
          cli.config('firewall address', () => {
            garden.forEach((fqdn) => cli.edit(`WG-${fqdn.replace(/^\*\./, 'wildcard.')}`, () => cli.set('type', 'fqdn').setq('fqdn', fqdn)));
          });
          cli.config('user security-exempt-list', () => {
            cli.edit(exemptName, () => {
              cli.config('rule', () => {
                cli.edit(1, () => cli.setq('dstaddr', ...garden.map((f) => `WG-${f.replace(/^\*\./, 'wildcard.')}`)));
              });
            });
          });
        }
        cli.config('system interface', () => {
          cli.edit(iface, () => {
            cli.set('security-mode', 'captive-portal');
            if (str(v, 'externalUrl')) cli.setq('security-external-web', str(v, 'externalUrl'));
            if (str(v, 'redirectUrl')) cli.setq('security-redirect-url', str(v, 'redirectUrl'));
            if (garden.length) cli.setq('security-exempt-list', exemptName);
            cli.setq('security-groups', str(v, 'group'));
          });
        });
      }

      const notes = [
        `Teste antes: diagnose test authserver radius ${radius} pap <usuario> <senha>`,
        'Cadastre o FortiGate como NAS/cliente no servidor RADIUS com o mesmo secret.',
      ];
      if (bool(v, 'portal')) {
        notes.push('A interface ainda precisa de política de saída para a internet e de DNS liberado para os visitantes.');
        if (str(v, 'externalUrl') && !garden.length) {
          notes.push('Portal externo sem walled garden: o visitante não consegue abrir a página de login. Inclua o domínio do portal.');
        }
      }
      return { script: cli.toString(), notes };
    },
  },
];
