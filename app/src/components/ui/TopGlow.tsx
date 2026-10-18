import React, { useId } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';

/**
 * BHIM's signature backdrop: a warm orange light from the top-left and a green
 * one from the top-right, both fading into the ground before the content
 * starts. Purely decorative — it never takes touches.
 */
export const TopGlow: React.FC<{ height?: number }> = ({ height = 420 }) => {
  const { width } = useWindowDimensions();
  // SVG ids are document-global on web: with several screens mounted, a shared
  // id resolved to a hidden screen's gradient and the glow vanished.
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`${id}w`} cx="0" cy="0" rx={width * 0.9} ry={height * 0.8} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.glowWarm} stopOpacity={colors.glowStrength} />
            <Stop offset="1" stopColor={colors.glowWarm} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}g`} cx={width} cy="0" rx={width * 0.9} ry={height * 0.8} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={colors.glowGreen} stopOpacity={colors.glowStrength} />
            <Stop offset="1" stopColor={colors.glowGreen} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${id}w)`} />
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${id}g)`} />
      </Svg>
    </View>
  );
};

export default TopGlow;
