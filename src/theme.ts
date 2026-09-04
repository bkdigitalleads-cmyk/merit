import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textSecondary: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  danger: string;
  border: string;
  success: string;
  isDark: boolean;
}

// Merit palette: fresh service-green on paper-white. Day mode reads like a
// well-kept school form; night mode is deep evergreen with a bright mint
// accent — hopeful and civic, visually unrelated to our other apps.
export const lightTheme: Theme = {
  bg: '#F4F8F5',
  card: '#FFFFFF',
  cardAlt: '#E9F1EB',
  text: '#1D2823',
  textSecondary: '#54655C',
  textFaint: '#8FA096',
  accent: '#0F7B5F',
  accentSoft: '#D9EFE7',
  danger: '#C53030',
  border: '#DCE6DF',
  success: '#2F7D4F',
  isDark: false,
};

export const darkTheme: Theme = {
  bg: '#121815',
  card: '#1B2420',
  cardAlt: '#243029',
  text: '#EAF0EC',
  textSecondary: '#ABBCB2',
  textFaint: '#71847A',
  accent: '#4ED8A9',
  accentSoft: '#1C332A',
  danger: '#F56565',
  border: '#2C3832',
  success: '#68B587',
  isDark: true,
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export const fonts = {
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};
