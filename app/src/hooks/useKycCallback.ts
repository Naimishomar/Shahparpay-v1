import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

/**
 * PaySprint's web KYC page finishes by redirecting to the callback URL we
 * handed it, with the signed result in `?data=<jwt>`. On the web build that
 * lands on /kyc-callback; here it comes back as the `shahparpay://kyc-callback`
 * deep link, which only this app can receive.
 *
 * The JWT is verified server-side — the app just relays it and refreshes the
 * session so `isMerchantKycComplete` and `activeAepsPipes` are current.
 */
const handled = new Set<string>();

export const useKycCallback = () => {
  const { token, checkSession } = useAuth();

  useEffect(() => {
    if (!token) return;

    const relay = async (url: string | null) => {
      if (!url || !url.includes('kyc-callback')) return;
      // The OS can deliver the same URL twice (cold start + listener).
      if (handled.has(url)) return;
      handled.add(url);

      const data = url.match(/[?&]data=([^&]+)/)?.[1];
      if (!data) return;
      try {
        await api.updateKycStatus(decodeURIComponent(data));
      } catch {
        // The screen the user lands on re-queries merchant status anyway; a
        // failed relay must not crash the app on launch.
      }
      await checkSession();
    };

    // Cold start: the link that launched the app is not delivered as an event.
    Linking.getInitialURL().then(relay);
    const subscription = Linking.addEventListener('url', ({ url }) => relay(url));
    return () => subscription.remove();
  }, [token]);
};

export default useKycCallback;
