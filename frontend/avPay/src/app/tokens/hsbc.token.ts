import { InjectionToken } from '@angular/core';

export interface HSBCConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  signingKey: string;
  corporateAccountId: string;
  baseUrl: string;
  enabled: boolean;
}

export const HSBC_CONFIG = new InjectionToken<HSBCConfig>('hsbc.config');
