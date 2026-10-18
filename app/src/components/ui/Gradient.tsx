import React, { useId, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, Tone } from '../../theme/colors';

/**
 * Fills its parent with a linear gradient — the website's silver treatments.
 *
 * Painted at the MEASURED size, like the Dashboard wallet card: react-native-svg
 * resolves percentages against its own viewport, which left a flat seam at the
 * right and bottom edges. Until the first layout the parent's own
 * backgroundColor shows, so set one that matches the last stop.
 */
export const GradientFill: React.FC<{
  stops: string[];
  /** Top-left to bottom-right (Tailwind `to-br`); otherwise top to bottom. */
  diagonal?: boolean;
  radius?: number;
}> = ({ stops, diagonal = false, radius = 0 }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  // SVG ids are document-global on web; useId's colons are not valid in url().
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // SVG clamps rx and ry independently (rx to width/2, ry to height/2), so a
  // pill radius like 999 drew an ellipse. One clamp to the short side keeps
  // the corners circular and the ends fully rounded.
  const r = Math.min(radius, size.width / 2, size.height / 2);

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((prev) =>
          Math.abs(prev.width - width) > 0.5 || Math.abs(prev.height - height) > 0.5
            ? { width, height }
            : prev
        );
      }}
    >
      {size.width > 0 && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={diagonal ? '1' : '0'} y2="1">
              {stops.map((color, i) => (
                <Stop key={i} offset={stops.length > 1 ? i / (stops.length - 1) : 0} stopColor={color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={size.width}
            height={size.height}
            rx={r}
            ry={r}
            fill={`url(#${id})`}
          />
        </Svg>
      )}
    </View>
  );
};

/** Icon -> chip tone, so each service keeps one colour everywhere it appears.
 *  Unlisted icons get a stable tone from their name. */
const TONE_FOR: Record<string, Tone> = {
  fingerprint: 'blue',
  'credit-card-outline': 'orange',
  'bank-transfer': 'green',
  'cash-fast': 'purple',
  cellphone: 'teal',
  receipt: 'orange',
  'link-variant': 'pink',
  'qrcode-plus': 'blue',
  qrcode: 'pink',
  'hand-coin-outline': 'green',
  'card-account-details-outline': 'blue',
  'file-document-outline': 'green',
  'account-plus-outline': 'pink',
  'shield-check-outline': 'purple',
  headset: 'pink',
  'bank-outline': 'orange',
  plus: 'blue',
};
const TONES: Tone[] = ['blue', 'orange', 'green', 'purple', 'pink', 'teal'];

/**
 * The fixed order chips take across a grid or list: green, red, orange, then
 * the brand colour (navy in light, white in dark), repeating. Every four-up
 * row therefore reads the same left to right, on every screen.
 */
export const TONE_SEQUENCE: Tone[] = ['green', 'red', 'orange', 'blue'];
export const toneAt = (index: number): Tone => TONE_SEQUENCE[index % TONE_SEQUENCE.length];
export const toneFor = (icon: string): Tone =>
  TONE_FOR[icon] ?? TONES[[...icon].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];

/**
 * BHIM draws its icons as thin line glyphs. Ionicons' outline set is the
 * closest match, so the common MaterialCommunityIcons names call sites use are
 * mapped onto it here; anything unmapped still renders from MCI.
 */
const LINE_ICON: Record<string, string> = {
  fingerprint: 'finger-print-outline',
  'credit-card-outline': 'card-outline',
  'credit-card-plus-outline': 'card-outline',
  'bank-transfer': 'swap-horizontal-outline',
  'bank-transfer-out': 'swap-horizontal-outline',
  'swap-horizontal': 'swap-horizontal-outline',
  cellphone: 'phone-portrait-outline',
  receipt: 'receipt-outline',
  qrcode: 'qr-code-outline',
  'qrcode-plus': 'qr-code-outline',
  'wallet-outline': 'wallet-outline',
  'wallet-plus-outline': 'wallet-outline',
  'hand-coin-outline': 'cash-outline',
  'cash-multiple': 'cash-outline',
  'cash-plus': 'cash-outline',
  'cash-fast': 'flash-outline',
  'lightning-bolt': 'flash-outline',
  'cash-refund': 'refresh-outline',
  'card-account-details-outline': 'id-card-outline',
  'file-document-outline': 'document-text-outline',
  'text-box-outline': 'document-text-outline',
  'account-plus-outline': 'person-add-outline',
  'account-outline': 'person-outline',
  'shield-check-outline': 'shield-checkmark-outline',
  'check-decagram-outline': 'shield-checkmark-outline',
  'bank-outline': 'business-outline',
  dialpad: 'keypad-outline',
  'lock-outline': 'lock-closed-outline',
  'theme-light-dark': 'contrast-outline',
  'help-circle-outline': 'help-circle-outline',
  headset: 'headset-outline',
  'link-variant': 'link-outline',
  'store-outline': 'storefront-outline',
  'ticket-percent-outline': 'pricetag-outline',
  history: 'time-outline',
  plus: 'add',
};

/** Round icon chip — BHIM's grey circle with a thin line icon. */
export const IconTile: React.FC<{
  icon: string;
  size?: number;
  iconSize?: number;
  /** Defaults to a circle. */
  radius?: number;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, size = 40, iconSize = 19, radius, tone, style }) => {
  const { bg, fg } = colors.tones[tone ?? toneFor(icon)];
  const line = LINE_ICON[icon];
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius ?? size / 2, backgroundColor: bg },
        style,
      ]}
    >
      {line ? (
        <Ionicons name={line as any} size={iconSize + 2} color={fg} />
      ) : (
        <MaterialCommunityIcons name={icon as any} size={iconSize} color={fg} />
      )}
    </View>
  );
};

const styles = themed(() => ({
  tile: { alignItems: 'center', justifyContent: 'center' },
}));
