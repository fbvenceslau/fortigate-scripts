import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNet } from '../src/services/fortigate/cli.ts';
import { generate, listTemplates, ValidationError } from '../src/services/fortigate/index.ts';

// Cada config/edit precisa ter seu end/next correspondente.
const assertBalanced = (script: string): void => {
  const stack: string[] = [];
  for (const line of script.split('\n').map((l) => l.trim())) {
    if (line.startsWith('config ')) stack.push('config');
    else if (line.startsWith('edit ')) stack.push('edit');
    else if (line === 'next') assert.equal(stack.pop(), 'edit', 'next sem edit');
    else if (line === 'end') assert.equal(stack.pop(), 'config', 'end sem config');
  }
  assert.deepEqual(stack, [], 'blocos não fechados');
};

const fieldErrors = (fn: () => unknown): Record<string, string> => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationError) return error.fieldErrors;
    throw error;
  }
  assert.fail('era esperado ValidationError');
};

// Payload mínimo válido para cada template.
const SAMPLES: Record<string, Record<string, unknown>> = {
  address: { name: 'SRV-WEB', subnet: '192.168.1.10' },
  'address-bulk': { entries: 'SRV-AD01;192.168.1.10\nREDE-CFTV;192.168.50.0/24', group: 'GRP-SRV' },
  'address-group': { name: 'GRP-SRV', members: 'SRV-AD01, SRV-AD02' },
  service: { name: 'TCP-8080', ports: '8080, 9000-9010', protocol: 'both' },
  'service-group': { name: 'GRP-SVC', members: 'HTTPS, RDP' },
  interface: { name: 'VLAN20', parent: 'internal', vlanId: '20', address: '192.168.20.1/24', dhcp: true, dhcpStart: '192.168.20.100', dhcpEnd: '192.168.20.200' },
  zone: { name: 'ZONA-LAN', interfaces: 'VLAN10, VLAN20' },
  'static-route': { dst: '10.10.0.0/16', device: 'wan1', gateway: '200.1.1.1', blackhole: true },
  policy: { name: 'LAN-INTERNET', srcintf: 'internal', dstintf: 'wan1', nat: true, utm: true },
  vip: { name: 'VIP-RDP', extip: '200.1.1.10', mappedip: '192.168.1.20', extport: '3389' },
  'vpn-s2s': { name: 'VPN-FILIAL01', remoteGw: '189.10.10.10', psk: 'S3nh@Forte', localNets: '192.168.1.0/24', remoteNets: '10.10.0.0/24, 10.20.0.0/24', localid: 'MATRIZ' },
  'vpn-dialup': { name: 'FCT-VPN', psk: 'chave', userGroup: 'GRP-VPN', splitNets: '192.168.1.0/24' },
  sdwan: { members: 'wan1;200.1.1.1\nwan2' },
  'radius-portal': { radiusName: 'RADIUS-PORTAL', server: '10.0.0.5', secret: 'segredo', interface: 'WIFI-VIS', externalUrl: 'https://portal.exemplo.com.br/login', walledGarden: 'portal.exemplo.com.br, *.cdn.exemplo.com' },
  'diag-vpn': { tunnel: 'VPN-FILIAL01', peer: '189.10.10.10', reset: true },
  'diag-flow': { saddr: '192.168.1.50', daddr: '8.8.8.8', proto: 'icmp' },
  'diag-sniffer': { host1: '192.168.1.50', port: '443', proto: 'tcp' },
  'diag-sdwan': { interface: 'wan1' },
  'diag-health': { interface: 'wan1', ha: true },
};

describe('catálogo', () => {
  it('todo template tem amostra e gera script balanceado', () => {
    for (const t of listTemplates()) {
      const sample = SAMPLES[t.id];
      assert.ok(sample, `sem amostra para ${t.id}`);
      const { script } = generate(t.id, sample);
      assert.ok(script.length > 0, t.id);
      assert.ok(!script.includes('undefined'), `${t.id} contém "undefined"`);
      assertBalanced(script);
    }
  });

  it('não expõe a função build no catálogo', () => {
    assert.ok(listTemplates().every((t) => !('build' in t)));
  });
});

describe('utilitários de rede', () => {
  it('aceita CIDR e máscara decimal', () => {
    assert.deepEqual(parseNet('192.168.1.0/24'), { ip: '192.168.1.0', mask: '255.255.255.0', prefix: 24 });
    assert.deepEqual(parseNet('10.0.0.0 255.255.0.0'), { ip: '10.0.0.0', mask: '255.255.0.0', prefix: 16 });
  });
  it('rejeita máscara não contígua e bits de host em rede', () => {
    assert.equal(typeof parseNet('10.0.0.0 255.0.255.0'), 'string');
    assert.match(String(parseNet('192.168.1.10/24')), /192\.168\.1\.0/);
  });
  it('IP de interface não pode ser rede nem broadcast', () => {
    assert.equal(typeof parseNet('192.168.1.0/24', { allowHostBits: true }), 'string');
    assert.equal(typeof parseNet('192.168.1.255/24', { allowHostBits: true }), 'string');
    assert.equal(typeof parseNet('192.168.1.1/24', { allowHostBits: true }), 'object');
  });
});

