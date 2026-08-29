import React, { useState } from 'react';
import { View, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Screen, Banner, EmptyState, Row, StatusPill, dateTime } from '@/components/ui/Screen';
import { MerchantKycSheet } from '@/components/aeps/MerchantKycSheet';
import { useAsync } from '@/hooks/useAsync';
import api from '@/services/api';

interface Pipe {
  pipe: string;
  label: string;
  status: string;
  is_approved?: string;
  onboarded?: boolean;
  message?: string | null;
}

export const PipeStatusScreen: React.FC = () => {
  const pipes = useAsync<any>(async () => (await api.verifyAepsPipes()).data, []);
  const [onboarding, setOnboarding] = useState<string | null>(null);

  const list: Pipe[] = pipes.data?.pipes ?? [];
  const active: string[] = pipes.data?.activePipes ?? [];

  return (
    <Screen
      loading={pipes.loading}
      refreshing={pipes.refreshing}
      onRefresh={pipes.refresh}
      error={pipes.error}
      onRetry={pipes.reload}
    >
      <Card>
        <CardContent>
          <Row label="Merchant code" value={pipes.data?.merchantCode} />
          <Row label="Active pipes" value={active.length ? active.join(', ') : 'None'} />
          <Row label="Last checked" value={dateTime(pipes.data?.lastCheckedAt)} last />
        </CardContent>
      </Card>

      {list.length ? (
        list.map((pipe) => (
          <Card key={pipe.pipe}>
            <CardContent>
              <View style={styles.pipeHeader}>
                <View style={[styles.pipeIcon, pipe.onboarded && styles.pipeIconActive]}>
                  <MaterialCommunityIcons
                    name="bank"
                    size={20}
                    color={pipe.onboarded ? colors.success : colors.warning}
                  />
                </View>
                <View style={styles.pipeInfo}>
                  <Text style={styles.pipeName} numberOfLines={1}>
                    {pipe.label || pipe.pipe}
                  </Text>
                  <Text style={styles.pipeCode}>{pipe.pipe}</Text>
                </View>
                <StatusPill status={pipe.onboarded ? 'ACTIVE' : pipe.status} />
              </View>
              <Row label="Approval" value={pipe.is_approved || '—'} />
              <Row label="Message" value={pipe.message || 'No message from the bank'} last />
              {!pipe.onboarded && (
                <Button
                  variant="outline"
                  icon="shield-account-outline"
                  onPress={() => setOnboarding(pipe.pipe)}
                  style={{ marginTop: space.md }}
                  fullWidth
                >
                  {pipe.status === 'REJECTED' ? 'Restart onboarding' : 'Continue onboarding'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      ) : pipes.loading ? null : (
        <Card>
          <CardContent>
            <EmptyState
              icon="pipe-disconnected"
              title="No pipe data returned"
              subtitle="Pull to refresh to re-query PaySprint for every pipe"
            />
          </CardContent>
        </Card>
      )}

      <Banner
        tone="info"
        message="Each bank pipe is onboarded separately. A pipe only carries transactions once the bank marks it Accepted and merchant eKYC is complete on it."
      />

      <MerchantKycSheet
        visible={!!onboarding}
        initialPipe={onboarding ?? undefined}
        onClose={() => setOnboarding(null)}
        onCompleted={pipes.refresh}
      />
    </Screen>
  );
};

const styles = themed((c) => ({
  pipeHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  pipeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: c.warningSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipeIconActive: { backgroundColor: c.successSubtle },
  pipeInfo: { flex: 1, minWidth: 0, gap: 2 },
  pipeName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  pipeCode: { fontSize: t.micro, color: c.mutedForeground },
}));

export default PipeStatusScreen;
