import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  Grid,
  StatusPill,
  money,
  SkeletonRows,
  SkeletonCard,
} from '@/components/ui/Screen';
import { OnboardMemberSheet } from '@/components/network/OnboardMemberSheet';
import { EditRetailerSheet } from '@/components/network/EditRetailerSheet';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';
import { aepsKycDone, aepsStepLabel } from '@/constants/services';

/**
 * The distributor's network, one level down from the portal: every retailer,
 * their wallets and AEPS onboarding state.
 * Tapping a row opens the full record.
 */
export const RetailersScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const retailers = useAsync<any[]>(async () => (await api.getDistributorRetailers()).data ?? [], []);

  const all = retailers.data ?? [];
  const needle = query.trim().toLowerCase();
  const list = needle
    ? all.filter((r: any) =>
        [r.businessName, r.name, r.retailerId, r.contactNumber, r.email]
          .filter(Boolean)
          .some((field: string) => String(field).toLowerCase().includes(needle))
      )
    : all;
  const kycPending = all.filter((r: any) => !aepsKycDone(r)).length;

  return (
    <Screen
      loading={retailers.loading}
      skeleton={<SkeletonCard><SkeletonRows count={6} amount={false} /></SkeletonCard>}
      refreshing={retailers.refreshing}
      onRefresh={retailers.refresh}
      error={retailers.error}
      onRetry={retailers.reload}
    >
      <Grid columns={3}>
        <Tile label="Retailers" value={String(all.length)} />
        <Tile
          label="KYC pending"
          value={String(kycPending)}
          tone={kycPending ? 'warning' : undefined}
        />
        <Tile
          label="Wallets"
          value={money(all.reduce((sum: number, r: any) => sum + (r.mainWalletBalance ?? 0), 0))}
        />
      </Grid>

      <Button icon="account-plus-outline" onPress={() => setOnboarding(true)} fullWidth>
        Onboard a retailer
      </Button>

      <Card>
        <CardHeader>
          <CardTitle icon="store-outline">{`My retailers (${list.length})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {all.length > 5 && (
            <Input
              placeholder="Search by name, ID or mobile"
              value={query}
              onChangeText={setQuery}
              leftIcon="magnify"
              autoCapitalize="none"
            />
          )}
          {retailers.loading ? <SkeletonRows count={3} /> : list.length ? (
            list.map((ret: any, i: number) => (
              <View
                key={ret._id}
                style={[styles.listBlock, i === list.length - 1 && styles.listBlockLast]}
              >
                <Pressable
                  onPress={() => setSelected(ret)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${ret.businessName || ret.name || ret.retailerId}`}
                  style={({ pressed }) => [styles.listItem, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.listAvatar}>
                    <Text style={styles.listAvatarText}>
                      {(ret.businessName || ret.name || 'R').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>
                      {ret.businessName || ret.name || ret.retailerId}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {ret.retailerId} · {ret.contactNumber}
                    </Text>
                    <Text style={styles.listMeta} numberOfLines={1}>
                      {`Trade ${money(ret.aepsWalletBalance)} · Utility ${money(ret.mainWalletBalance)}`}
                    </Text>
                    {/* Where they are stuck, so the distributor knows what to follow up on. */}
                    {!aepsKycDone(ret) && (
                      <Text style={[styles.listMeta, { color: colors.warning }]} numberOfLines={1}>
                        {aepsStepLabel(ret)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.listRight}>
                    <StatusPill status={aepsKycDone(ret) ? 'COMPLETED' : 'PENDING'} />
                    <StatusPill status={ret.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            ))
          ) : (
            <EmptyState
              icon="store-outline"
              title={needle ? 'No retailer matches that' : 'No retailers yet'}
              subtitle={
                needle
                  ? 'Try the retailer ID or mobile number instead'
                  : 'Onboard your first retailer to start earning commission'
              }
              action={
                needle
                  ? { label: 'Clear search', onPress: () => setQuery('') }
                  : { label: 'Onboard a retailer', onPress: () => setOnboarding(true) }
              }
            />
          )}
        </CardContent>
      </Card>

      <OnboardMemberSheet
        visible={onboarding}
        kind="retailer"
        onClose={() => setOnboarding(false)}
        onCreated={retailers.reload}
      />

      {!!selected && (
        <EditRetailerSheet
          retailer={selected}
          onClose={() => setSelected(null)}
          onSaved={retailers.reload}
        />
      )}
    </Screen>
  );
};

const Tile: React.FC<{ label: string; value: string; tone?: 'warning' }> = ({
  label,
  value,
  tone,
}) => (
  <View style={styles.tile}>
    <Text style={styles.tileLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text
      style={[styles.tileValue, tone === 'warning' && { color: colors.warning }]}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {value}
    </Text>
  </View>
);

const styles = themed((c) => ({
  tile: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 3,
  },
  tileLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  tileValue: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  listBlock: {
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    gap: space.sm,
  },
  listBlockLast: { borderBottomWidth: 0, paddingBottom: 0 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  listAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: c.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listAvatarText: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  listInfo: { flex: 1, minWidth: 0, gap: 2 },
  listName: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  listMeta: { fontSize: t.micro, color: c.mutedForeground },
  listRight: { alignItems: 'flex-end', gap: 4 },
}));

export default RetailersScreen;
