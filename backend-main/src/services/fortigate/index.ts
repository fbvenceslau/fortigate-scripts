import { ObjectGenerator } from './modules/ObjectGenerator.ts';
import { InterfaceGenerator } from './modules/InterfaceGenerator.ts';
import { VpnGenerator } from './modules/VpnGenerator.ts';
import type { IAddressPayload, IInterfacePayload, IVpnS2SPayload } from './types.ts';

export class FortigateGenerator {
  
  // Delega para o ObjectGenerator
  public createAddress(payload: IAddressPayload): string {
    return ObjectGenerator.generateAddress(payload);
  }

  // Delega para o InterfaceGenerator
  public createInterface(payload: IInterfacePayload): string {
    return InterfaceGenerator.generateInterface(payload);
  }

  // Delega para o VpnGenerator
  public createVpnSiteToSite(payload: IVpnS2SPayload): string {
    return VpnGenerator.generateSiteToSite(payload);
  }
}