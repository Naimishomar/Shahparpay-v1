import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { themed, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, Row, SuccessBanner } from '@/components/ui/Screen';
import { BiometricCapture, useBiometricDevice } from './BiometricCapture';
import { useAuth } from '@/context/AuthContext';
import { useAction } from '@/hooks/useAsync';
import { coordsPayload } from '@/services/location';
import api from '@/services/api';

/**
 * Daily two-factor authentication. NPCI requires the agent to re-authenticate
 * with their own fingerprint once every 24 hours before any AEPS transaction.
 *
 * `daily-auth` can come back asking for web onboarding instead of succeeding;
 * that is surfaced as an action rather than a dead-end error so the retailer
 * can jump straight into eKYC.
 */
export const DailyAuthSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  onCompleted?: () => void;
  /** Opens the merchant eKYC sheet when the bank says onboarding is pending. */
  onNeedsKyc?: (pipe?: string) => void;
}> = ({ visible, onClose, onCompleted, onNeedsKyc }) => {
  const { user } = useAuth();
  const { device, setDevice } = useBiometricDevice();

  const [aadhaar, setAadhaar] = useState(user?.aadhaarNumber ?? '');
  const [pidData, setPidData] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [kycPipe, setKycPipe] = useState<string | null>(null);

  const merchantcode = user?.retailerId || user?.code || '';

  const authenticate = useAction(async () => {
    setKycPipe(null);
    const response = await api.aepsDailyAuth({
      merchantcode,
      aadhaarNumber: aadhaar,
      mobileNumber: user?.contactNumber,
      pidData,
      ...(await coordsPayload()),
    });

    // The backend classifies the provider's response codes and falls back
    // across pipes, so `success` is authoritative — an already-authenticated
    // day comes back successful too, not as response_code 1.
    if (response.success) {
      setDone(true);
      onCompleted?.();
      return response;
    }

    // Messages are already retailer-facing; the outcome only decides which
    // recovery action to offer alongside them.
    if (response.needsWebOnboarding) {
      setKycPipe(response.pipe || 'bank2');
    }
    throw new Error(response.message || 'Daily authentication failed.');
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Daily 2FA login"
      subtitle="Required once every 24 hours"
      icon="shield-key-outline"
      dismissible={!authenticate.pending}
      footer={
        done ? (
          <Button icon="check" onPress={onClose} fullWidth>
            Continue
          </Button>
        ) : (
          <Button
            icon="shield-check-outline"
            haptic="success"
            size="lg"
            onPress={authenticate.run}
            loading={authenticate.pending}
            disabled={!pidData || aadhaar.length !== 12}
            fullWidth
          >
            Authenticate
          </Button>
        )
      }
    >
      {done ? (
        <SuccessBanner message="Daily authentication complete. AEPS transactions are unlocked for today." />
      ) : (
        <>
          <View style={styles.summary}>
            <Row label="Merchant code" value={merchantcode || '—'} mono />
            <Row label="Registered mobile" value={user?.contactNumber || '—'} mono last />
          </View>

          <Input
            label="Aadhaar number"
            required
            value={aadhaar}
            onChangeText={(v) => setAadhaar(v.replace(/\D/g, '').slice(0, 12))}
            keyboardType="number-pad"
            leftIcon="card-account-details-outline"
            placeholder="12 digits"
            helperText="The Aadhaar registered against your merchant account"
          />

          <BiometricCapture
            device={device}
            onDeviceChange={setDevice}
            pidData={pidData}
            onCaptured={setPidData}
            label="Scan your fingerprint"
            confirmMessage="Place YOUR OWN finger on the scanner — this authenticates you as the agent for today."
            blockedReason={aadhaar.length !== 12 ? 'Enter your 12-digit Aadhaar number first.' : null}
          />

          {!!authenticate.error && (
            <>
              <Banner tone="error" message={authenticate.error} />
              {!!kycPipe && !!onNeedsKyc && (
                <Button
                  variant="outline"
                  icon="shield-account-outline"
                  onPress={() => {
                    onClose();
                    onNeedsKyc(kycPipe);
                  }}
                  fullWidth
                >
                  Complete merchant eKYC
                </Button>
              )}
            </>
          )}

          <Text style={styles.hint}>
            Authentication is per bank pipe and resets at midnight. Your fingerprint is signed on
            the device by the UIDAI RD Service.
          </Text>
        </>
      )}
    </Sheet>
  );
};

const styles = themed((c) => ({
  summary: {
    paddingHorizontal: space.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  hint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
}));

export default DailyAuthSheet;
