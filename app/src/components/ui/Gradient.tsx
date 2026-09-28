import React, { useId, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius as radii } from '../../theme/colors';

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

/** The website's SILVER_TILE: brushed icon chip used for services and wallets. */
export const IconTile: React.FC<{
  icon: string;
  size?: number;
  iconSize?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ icon, size = 40, iconSize = 19, radius = radii.sm, style }) => (
  <View style={[styles.tile, { width: size, height: size, borderRadius: radius }, style]}>
    <GradientFill stops={colors.tileGradient} diagonal radius={radius - 1} />
    <MaterialCommunityIcons name={icon as any} size={iconSize} color={colors.tileForeground} />
  </View>
);

const styles = themed((c) => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.tileRing,
    backgroundColor: c.tileGradient[c.tileGradient.length - 1],
  },
}));
