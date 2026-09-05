import React, { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  Grid,
  StatusPill,
  SuccessBanner,
  money,
} from '@/components/ui/Screen';
import { OnboardMemberSheet } from '@/components/network/OnboardMemberSheet';
import { EditRetailerSheet } from '@/components/network/EditRetailerSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const KYC_CALLBACK = 'https://shahparpay-v1.vercel.app/kyc-callback';

/**
 * The distributor's network, one level down from the portal: every retailer,
 * their wallets and KYC state, and the eKYC link for the ones still pending.
 * Tapping a row opens the full record.
 */
export const RetailersScreen: React.FC = () => {
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const retailers = useAsync<any[]>(async () => (await api.getDistributorRetailers()).data ?? [], []);

  // The backend resolves the retailer code, and answers `alreadyOnboarded`
  // with no URL once PaySprint has accepted them.
  const kycLink = useAction(async (retailer: any) => {
    const res = await api.getPaysprintOnboardUrl(
      retailer.retailerId || retailer._id,
      true,
      undefined,
      KYC_CALLBACK
    );
    if (!res.success) throw new Error(res.message || 'Could not generate the KYC link.');
    if (!res.url)
      throw new Error(
        res.alreadyOnboarded
          ? 'This retailer is already onboarded — their KYC is complete.'
          : res.message || 'PaySprint did not return an onboarding link.'
      );
    return res.url as string;
  });

  const onKycLink = async (retailer: any) => {
    setNotice('');
    const url = await kycLink.run(retailer);
    if (!url) return;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    else setNotice(`Share this KYC link with the retailer: ${url}`);
  };

  const all = retailers.data ?? [];
  const needle = query.trim().toLowerCase();
  const list = needle
    ? all.filter((r: any) =>
        [r.businessName, r.name, r.retailerId, r.contactNumber, r.email]
          .filter(Boolean)
          .some((field: string) => String(field).toLowerCase().includes(needle))
      )
    : all;
  const kycPending = all.filter((r: any) => !r.isMerchantKycComplete).length;

  return (
    <Screen
      loading={retailers.loading}
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

      {!!notice && <SuccessBanner message={notice} />}
      {!!kycLink.error && <ErrorBanner message={kycLink.error} />}

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
          {retailers.loading ? null : list.length ? (
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
                      {`AEPS ${money(ret.aepsWalletBalance)} · Main ${money(ret.mainWalletBalance)}`}
                    </Text>
                  </View>
                  <View style={styles.listRight}>
                    <StatusPill status={ret.isMerchantKycComplete ? 'COMPLETED' : 'PENDING'} />
                    <StatusPill status={ret.isActive === false ? 'INACTIVE' : 'ACTIVE'} />
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {!ret.isMerchantKycComplete && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon="shield-link-variant-outline"
                    onPress={() => onKycLink(ret)}
                    loading={kycLink.pending}
                    fullWidth
                  >
                    Generate KYC link
                  </Button>
                )}
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
