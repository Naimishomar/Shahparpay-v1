import React, { useState } from 'react';
import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  SuccessBanner,
  Grid,
  Row,
  StatusPill,
  money,
  dateTime,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

/** Only what this screen reads; the endpoint returns the AEPS balance too. */
interface Balances {
  qrBalance: number;
  mainBalance: number;
  hasPin: boolean;
}

/**
 * QR wallet -> Main wallet, the same transfer the web portal offers.
 *
 * `/api/wallet/transfer` is `transferQrToMain` on the backend: it debits the
 * QR wallet, where UPI QR collections land. This screen used to present the
 * AEPS balance and validate against it while the server moved QR money, so a
 * retailer with a full AEPS wallet and an empty QR wallet was shown a transfer
 * the server could only refuse.
 *
 * The AEPS wallet is not transferable here — it settles straight to bank from
 * the Withdraw screen.
 */
export const WalletTransferScreen: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');

  const balances = useAsync<Balances>(async () => (await api.getWalletBalance()).data, []);
  const history = useAsync<any[]>(async () => (await api.getWalletHistory()).data ?? [], []);

  const transfer = useAction(async () => {
    const res = await api.transferQrToMain({ amount: Number(amount), pin });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const setWalletPin = useAction(async () => {
    const res = await api.setWalletPin(newPin);
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const hasPin = !!balances.data?.hasPin;
  const available = balances.data?.qrBalance ?? 0;
  const numericAmount = Number(amount);
  const overBalance = numericAmount > available;
  const canTransfer = numericAmount > 0 && !overBalance && pin.length === 4 && !transfer.pending;

  const onTransfer = async () => {
    setNotice('');
    const res = await transfer.run();
    if (res) {
      // The backend returns the post-transfer balances under `balances`.
      if (res.balances) balances.setData({ ...(balances.data as Balances), ...res.balances });
      setNotice(res.message || 'Transfer completed.');
      setAmount('');
      setPin('');
      balances.reload();
      history.reload();
    }
  };

  const onSetPin = async () => {
    setNotice('');
    const res = await setWalletPin.run();
    if (res) {
      setNotice('Wallet PIN set. You can transfer now.');
      setNewPin('');
      setConfirmPin('');
      balances.reload();
    }
  };

  return (
    <Screen
      loading={balances.loading}
      refreshing={balances.refreshing || history.refreshing}
      onRefresh={() => {
        balances.refresh();
        history.refresh();
      }}
      error={balances.error}
      onRetry={balances.reload}
    >
      {/* Only the two wallets this transfer touches. The AEPS balance is not
          movable here — it settles to bank from Withdraw — so showing it beside
          an amount field is an invitation to type a number that cannot work. */}
      <Grid columns={2}>
        <WalletTile label="QR wallet" amount={balances.data?.qrBalance ?? 0} icon="qrcode" />
        <WalletTile label="Main wallet" amount={balances.data?.mainBalance ?? 0} icon="wallet" />
      </Grid>

      {!!notice && <SuccessBanner message={notice} />}

      {!hasPin ? (
        <Card>
          <CardHeader>
            <CardTitle icon="lock-outline">Set your wallet PIN</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Text style={styles.help}>
              A 4-digit PIN authorises every wallet debit — transfers, payouts, recharges and
              money transfers. Set it once.
            </Text>
            <Input
              label="New PIN"
              required
              value={newPin}
              onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={4}
              placeholder="4 digits"
              leftIcon="lock-outline"
              rightIcon={showPin ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPin(!showPin)}
              rightIconLabel={showPin ? 'Hide PIN' : 'Show PIN'}
            />
            <Input
              label="Confirm PIN"
              required
              value={confirmPin}
              onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={4}
              placeholder="Repeat it"
              leftIcon="lock-check-outline"
              error={confirmPin.length === 4 && confirmPin !== newPin ? 'PINs do not match' : undefined}
            />
            {!!setWalletPin.error && <ErrorBanner message={setWalletPin.error} />}
            <Button
              onPress={onSetPin}
              disabled={newPin.length !== 4 || newPin !== confirmPin}
              loading={setWalletPin.pending}
              icon="shield-check-outline"
              fullWidth
            >
              Set PIN
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle icon="swap-horizontal">Move QR balance to Main</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <Row label="Available in QR wallet" value={money(available)} mono last />
            <Input
              label="Amount"
              required
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              leftIcon="currency-inr"
              error={overBalance ? 'Amount exceeds your QR wallet balance' : undefined}
              helperText="Money collected on your UPI QR. Transfers are instant and cannot be reversed."
            />
            <Input
              label="Wallet PIN"
              required
              value={pin}
              onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry={!showPin}
              maxLength={4}
              placeholder="••••"
              leftIcon="lock-outline"
              rightIcon={showPin ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPin(!showPin)}
              rightIconLabel={showPin ? 'Hide PIN' : 'Show PIN'}
            />
            {!!transfer.error && <ErrorBanner message={transfer.error} />}
            <Button
              onPress={onTransfer}
              disabled={!canTransfer}
              loading={transfer.pending}
              icon="arrow-right"
              size="lg"
              fullWidth
            >
              Transfer
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle icon="history">Transfer history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.loading ? null : history.data?.length ? (
            history.data.slice(0, 20).map((item: any, i: number) => (
              <View key={item._id || i} style={styles.historyItem}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {String(item.type || 'WALLET_TRANSFER').replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.historyDate}>{dateTime(item.createdAt)}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyAmount}>{money(item.amount)}</Text>
                  <StatusPill status={item.status} />
                </View>
              </View>
            ))
          ) : (
            <EmptyState icon="swap-horizontal" title="No transfers yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const WalletTile: React.FC<{ label: string; amount: number; icon: string }> = ({
  label,
  amount,
  icon,
}) => (
  <View style={styles.walletTile}>
    <View style={styles.walletIcon}>
      <MaterialCommunityIcons name={icon as any} size={18} color={colors.accent} />
    </View>
    <Text style={styles.walletLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.walletAmount} numberOfLines={1} adjustsFontSizeToFit>
      {money(amount)}
    </Text>
  </View>
);

const styles = themed((c) => ({
  walletTile: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 6,
  },
  walletIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: c.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletLabel: { fontSize: t.micro, fontWeight: '600', color: c.mutedForeground },
  walletAmount: {
    fontSize: t.title,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
  form: { gap: space.lg },
  help: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  historyInfo: { flex: 1, minWidth: 0, gap: 2 },
  historyTitle: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  historyDate: { fontSize: t.micro, color: c.mutedForeground },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: {
    fontSize: t.small,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default WalletTransferScreen;
