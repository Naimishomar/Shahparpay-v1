import React, { useState } from 'react';
import { View, Text, Linking } from 'react-native';
import { themed, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  Row,
  StatusPill,
  money,
  shortDate,
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
        <CardContent>
          <Row label="Main wallet balance" value={money(balances.data?.mainBalance)} mono last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="rocket-launch-outline">Start a filing</CardTitle>
        </CardHeader>
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
            icon="open-in-new"
            size="lg"
            fullWidth
          >
            Open ITR portal
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="history">Filing history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
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

const styles = themed((c) => ({
  form: { gap: space.lg },
  help: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    marginBottom: 2,
  },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default ItrScreen;
