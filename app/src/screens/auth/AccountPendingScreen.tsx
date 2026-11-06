import React from 'react';
import { View } from 'react-native';
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

  return (
    <Screen contentStyle={{ paddingTop: insets.top + space.xl }}>
      <EmptyState
        icon={rejected ? 'account-cancel-outline' : 'account-clock-outline'}
        title="Account under verification"
        subtitle={
          rejected
            ? 'Your account was not approved.'
            : 'Your account is waiting for admin verification. You can start once it is approved.'
        }
      />
      {rejected && (
        <Banner tone="error" message={`${user?.verificationNote ? `Reason: ${user.verificationNote}. ` : ''}Please contact support: +91 8240039776, shahparpay@gmail.com.`} />
      )}
      {!!check.error && <Banner tone="error" message={check.error} />}
      {!!signOut.error && <Banner tone="error" message={signOut.error} />}
      <View style={{ gap: space.sm }}>
        <Button icon="refresh" onPress={check.run} loading={check.pending} fullWidth>
          Check again
        </Button>
        <Button variant="secondary" icon="logout" onPress={signOut.run} loading={signOut.pending} fullWidth>
          Logout
        </Button>
      </View>
    </Screen>
  );
};

export default AccountPendingScreen;
