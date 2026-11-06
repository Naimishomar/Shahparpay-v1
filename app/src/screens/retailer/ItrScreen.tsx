import React, { useState } from 'react';
import { View, Text, Linking } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import { Screen, SectionTitle, Toast } from '@/components/ui/Screen';
import api from '@/services/api';

// Same copy as the web ITR page (frontend/src/pages/ITR.tsx).
const STEPS = [
  { icon: 'lock-outline', title: 'Launch securely', text: 'A single-use token opens the eSevaTech module in a new tab. It stays valid for 15 minutes.' },
  { icon: 'file-document-outline', title: 'File the return', text: "Fill in and validate the client's details in the portal, then submit." },
  { icon: 'wallet-outline', title: 'Pay on success', text: 'Your Utility Wallet is charged only on a successful submission. Rejections are refunded automatically.' },
];

const GUIDELINES = [
  { ok: true, text: 'Wallet balance checks run automatically during submission.' },
  { ok: true, text: 'Each single-use token is valid for 15 minutes.' },
  { ok: true, text: 'Validate information carefully before submitting the form.' },
  { ok: false, text: 'Refunds for rejected requests are credited to your Utility Wallet automatically.' },
];

export const ItrScreen: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>({ message: '', tone: 'error' });

  // POST /api/itr/launch with an empty body, exactly as the web does. The
  // backend rejects the launch (e.g. Utility Wallet below ₹100) with a message.
  const onLaunch = async () => {
    setLoading(true);
    try {
      const res = await api.launchItr();
      if (res?.success && res?.redirect_url) {
        setToast({ message: 'ITR portal link generated successfully! Redirecting...', tone: 'success' });
        await Linking.openURL(res.redirect_url);
      } else {
        setToast({ message: res?.message || 'Failed to launch ITR portal.', tone: 'error' });
      }
    } catch (error: any) {
      setToast({
        message: error?.response?.data?.message || 'An error occurred while generating the ITR portal URL.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      overlay={<Toast message={toast.message} tone={toast.tone} onHide={() => setToast((s) => ({ ...s, message: '' }))} />}
    >
      <Card>
        <CardContent style={styles.form}>
          <View style={styles.heroTop}>
            <IconTile icon="file-document-outline" size={48} iconSize={22} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>ITR Filing Services</Text>
              <Text style={styles.tag}>eSevaTech partner</Text>
            </View>
          </View>
          <Text style={styles.help}>
            Submit and manage Income Tax Returns for your clients through the secure eSevaTech ITR module.
          </Text>
          <Button onPress={onLaunch} loading={loading} size="lg" fullWidth icon="arrow-top-right" iconRight>
            {loading ? 'Generating secure link...' : 'Open Filing Module'}
          </Button>
        </CardContent>
      </Card>

      <SectionTitle>How it works</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          {STEPS.map((step, i) => (
            <View key={step.title} style={styles.heroTop}>
              <IconTile icon={step.icon} size={44} iconSize={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{`${i + 1}. ${step.title}`}</Text>
                <Text style={styles.help}>{step.text}</Text>
              </View>
            </View>
          ))}
        </CardContent>
      </Card>

      <SectionTitle>Guidelines & Rules</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          {GUIDELINES.map(({ ok, text }) => (
            <View key={text} style={styles.rule}>
              <MaterialCommunityIcons
                name={ok ? 'check-circle-outline' : 'alert-circle-outline'}
                size={18}
                color={ok ? colors.success : colors.warning}
              />
              <Text style={[styles.help, { flex: 1 }]}>{text}</Text>
            </View>
          ))}
        </CardContent>
      </Card>

      <SectionTitle>Secure filing</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <View style={styles.heroTop}>
            <IconTile icon="shield-check-outline" size={44} iconSize={20} />
            <Text style={[styles.help, { flex: 1 }]}>
              ITR filing through eSevaTech uses secure single-use tokens. Your Utility Wallet is only charged upon
              successful submission.
            </Text>
          </View>
          <View style={styles.rule}>
            <MaterialCommunityIcons name="script-text-outline" size={16} color={colors.mutedForeground} />
            <Text style={[styles.help, { flex: 1 }]}>Every transaction is logged in your Wallet Ledger.</Text>
          </View>
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { fontSize: t.h2, fontWeight: '500', color: c.foreground },
  tag: { fontSize: t.small, color: c.mutedForeground },
  help: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  itemTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
}));

export default ItrScreen;
