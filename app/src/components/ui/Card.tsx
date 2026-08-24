import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
  variant?: 'default' | 'glass' | 'outlined';
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  style,
  variant = 'default',
  padding = 16,
}) => {
  const baseStyles = [
    styles.base,
    variantStyles[variant],
    { padding },
    style,
  ];

  return <View style={baseStyles}>{children}</View>;
};

const variantStyles = {
  default: {
    backgroundColor: 'var(--card)',
    borderWidth: 1,
    borderColor: 'var(--border)',
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
    backdropFilter: 'blur(20px)',
  },
  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'var(--border)',
    borderRadius: 16,
  },
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string; style?: ViewStyle }> = ({
  children,
  className = '',
  style,
}) => (
  <View style={[styles.header, style]}>{children}</View>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <Text style={[styles.title, className]}>{children}</Text>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <Text style={[styles.description, className]}>{children}</Text>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string; style?: ViewStyle }> = ({
  children,
  className = '',
  style,
}) => (
  <View style={[styles.content, style]}>{children}</View>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string; style?: ViewStyle }> = ({
  children,
  className = '',
  style,
}) => (
  <View style={[styles.footer, style]}>{children}</View>
);

const { Text } = require('react-native');

const styles = StyleSheet.create({
  header: {
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: 'var(--card-foreground)',
  },
  description: {
    fontSize: 13,
    color: 'var(--muted-foreground)',
    marginTop: 2,
  },
  content: {},
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'var(--border)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});

export default Card;