import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * The Shahparpay "S" mark, traced from src/assets/icon.png as vectors so it
 * stays sharp at any size and takes any colour (the PNG is black on white,
 * with the company name under it).
 */
export const BrandMark: React.FC<{ size?: number; color: string }> = ({ size = 28, color }) => (
  <Svg width={size} height={size * (535 / 520)} viewBox="270 150 520 535" accessibilityLabel="Shahparpay">
    <Path fill={color} d="M515 160 L670 160 Q700 160 712 188 L775 375 L640 375 Q600 375 585 340 Z" />
    <Path
      fill={color}
      d="M360 160 L470 160 L560 360 Q580 410 630 410 L735 410 L770 590 Q780 675 700 675 L580 675 L490 485 Q470 438 420 438 L405 438 L322 220 Q305 160 360 160 Z"
    />
    <Path fill={color} d="M285 465 L420 465 Q460 465 475 500 L540 675 L410 675 Q365 675 350 630 Z" />
  </Svg>
);

export default BrandMark;
