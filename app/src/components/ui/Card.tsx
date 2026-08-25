import React from 'react';
import { View, Text, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { themed } from '../../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'glass' | 'outlined';
  padding?: number;
}

const variantStyles = themed((c) => ({
  default: {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
  },
}));

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default', padding = 16 }) => (
  <View style={[styles.base, variantStyles[variant], { padding }, style]}>{children}</View>
);

export const CardHeader: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[styles.header, style]}>{children}</View>
);

export const CardTitle: React.FC<{ children: React.ReactNode; style?: StyleProp<TextStyle> }> = ({ children, style }) => (
  <Text style={[styles.title, style]}>{children}</Text>
);

export const CardDescription: React.FC<{ children: React.ReactNode; style?: StyleProp<TextStyle> }> = ({ children, style }) => (
  <Text style={[styles.description, style]}>{children}</Text>
);

export const CardContent: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[styles.content, style]}>{children}</View>
);

export const CardFooter: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[styles.footer, style]}>{children}</View>
);

const styles = themed((c) => ({
  base: {
    overflow: 'hidden',
  },
  header: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: c.cardForeground,
  },
  description: {
    fontSize: 13,
    color: c.mutedForeground,
    marginTop: 2,
  },
  content: {},
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
}));

export default Card;
