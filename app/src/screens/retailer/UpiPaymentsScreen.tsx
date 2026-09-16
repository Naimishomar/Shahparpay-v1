import React, { useState } from 'react';
import { View, Text, Image } from 'react-native';
import { themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, Banner, ErrorBanner } from '@/components/ui/Screen';
import { useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * A standing UPI QR for the counter.
 *
 * Proceeds are NOT credited automatically: Icchhamati issues one virtual
 * account per merchant account rather than per retailer, and publishes neither
 * a webhook registration nor a collections feed, so a payment cannot be
 * attributed to the retailer whose QR was scanned. Support reconciles it by
 * hand, and the banner below says so.
 */
export const UpiPaymentsScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [qr, setQr] = useState<any>(null);

  const makeQr = useAction(async () => {
    const res = await api.generateCollectionQr({
      name: name.trim(),
      account_number: account.trim(),
      account_ifsc: ifsc.trim().toUpperCase(),
    });
    if (!res.success) throw new Error(res.message);
    return res.data;
  });

  const valid =
    name.trim().length > 2 && account.trim().length >= 6 && IFSC_RE.test(ifsc.trim().toUpperCase());

  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle icon="qrcode">UPI QR</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Banner
            tone="warning"
            message="Collections are not credited automatically yet. Payments into this QR reach the company account and are credited to your QR wallet by support, usually within 24 hours. For an instant credit, send a payment link from Collect payments instead."
          />
          <Input
            label="Account holder name"
            required
            value={name}
            onChangeText={(v) => { setName(v); setQr(null); }}
            leftIcon="account-outline"
          />
          <Input
            label="Account number"
            required
            value={account}
            onChangeText={(v) => { setAccount(v.replace(/\D/g, '')); setQr(null); }}
            keyboardType="number-pad"
            leftIcon="numeric"
          />
          <Input
            label="IFSC code"
            required
            value={ifsc}
            onChangeText={(v) => { setIfsc(v); setQr(null); }}
            autoCapitalize="characters"
            maxLength={11}
            leftIcon="bank-outline"
            error={
              ifsc.length === 11 && !IFSC_RE.test(ifsc.toUpperCase())
                ? 'Invalid IFSC format'
                : undefined
            }
          />
          {!!makeQr.error && <ErrorBanner message={makeQr.error} />}
          <Button
            onPress={async () => {
              const data = await makeQr.run();
              if (data) setQr(data);
            }}
            loading={makeQr.pending}
            disabled={!valid}
            icon="qrcode-plus"
            size="lg"
            fullWidth
          >
            Generate QR code
          </Button>

          {!!qr && (
            <View style={styles.qrBox}>
              {!!qr.qrImage && (
                <Image
                  source={{ uri: qr.qrImage }}
                  style={styles.qrImage}
                  resizeMode="contain"
                  accessibilityLabel="UPI QR code"
                />
              )}
              {!!qr.upiHandle && (
                <Text style={styles.qrHandle} selectable>
                  {qr.upiHandle}
                </Text>
              )}
              {!!qr.virtualAccountId && (
                <Text style={styles.qrMeta}>Virtual account {qr.virtualAccountId}</Text>
              )}
            </View>
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  qrBox: { alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  qrImage: { width: 220, height: 220, backgroundColor: '#FFFFFF', borderRadius: radius.md },
  qrHandle: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  qrMeta: { fontSize: t.micro, color: c.mutedForeground },
}));

export default UpiPaymentsScreen;
