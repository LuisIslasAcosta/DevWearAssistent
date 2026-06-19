import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'mono' | 'label';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'mono' && styles.mono,
        type === 'label' && styles.label,
        style,
      ]}
      {...rest}
    />
  );
}

const monoFamily = Platform.select({
  ios: 'ui-monospace' as string,
  default: 'monospace' as string,
  web: 'var(--font-mono)',
});

const styles = StyleSheet.create({
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  smallBold: { fontSize: 13, lineHeight: 18, fontWeight: '700', letterSpacing: 0.2 },
  default: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  title: { fontSize: 44, fontWeight: '700', lineHeight: 48, letterSpacing: -1, fontFamily: monoFamily },
  subtitle: { fontSize: 22, lineHeight: 30, fontWeight: '600', letterSpacing: -0.3 },
  link: { lineHeight: 28, fontSize: 13, fontWeight: '500' },
  linkPrimary: { lineHeight: 28, fontSize: 13, color: '#3FB950', fontWeight: '500' },
  code: { fontFamily: monoFamily, fontWeight: Platform.select({ android: '700' }) ?? '500', fontSize: 12 },
  mono: { fontFamily: monoFamily, fontSize: 13, lineHeight: 18, letterSpacing: 0.5 },
  label: { fontFamily: monoFamily, fontSize: 10, fontWeight: '600', letterSpacing: 1.5, textTransform: 'uppercase' },
});