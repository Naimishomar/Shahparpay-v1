import React, { useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { colors, themed, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  SectionTitle,
  Banner,
  EmptyState,
  ErrorBanner,
  Row,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

export const ItrScreen: React.FC = () => {
  const [openError, setOpenError] = useState('');

  const history = useAsync<any[]>(async () => (await api.getItrHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);

  // The backend brokers an eSevaTech session and hands back a one-time URL.
  const launch = useAction(async () => {
    const res = await api.launchItr();
    if (!res.success || !res.redirect_url) {
      throw new Error(res.message || 'Could not start an ITR session.');
    }
    return res.redirect_url as string;
  });

  const onLaunch = async () => {
    setOpenError('');
    const url = await launch.run();
    if (!url) return;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      history.reload();
    } else {
      setOpenError('This device cannot open the ITR filing portal.');
    }
  };

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={() => {
        history.refresh();
        balances.refresh();
      }}
      error={history.error}
      onRetry={history.reload}
    >
      <Card>
        <CardContent style={styles.wallet}>
          <IconTile icon="wallet-outline" size={48} iconSize={22} />
          <Text style={styles.walletLabel}>Main wallet balance</Text>
          <Text style={styles.walletValue} numberOfLines={1} adjustsFontSizeToFit>
            {money(balances.data?.mainBalance)}
          </Text>
        </CardContent>
      </Card>

      <SectionTitle>Start a filing</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <Text style={styles.help}>
            Filing opens the eSevaTech portal already signed in as your retailer account. Each
            completed filing is debited from your wallet and appears below.
          </Text>
          <Banner
            tone="info"
            message="The portal opens in your browser. Come back and pull to refresh once you finish."
          />
          {!!launch.error && <ErrorBanner message={launch.error} />}
          {!!openError && <ErrorBanner message={openError} />}
          <Button
            onPress={onLaunch}
            loading={launch.pending}
            size="lg"
            fullWidth
          >
            Open ITR portal
          </Button>
        </CardContent>
      </Card>

      <SectionTitle>Filing history</SectionTitle>
      <Card>
        <CardContent>
          {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any, index: number, shown: any[]) => (
              <View
                key={txn._id || txn.transactionId}
                style={[styles.item, index === shown.length - 1 && styles.itemLast]}
              >
                <View style={styles.itemTop}>
                  <IconTile icon="file-document-outline" size={44} iconSize={20} />
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusText status={txn.status} />
                </View>
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Client" value={txn.metadata?.client_name || txn.metadata?.pan} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState
              icon="file-document-outline"
              title="No filings yet"
              subtitle="Completed ITR filings and their charges appear here"
            />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

/** BHIM status: small coloured text, never a filled pill. */
const StatusText: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status || 'PENDING').toUpperCase();
  const color = /SUCCESS|COMPLETE|APPROVED|ACTIVE|ACCEPTED|CONVERTED/.test(s)
    ? colors.success
    : /FAIL|REJECT/.test(s)
      ? colors.destructive
      : colors.warning;
  return (
    <Text style={{ fontSize: t.small, fontWeight: '500', color }}>
      {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
    </Text>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  help: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  walletLabel: { flex: 1, fontSize: t.small, color: c.mutedForeground },
  walletValue: { fontSize: t.h2, fontWeight: '400', color: c.foreground, fontVariant: ['tabular-nums'] },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemLast: { borderBottomWidth: 0 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: 2,
  },
  itemAmount: {
    flex: 1,
    fontSize: t.bodyLg,
    fontWeight: '500',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default ItrScreen;
