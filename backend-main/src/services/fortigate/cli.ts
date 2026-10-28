export const quote = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const quoteAll = (values: string[]): string => values.map(quote).join(' ');

export class CliWriter {
  private readonly lines: string[] = [];
  private depth = 0;

  private push(line: string): void {
    this.lines.push('    '.repeat(this.depth) + line);
  }

  config(path: string, body: () => void): this {
    this.push(`config ${path}`);
    this.depth++;
    body();
    this.depth--;
    this.push('end');
    return this;
  }

  // edit 0 cria uma entrada com o próximo ID livre; nomes vão entre aspas.
  edit(key: string | number, body: () => void): this {
    this.push(`edit ${typeof key === 'number' ? key : quote(key)}`);
    this.depth++;
    body();
    this.depth--;
    this.push('next');
    return this;
  }

  set(key: string, value: string | number): this {
    this.push(`set ${key} ${value}`);
    return this;
  }

  setq(key: string, ...values: string[]): this {
    this.push(`set ${key} ${quoteAll(values)}`);
    return this;
  }

  raw(line: string): this {
    this.push(line);
    return this;
  }

  blank(): this {
    this.lines.push('');
    return this;
  }

  toString(): string {
    return this.lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export const isIpv4 = (value: string): boolean => {
  const m = IPV4_RE.exec(value);
  return !!m && m.slice(1).every((octet) => Number(octet) <= 255 && String(Number(octet)) === octet);
};

export const ipToInt = (ip: string): number =>
  ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;

export const intToIp = (n: number): string =>
  [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');

export const prefixToMask = (prefix: number): string =>
  intToIp(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

export const maskToPrefix = (mask: string): number | null => {
  if (!isIpv4(mask)) return null;
  const n = ipToInt(mask);
  const prefix = n.toString(2).replace(/0+$/, '').length;
  return prefixToMask(prefix) === mask ? prefix : null;
};

export interface IpNet {
  ip: string;
  mask: string;
  prefix: number;
}

export interface ParseNetOptions {
  allowBareIp?: boolean;   // "10.0.0.5" vira /32
  allowHostBits?: boolean; // IP de interface (192.168.1.1/24)
}

// Aceita "192.168.1.0/24" ou "192.168.1.0 255.255.255.0". Retorna a mensagem de erro em string.
export const parseNet = (input: string, opts: ParseNetOptions = {}): IpNet | string => {
  const text = input.trim().replace(/\s+/g, ' ');
  let ip: string;
  let prefix: number | null;

  if (text.includes('/')) {
    const [addr = '', bits = ''] = text.split('/');
    ip = addr.trim();
    prefix = /^\d{1,2}$/.test(bits.trim()) && Number(bits) <= 32 ? Number(bits) : null;
    if (prefix === null) return 'Prefixo inválido (use /0 a /32)';
  } else if (text.includes(' ')) {
    const [addr = '', mask = ''] = text.split(' ');
    ip = addr;
    prefix = maskToPrefix(mask);
    if (prefix === null) return 'Máscara inválida';
  } else if (opts.allowBareIp) {
    ip = text;
    prefix = 32;
  } else {
    return 'Informe a máscara (ex.: 192.168.1.0/24 ou 192.168.1.0 255.255.255.0)';
  }

  if (!isIpv4(ip)) return 'Endereço IP inválido';
  const mask = prefixToMask(prefix);

  if (!opts.allowHostBits && (ipToInt(ip) & ipToInt(mask)) >>> 0 !== ipToInt(ip)) {
    const network = intToIp((ipToInt(ip) & ipToInt(mask)) >>> 0);
    return `Não é endereço de rede; para /${prefix} use ${network}`;
  }
  if (opts.allowHostBits && prefix < 31) {
    const host = ipToInt(ip) & ~ipToInt(mask);
    if (host === 0 || host === (~ipToInt(mask) >>> 0)) {
      return 'IP de interface não pode ser o endereço de rede nem o de broadcast';
    }
  }
  return { ip, mask, prefix };
};

export const netToString = (net: IpNet): string => `${net.ip} ${net.mask}`;

export const splitNet = (value: string): IpNet => {
  const [ip = '', mask = ''] = value.split(' ');
  return { ip, mask, prefix: maskToPrefix(mask) ?? 32 };
};

export const networkOf = (net: IpNet): string =>
  intToIp((ipToInt(net.ip) & ipToInt(net.mask)) >>> 0);

export const inNet = (ip: string, net: IpNet): boolean =>
  ((ipToInt(ip) & ipToInt(net.mask)) >>> 0) === ((ipToInt(net.ip) & ipToInt(net.mask)) >>> 0);

// Nome curto para objetos gerados a partir de uma rede: 192.168.10.0/24 -> 192.168.10.0_24
export const netLabel = (net: IpNet): string => `${networkOf(net)}_${net.prefix}`;
