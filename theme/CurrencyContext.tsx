import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getCurrency, setCurrency as saveCurrency, CurrencyCode } from '../storage/settings';

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('RUB');

  useEffect(() => {
    getCurrency().then(setCurrencyState);
  }, []);

  const setCurrency = useCallback(async (c: CurrencyCode) => {
    await saveCurrency(c);
    setCurrencyState(c);
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}

// Default export для совместимости с бандлером (Metro/Webpack)
export default { CurrencyProvider, useCurrency };
