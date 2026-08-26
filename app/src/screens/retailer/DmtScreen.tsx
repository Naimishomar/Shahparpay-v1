import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  Banner,
  EmptyState,
  ErrorBanner,
  Row,
  StatusPill,
  SuccessBanner,
  money,
  shortDate,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import api from '@/services/api';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

interface Beneficiary {
  beneid: string;
  benename: string;
  accno: string;
  ifsc: string;
  bankname?: string;
}

export const DmtScreen: React.FC = () => {
  const [mobile, setMobile] = useState('');
  const [remitter, setRemitter] = useState<any>(null);
  const [needsEkyc, setNeedsEkyc] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [notice, setNotice] = useState('');

  const [showAddBene, setShowAddBene] = useState(false);
  const [beneName, setBeneName] = useState('');
  const [beneAccount, setBeneAccount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [beneIfsc, setBeneIfsc] = useState('');
  const [benePincode, setBenePincode] = useState('');
  const [bank, setBank] = useState<any>(null);
  const [showBanks, setShowBanks] = useState(false);
  const [bankQuery, setBankQuery] = useState('');

  const history = useAsync<any[]>(async () => (await api.getDmtHistory()).data ?? [], []);
  const balances = useAsync<any>(async () => (await api.getWalletBalance()).data, []);
  const banks = useAsync<any[]>(async () => {
    const res = await api.getDmtBanks();
    return res?.data?.data ?? res?.data ?? [];
  }, []);

  const lookup = useAction(async () => {
    const res = await api.queryDmtRemitter(mobile.trim());
    const paysprint = res?.data;
    if (res.success && paysprint?.status) {
      setRemitter(paysprint.data);
      setNeedsEkyc(false);
      const beneRes = await api.fetchDmtBeneficiaries(mobile.trim());
      const list = beneRes?.data?.data ?? [];
      setBeneficiaries(Array.isArray(list) ? list : []);
      setSelected(null);
      return res;
    }
    // response_code 0 means "not registered" — RBI requires Aadhaar eKYC first.
    if (paysprint && String(paysprint.response_code) === '0') {
      setRemitter(null);
      setNeedsEkyc(true);
      return res;
    }
    throw new Error(paysprint?.message || res.message || 'Failed to query remitter');
  });

  const addBene = useAction(async () => {
    const res = await api.addDmtBeneficiary({
      mobile: mobile.trim(),
      bankid: bank?.bankid ?? bank?.id,
      benename: beneName.trim(),
      beneaccount: beneAccount.trim(),
      ifsc: beneIfsc.trim().toUpperCase(),
      pincode: benePincode.trim(),
    });
    if (!res.success || res.data?.status === false) {
      throw new Error(res.data?.message || res.message || 'Failed to add beneficiary');
    }
    return res;
  });

  const removeBene = useAction(async (beneid: string) => {
    const res = await api.deleteDmtBeneficiary({ mobile: mobile.trim(), beneid });
    if (!res.success) throw new Error(res.data?.message || res.message);
    return res;
  });

  const transfer = useAction(async () => {
    const res = await api.transferDmt({
      mobile: mobile.trim(),
      beneid: selected!.beneid,
      amount: Number(amount),
      beneaccount: selected!.accno,
      ifsc: selected!.ifsc,
      pin,
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const refreshBeneficiaries = async () => {
    const beneRes = await api.fetchDmtBeneficiaries(mobile.trim());
    const list = beneRes?.data?.data ?? [];
    setBeneficiaries(Array.isArray(list) ? list : []);
  };

  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  const canTransfer = !!selected && Number(amount) > 0 && !overBalance && pin.length === 4;
  const ifscValid = IFSC_RE.test(beneIfsc.trim().toUpperCase());
  const beneValid =
    !!bank &&
    beneName.trim().length > 2 &&
    beneAccount.trim().length >= 6 &&
    beneAccount === confirmAccount &&
    ifscValid &&
    benePincode.length === 6;

  const filteredBanks = useMemo(
    () =>
      (banks.data ?? []).filter((b: any) =>
        String(b.bankname ?? b.name ?? '').toLowerCase().includes(bankQuery.trim().toLowerCase())
      ),
    [banks.data, bankQuery]
  );

  const remitterName =
    remitter?.name || [remitter?.fname, remitter?.lname].filter(Boolean).join(' ') || 'Registered remitter';

  const confirmRemoveBene = (b: Beneficiary) =>
    Alert.alert('Remove beneficiary?', `${b.benename} will be removed from this remitter.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await removeBene.run(b.beneid);
          if (res) {
            setNotice('Beneficiary removed.');
            if (selected?.beneid === b.beneid) setSelected(null);
            refreshBeneficiaries();
          }
        },
      },
    ]);

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
          <Row label="Main wallet balance" value={money(available)} mono last />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="account-search-outline">Remitter</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Input
            label="Customer mobile number"
            required
            value={mobile}
            onChangeText={(v) => {
              setMobile(v.replace(/\D/g, '').slice(0, 10));
              setRemitter(null);
              setBeneficiaries([]);
              setSelected(null);
              setNeedsEkyc(false);
            }}
            keyboardType="number-pad"
            placeholder="10-digit mobile number"
            leftIcon="phone-outline"
            autoComplete="tel"
          />
          {!!lookup.error && <ErrorBanner message={lookup.error} />}
          <Button
            onPress={() => lookup.run()}
            loading={lookup.pending}
            disabled={mobile.length !== 10}
            icon="magnify"
            fullWidth
          >
            Look up remitter
          </Button>

          {needsEkyc && (
            <Banner
              tone="warning"
              message="This customer is not registered. RBI mandates Aadhaar biometric eKYC to register a new remitter, which needs a certified fingerprint device — complete it from the web portal."
            />
          )}

          {!!remitter && (
            <View style={styles.infoBox}>
              <Row label="Name" value={remitterName} />
              <Row label="Mobile" value={mobile} />
              <Row
                label="Remaining limit"
                value={remitter?.limit ? money(remitter.limit) : '—'}
                mono
                last
              />
            </View>
          )}
        </CardContent>
      </Card>

      {!!remitter && (
        <Card>
          <CardHeader>
            <CardTitle icon="account-multiple-outline">Beneficiaries</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            {!!removeBene.error && <ErrorBanner message={removeBene.error} />}
            {beneficiaries.length ? (
              beneficiaries.map((b) => {
                const active = selected?.beneid === b.beneid;
                return (
                  <Pressable
                    key={b.beneid}
                    onPress={() => setSelected(b)}
                    style={({ pressed }) => [
                      styles.beneRow,
                      active && styles.beneRowActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${b.benename}, account ending ${String(b.accno).slice(-4)}`}
                  >
                    <View style={styles.beneInfo}>
                      <Text style={styles.beneName} numberOfLines={1}>
                        {b.benename}
                      </Text>
                      <Text style={styles.beneMeta} numberOfLines={1}>
                        ••••{String(b.accno).slice(-4)} · {b.ifsc}
                        {b.bankname ? ` · ${b.bankname}` : ''}
                      </Text>
                    </View>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash-can-outline"
                      onPress={() => confirmRemoveBene(b)}
                      accessibilityLabel={`Remove ${b.benename}`}
                    >
                      {''}
                    </Button>
                  </Pressable>
                );
              })
            ) : (
              <EmptyState
                icon="account-off-outline"
                title="No beneficiaries yet"
                subtitle="Add the account this customer wants to send money to"
              />
            )}

            <Button
              variant={showAddBene ? 'secondary' : 'outline'}
              size="sm"
              icon={showAddBene ? 'close' : 'plus'}
              onPress={() => setShowAddBene(!showAddBene)}
              fullWidth
            >
              {showAddBene ? 'Cancel' : 'Add beneficiary'}
            </Button>

            {showAddBene && (
              <View style={styles.form}>
                <SelectField
                  label="Bank"
                  required
                  value={bank ? bank.bankname || bank.name : ''}
                  placeholder={banks.loading ? 'Loading banks…' : 'Select bank'}
                  open={showBanks}
                  onPress={() => setShowBanks(!showBanks)}
                />
                {showBanks && (
                  <View style={styles.picker}>
                    <Input
                      placeholder="Search bank"
                      value={bankQuery}
                      onChangeText={setBankQuery}
                      leftIcon="magnify"
                      autoCapitalize="none"
                    />
                    <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {filteredBanks.slice(0, 60).map((b: any, i: number) => (
                        <Pressable
                          key={String(b.bankid ?? b.id ?? i)}
                          onPress={() => {
                            setBank(b);
                            setShowBanks(false);
                            setBankQuery('');
                            if (b.ifsc) setBeneIfsc(String(b.ifsc));
                          }}
                          style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                          accessibilityRole="button"
                        >
                          <Text style={styles.pickerText}>{b.bankname ?? b.name}</Text>
                        </Pressable>
                      ))}
                      {!filteredBanks.length && <Text style={styles.pickerEmpty}>No matching bank</Text>}
                    </ScrollView>
                  </View>
                )}

                <Input
                  label="Beneficiary name"
                  required
                  value={beneName}
                  onChangeText={setBeneName}
                  leftIcon="account-outline"
                />
                <Input
                  label="Account number"
                  required
                  value={beneAccount}
                  onChangeText={(v) => setBeneAccount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  leftIcon="numeric"
                />
                <Input
                  label="Confirm account number"
                  required
                  value={confirmAccount}
                  onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  leftIcon="numeric"
                  error={
                    confirmAccount && confirmAccount !== beneAccount
                      ? 'Account numbers do not match'
                      : undefined
                  }
                />
                <Input
                  label="IFSC code"
                  required
                  value={beneIfsc}
                  onChangeText={setBeneIfsc}
                  autoCapitalize="characters"
                  maxLength={11}
                  leftIcon="bank-outline"
                  error={beneIfsc.length === 11 && !ifscValid ? 'Invalid IFSC format' : undefined}
                />
                <Input
                  label="Pincode"
                  required
                  value={benePincode}
                  onChangeText={(v) => setBenePincode(v.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  leftIcon="map-marker-outline"
                />
                {!!addBene.error && <ErrorBanner message={addBene.error} />}
                <Button
                  onPress={async () => {
                    const res = await addBene.run();
                    if (res) {
                      setNotice('Beneficiary added.');
                      setBeneName('');
                      setBeneAccount('');
                      setConfirmAccount('');
                      setBeneIfsc('');
                      setBenePincode('');
                      setShowAddBene(false);
                      refreshBeneficiaries();
                    }
                  }}
                  loading={addBene.pending}
                  disabled={!beneValid}
                  icon="account-plus-outline"
                  fullWidth
                >
                  Save beneficiary
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {!!selected && (
        <Card>
          <CardHeader>
            <CardTitle icon="send-outline">Send money</CardTitle>
          </CardHeader>
          <CardContent style={styles.form}>
            <View style={styles.infoBox}>
              <Row label="To" value={selected.benename} />
              <Row label="Account" value={`••••${String(selected.accno).slice(-4)}`} />
              <Row label="IFSC" value={selected.ifsc} last />
            </View>
            <Input
              label="Amount"
              required
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              leftIcon="currency-inr"
              error={overBalance ? 'Amount exceeds your main wallet balance' : undefined}
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
            {!!notice && <SuccessBanner message={notice} />}
            <Button
              onPress={async () => {
                setNotice('');
                const res = await transfer.run();
                if (res) {
                  setNotice(res.message || 'Transfer submitted.');
                  setAmount('');
                  setPin('');
                  balances.reload();
                  history.reload();
                }
              }}
              disabled={!canTransfer}
              loading={transfer.pending}
              icon="send-outline"
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
            history.data.slice(0, 20).map((txn: any) => (
              <View key={txn._id || txn.transactionId} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text style={styles.itemAmount}>{money(txn.amount)}</Text>
                  <StatusPill status={txn.status} />
                </View>
                <Row label="Beneficiary" value={txn.beneName || txn.metadata?.benename} />
                <Row label="Reference" value={txn.transactionId} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState icon="send-outline" title="No transfers yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  infoBox: { padding: space.md, borderRadius: radius.md, backgroundColor: c.secondary },
  beneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  beneRowActive: { borderColor: c.accent, backgroundColor: c.accentSubtle },
  beneInfo: { flex: 1, minWidth: 0, gap: 2 },
  beneName: { fontSize: t.small, fontWeight: '700', color: c.foreground },
  beneMeta: { fontSize: t.micro, color: c.mutedForeground },
  picker: { gap: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: c.secondary },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  pickerEmpty: { fontSize: t.caption, color: c.mutedForeground, padding: space.md },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  itemAmount: {
    fontSize: t.body,
    fontWeight: '700',
    color: c.foreground,
    fontVariant: ['tabular-nums'],
  },
}));

export default DmtScreen;
