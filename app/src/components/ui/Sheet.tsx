import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { useResponsive } from '@/hooks/useResponsive';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
  /** Pinned below the scroll area — put the primary action here. */
  footer?: React.ReactNode;
  /** Blocks tap-outside and hides the close button while work is in flight. */
  dismissible?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Bottom sheet used for every modal flow (eKYC, daily auth, receipts,
 * confirmations). Rises from the bottom for spatial continuity with the
 * button that opened it, keeps the handle + close button as two visible
 * escape routes, and never lets its content run under the gesture bar.
 */
export const Sheet: React.FC<SheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  dismissible = true,
  contentStyle,
}) => {
  const insets = useSafeAreaInsets();
  const { padding } = useResponsive();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      // Android hardware back is the platform's own escape route.
      onRequestClose={dismissible ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={dismissible ? onClose : undefined}
          accessibilityRole="button"
          accessibilityLabel="Close"
          // The visible close button carries the label; this is the tap-out area.
          importantForAccessibility="no"
        />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.handle} />

          <View style={[styles.header, { paddingHorizontal: padding }]}>
            {!!icon && (
              <View style={styles.headerIcon}>
                <MaterialCommunityIcons name={icon as any} size={20} color={colors.accent} />
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {dismissible && (
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: padding },
              contentStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {!!footer && <View style={[styles.footer, { paddingHorizontal: padding }]}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
};

/** Yes/no confirmation that needs richer content than Alert.alert can carry. */
export const ConfirmSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  icon?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
}> = ({ visible, onClose, title, message, icon = 'help-circle-outline', confirmLabel = 'Confirm', onConfirm, pending }) => (
  <Sheet visible={visible} onClose={onClose} title={title} icon={icon} dismissible={!pending}>
    <Text style={styles.message}>{message}</Text>
    <View style={styles.confirmRow}>
      <Pressable
        onPress={onClose}
        disabled={pending}
        style={({ pressed }) => [styles.confirmButton, styles.cancelButton, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={pending}
        style={({ pressed }) => [
          styles.confirmButton,
          styles.acceptButton,
          pending && { opacity: 0.5 },
          pressed && { opacity: 0.8 },
        ]}
        accessibilityRole="button"
        accessibilityState={{ busy: pending }}
      >
        <Text style={styles.acceptText}>{confirmLabel}</Text>
      </Pressable>
    </View>
  </Sheet>
);

const styles = themed((c) => ({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: c.overlay },
  sheet: {
    maxHeight: '92%',
    backgroundColor: c.popover,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderColor: c.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: c.borderStrong,
    marginTop: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: t.bodyLg, fontWeight: '700', color: c.popoverForeground },
  subtitle: { fontSize: t.caption, color: c.mutedForeground },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingVertical: space.lg, gap: space.lg },
  footer: {
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
    gap: space.sm,
  },
  message: { fontSize: t.body, color: c.foreground, lineHeight: 22 },
  confirmRow: { flexDirection: 'row', gap: space.sm },
  confirmButton: {
    flex: 1,
    minHeight: TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  cancelButton: { backgroundColor: c.secondary, borderColor: c.secondary },
  acceptButton: { backgroundColor: c.primary, borderColor: c.primary },
  cancelText: { fontSize: t.body, fontWeight: '700', color: c.secondaryForeground },
  acceptText: { fontSize: t.body, fontWeight: '700', color: c.primaryForeground },
}));

export default Sheet;
