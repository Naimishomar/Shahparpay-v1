import React from 'react';
import { View, Text, Image, Pressable, Alert } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t, TOUCH } from '../../theme/colors';
import { pickImage, type PickedFile } from '@/services/imagePicker';

/**
 * Attach-a-photo field for deposit slips and KYC documents. Camera and gallery
 * are both offered because retailers usually photograph a paper slip on the
 * spot, but sometimes already have the screenshot.
 */
export const ImageField: React.FC<{
  label: string;
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  helperText?: string;
  required?: boolean;
}> = ({ label, value, onChange, helperText, required }) => {
  const choose = () =>
    Alert.alert(label, 'Choose a source', [
      { text: 'Take a photo', onPress: async () => onChange((await pickImage('camera', label)) ?? value) },
      { text: 'Pick from gallery', onPress: async () => onChange((await pickImage('library', label)) ?? value) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      {value ? (
        <View style={styles.preview}>
          <Image source={{ uri: value.uri }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.previewText}>
            <Text style={styles.fileName} numberOfLines={1}>
              {value.name}
            </Text>
            <Pressable onPress={choose} hitSlop={8} accessibilityRole="button">
              <Text style={styles.replace}>Replace</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
            style={styles.remove}
          >
            <MaterialCommunityIcons name="close" size={18} color={colors.destructive} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={choose}
          style={({ pressed }) => [styles.dropzone, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={`Attach ${label}`}
        >
          <MaterialCommunityIcons name="camera-plus-outline" size={22} color={colors.mutedForeground} />
          <Text style={styles.dropzoneText}>Tap to attach a photo</Text>
        </Pressable>
      )}

      {!!helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
};

const styles = themed((c) => ({
  container: { gap: 6 },
  label: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  required: { color: c.destructive },
  dropzone: {
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
    backgroundColor: c.secondary,
  },
  dropzoneText: { fontSize: t.caption, color: c.mutedForeground },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.secondary },
  previewText: { flex: 1, minWidth: 0, gap: 2 },
  fileName: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  replace: { fontSize: t.caption, fontWeight: '700', color: c.accent, minHeight: 22 },
  remove: { width: TOUCH - 8, height: TOUCH - 8, alignItems: 'center', justifyContent: 'center' },
  helperText: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 16 },
}));

export default ImageField;