describe('VPN site-to-site', () => {
  const { script, notes } = generate('vpn-s2s', SAMPLES['vpn-s2s']);

  it('cria um seletor de phase2 por par de redes', () => {
    assert.match(script, /edit "VPN-FILIAL01-P2-1"[\s\S]*set src-subnet 192\.168\.1\.0 255\.255\.255\.0\n\s+set dst-subnet 10\.10\.0\.0 255\.255\.255\.0/);
    assert.match(script, /edit "VPN-FILIAL01-P2-2"[\s\S]*set dst-subnet 10\.20\.0\.0 255\.255\.255\.0/);
  });
  it('usa IKEv2, localid, auto-negotiate e PSK entre aspas', () => {
    assert.match(script, /set ike-version 2/);
    assert.match(script, /set localid "MATRIZ"/);
    assert.match(script, /set auto-negotiate enable/);
    assert.match(script, /set psksecret "S3nh@Forte"/);
  });
  it('cria rota e blackhole para cada rede remota', () => {
    assert.equal(script.match(/set blackhole enable/g)?.length, 2);
    assert.equal(script.match(/set device "VPN-FILIAL01"/g)?.length, 2);
  });
  it('cria políticas nos dois sentidos com os grupos', () => {
    assert.match(script, /set srcaddr "VPN-FILIAL01-LOCAL"\n\s+set dstaddr "VPN-FILIAL01-REMOTE"/);
    assert.match(script, /set srcaddr "VPN-FILIAL01-REMOTE"\n\s+set dstaddr "VPN-FILIAL01-LOCAL"/);
  });
  it('orienta a configuração do peer', () => {
    assert.ok(notes.some((n) => n.includes('peer ID = "MATRIZ"')));
  });
  it('valida nome de túnel com mais de 15 caracteres', () => {
    const errors = fieldErrors(() => generate('vpn-s2s', { ...SAMPLES['vpn-s2s'], name: 'VPN-FILIAL-GOIANIA' }));
    assert.ok(errors.name);
  });
  it('bloqueia GCM com IKEv1', () => {
    const errors = fieldErrors(() => generate('vpn-s2s', { ...SAMPLES['vpn-s2s'], ikeVersion: '1', proposal: 'aes256gcm-prfsha384' }));
    assert.ok(errors.proposal);
  });
  it('avisa sobre "?" na PSK', () => {
    const result = generate('vpn-s2s', { ...SAMPLES['vpn-s2s'], psk: 'abc?123' });
    assert.ok(result.notes.some((n) => n.includes('Ctrl+V')));
  });
});

describe('validações', () => {
  it('campos obrigatórios e formatos', () => {
    const errors = fieldErrors(() => generate('address', { name: 'X"Y', kind: 'subnet', subnet: '300.1.1.1' }));
    assert.ok(errors.name);
    assert.ok(errors.subnet);
  });
  it('campos ocultos por showIf não são exigidos', () => {
    assert.doesNotThrow(() => generate('address', { name: 'GOOGLE', kind: 'fqdn', fqdn: 'google.com' }));
  });
  it('faixa DHCP precisa estar na rede da interface', () => {
    const errors = fieldErrors(() => generate('interface', { ...SAMPLES.interface, dhcpEnd: '192.168.21.10' }));
    assert.ok(errors.dhcpEnd);
  });
  it('debug flow exige ao menos um filtro', () => {
    assert.ok(fieldErrors(() => generate('diag-flow', {})).saddr);
  });
});

describe('outros templates', () => {
  it('VIP alerta sobre RDP exposto e cria política com IPS', () => {
    const { script, notes } = generate('vip', SAMPLES.vip);
    assert.match(script, /set dstaddr "VIP-RDP"/);
    assert.match(script, /set ips-sensor "default"/);
    assert.ok(notes.some((n) => n.includes('RDP')));
  });
  it('dial-up sem split cria política de internet com NAT', () => {
    const { script } = generate('vpn-dialup', { ...SAMPLES['vpn-dialup'], split: false });
    assert.doesNotMatch(script, /ipv4-split-include/);
    assert.match(script, /set name "FCT-VPN->INTERNET"[\s\S]*set nat enable/);
  });
  it('debug de IKE muda a sintaxe por versão', () => {
    const v74 = generate('diag-vpn', { ...SAMPLES['diag-vpn'], version: '7.4' }).script;
    const v72 = generate('diag-vpn', { ...SAMPLES['diag-vpn'], version: '7.2' }).script;
    assert.match(v74, /diagnose vpn ike log filter rem-addr4 189\.10\.10\.10/);
    assert.match(v72, /diagnose vpn ike log-filter dst-addr4 189\.10\.10\.10/);
  });
  it('sniffer monta o filtro', () => {
    const { script } = generate('diag-sniffer', SAMPLES['diag-sniffer']);
    assert.equal(script, "diagnose sniffer packet any 'host 192.168.1.50 and tcp and port 443' 4 100 l");
  });
  it('SD-WAN usa os IDs dos membros no health check', () => {
    const { script } = generate('sdwan', SAMPLES.sdwan);
    assert.match(script, /set members 1 2/);
    assert.match(script, /set sdwan-zone "virtual-wan-link"/);
  });
  it('grupo em modo append não substitui membros', () => {
    const { script } = generate('address-group', { ...SAMPLES['address-group'], append: true });
    assert.match(script, /append member "SRV-AD01" "SRV-AD02"/);
  });
});
