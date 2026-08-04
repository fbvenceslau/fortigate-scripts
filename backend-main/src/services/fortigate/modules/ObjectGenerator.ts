import type { IAddressPayload } from '../types.ts';

export class ObjectGenerator {
  public static generateAddress(payload: IAddressPayload): string {
    return `
config firewall address
    edit "${payload.name}"
        set type ipmask
        set subnet ${payload.ip} ${payload.mask}
    next
end
`.trim();
  }

  // Pode adicionar generateAddressGroup, generateService, etc.
}