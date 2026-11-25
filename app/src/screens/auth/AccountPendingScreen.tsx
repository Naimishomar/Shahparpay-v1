import React, { useEffect, useState } from 'react';
import { View, Image, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import api from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAction } from '@/hooks/useAsync';
import { Screen, Banner, EmptyState } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { space } from '../../theme/colors';

/**
 * Shown instead of the retailer app while a self-signed-up account waits for
 * admin verification (or was rejected); every retailer API answers 403 until then.
 */
export const AccountPendingScreen: React.FC = () => {
  const { user, logout, checkSession } = useAuth();
  const insets = useSafeAreaInsets();
  const rejected = user?.verificationStatus === 'rejected';
  // checkSession re-reads the user from /refresh-token; approved swaps to the dashboard.
  const check = useAction(checkSession);
  const signOut = useAction(() => logout());
  const feeDue = !rejected && user?.signupSource === 'self' && !user?.signupFeePaidAt;
  const [qr, setQr] = useState<{ transactionId: string; qrImage: string; qrUpi?: string | null } | null>(null);
  const pay = useAction(async () => {
    const res = await api.createSignupFeeQr();
    if (res?.data?.status === 'SUCCESS') return checkSession();
    setQr(res.data);
  });

  // The QR opens with the screen; the button is only for after it expires.
  useEffect(() => {
    if (feeDue) pay.run();
  }, [feeDue]);

  // Polled while the QR is up; the webhook is what actually settles it.
  useEffect(() => {
    if (!qr) return;
    const id = setInterval(async () => {
      try {
        const status = (await api.getSignupFeeStatus(qr.transactionId))?.data?.status;
        if (status === 'SUCCESS') { clearInterval(id); await checkSession(); }
        else if (status === 'FAILED') { clearInterval(id); setQr(null); }
      } catch {
        // A dropped poll is not a failed payment.
      }
    }, 4000);
    return () => clearInterval(id);
  }, [qr]);

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.xl }}>
      <EmptyState
        icon={rejected ? 'account-cancel-outline' : 'account-clock-outline'}
        title={feeDue ? 'Registration not complete' : 'Account under verification'}
        subtitle={
          rejected
            ? 'Your account was not approved.'
            : feeDue
            ? 'Step 2 of 3: pay the ₹199 registration fee. Admin approval comes after.'
            : 'Your account is waiting for admin verification. You can start once it is approved.'
        }
      />
      {rejected && (
        <Banner tone="error" message={`${user?.verificationNote ? `Reason: ${user.verificationNote}. ` : ''}Please contact support: +91 8240039776, shahparpay@gmail.com.`} />
      )}
      {feeDue && (
        <View style={{ gap: space.sm, alignItems: 'center' }}>
          <Banner tone="error" message="Payment is required to register. Your signup is NOT sent to the admin for approval until the ₹199 fee is paid." />
          {qr ? (
            <>
              {qr.qrUpi ? (
                <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12 }}>
                  <QRCode value={qr.qrUpi} size={220} color="#000" backgroundColor="#fff" />
                </View>
              ) : (
                <Image source={{ uri: qr.qrImage }} style={{ width: 220, height: Math.round((220 * 1644) / 674) }} resizeMode="contain" />
              )}
              <Text style={{ fontWeight: '600' }}>Scan & pay ₹199 with any UPI app</Text>
              <Text>Waiting for payment… Ref {qr.transactionId}</Text>
              <Text style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>₹10 of it is added to your Utility Wallet for the AEPS onboarding fee.</Text>
            </>
          ) : (
            <Button icon="qrcode" onPress={pay.run} loading={pay.pending} fullWidth>
              Pay ₹199 by UPI
            </Button>
          )}
          {!!pay.error && <Banner tone="error" message={pay.error} />}
        </View>
      )}
      {!!check.error && <Banner tone="error" message={check.error} />}
      {!!signOut.error && <Banner tone="error" message={signOut.error} />}
      <View style={{ gap: space.sm }}>
        {!feeDue && (
          <Button icon="refresh" onPress={check.run} loading={check.pending} fullWidth>
            Check again
          </Button>
        )}
        <Button variant="secondary" icon="logout" onPress={signOut.run} loading={signOut.pending} fullWidth>
          Logout
        </Button>
      </View>
    </Screen>
  );
};

export default AccountPendingScreen;
