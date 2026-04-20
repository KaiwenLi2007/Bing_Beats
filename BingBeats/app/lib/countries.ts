export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

// A curated list of countries with strong and diverse music scenes.
export const COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" }
];

export function flagEmoji(code: string): string {
  const upperCode = code.trim().toUpperCase();
  if (upperCode.length !== 2) {
    return "";
  }

  const first = upperCode.charCodeAt(0);
  const second = upperCode.charCodeAt(1);
  const aCode = "A".charCodeAt(0);
  const zCode = "Z".charCodeAt(0);

  if (first < aCode || first > zCode || second < aCode || second > zCode) {
    return "";
  }

  return String.fromCodePoint(
    0x1f1e6 + (first - aCode),
    0x1f1e6 + (second - aCode)
  );
}
