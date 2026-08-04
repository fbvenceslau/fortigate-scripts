import type { IInterfacePayload } from '../types.ts';

export class InterfaceGenerator {
  public static generateInterface(payload: IInterfacePayload): string {
    const aliasLine = payload.alias ? `\n        set alias "${payload.alias}"` : '';
    const accessLine = payload.allowAccess ? `\n        set allowaccess ${payload.allowAccess}` : '';

    return `
config system interface
    edit "${payload.name}"
        set vdom "root"
        set ip ${payload.ip} ${payload.mask}${aliasLine}${accessLine}
    next
end
`.trim();
  }
}