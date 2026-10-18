import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/context/AuthContext';

const initialsOf = (name?: string) =>
  String(name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

interface HeaderProps {
  title?: string;
  /**
   * A bottom-bar destination: large title, no back arrow, bell on the right
   * (mockup screens 05 and 15). Otherwise a back arrow and a compact title.
   */
  root?: boolean;
  /** Draw on the brand band (mockup screens 06, 08, 14). */
  onBand?: boolean;
  /** Safe-area top inset, applied as the header's own padding. */
  topInset?: number;
}

/** The app bar, as drawn in mockups/app-bhim-style.html. */
export const Header: React.FC<HeaderProps> = ({ title, root = false, topInset = 0 }) => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const ink = colors.foreground;

  return (
    <View style={[styles.header, { paddingTop: topInset }]}>
      <View style={styles.row}>
        {!root && (
          <Pressable
            onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={26} color={ink} />
          </Pressable>
        )}
        {root && (
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open profile — ${user?.name || 'Account'}`}
          >
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initialsOf(user?.name)}</Text>
            )}
          </Pressable>
        )}
        <Text
          style={[root ? styles.rootTitle : styles.title, { color: ink }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title || 'Shahparpay'}
        </Text>
        {root && <NotificationBell />}
      </View>
    </View>
  );
};

const styles = themed((c) => ({
  // Opens the profile drawer from every top-level screen.
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  // Transparent: the screen's glow shows through, as in BHIM.
  header: { paddingHorizontal: space.lg, zIndex: 50 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  back: {
    width: 40,
    height: 40,
    marginLeft: -space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.6 },
  // BHIM headers are regular weight and generous in size, not bold.
  title: { flex: 1, fontSize: t.title + 1, fontWeight: '500' },
  rootTitle: { flex: 1, fontSize: t.h2, fontWeight: '500' },
}));

export default Header;
