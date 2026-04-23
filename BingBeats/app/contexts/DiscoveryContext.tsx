import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { CountryOption } from "../lib/countries";

type DiscoveryValue = {
  country: CountryOption | null;
  year: number | null;
  setCountry: (c: CountryOption | null) => void;
  setYear: (y: number | null) => void;
};

const DiscoveryContext = createContext<DiscoveryValue | null>(null);

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const [country, setCountry] = useState<CountryOption | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const value = useMemo(
    (): DiscoveryValue => ({
      country,
      year,
      setCountry,
      setYear
    }),
    [country, year]
  );

  return <DiscoveryContext.Provider value={value}>{children}</DiscoveryContext.Provider>;
}

export function useDiscovery(): DiscoveryValue {
  const ctx = useContext(DiscoveryContext);
  if (!ctx) {
    throw new Error("useDiscovery must be used within DiscoveryProvider");
  }
  return ctx;
}
