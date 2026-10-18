import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  SectionTitle,
  Banner,
  EmptyState,
  ErrorBanner,
  Row,
  Segmented,
  SuccessBanner,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { PsaRegistrationSheet } from '@/components/pan/PsaRegistrationSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import { INDIAN_STATES } from '@/constants';
import api from '@/services/api';

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Biometric and Standard PSA are switched off, as on the website: only the
// eSeva flow is offered. Their tabs below are kept intact for when the
// provider brings them back — restore the tab bar and these two lines then.
const TABS = [
  { key: 'eseva', label: 'eSeva' },
  { key: 'bio', label: 'Biometric' },
  { key: 'std', label: 'Standard' },
];
const ENABLED_TABS = TABS.filter((t) => t.key === 'eseva');

export const PanCardScreen: React.FC = () => {
  const [tab, setTab] = useState('eseva');
  const [notice, setNotice] = useState('');

  const history = useAsync<any[]>(async () => (await api.getPanHistory()).data ?? [], []);

  return (
    <Screen
      refreshing={history.refreshing}
      onRefresh={history.refresh}
      error={history.error}
      onRetry={history.reload}
    >
      {ENABLED_TABS.length > 1 && (
        <Segmented options={ENABLED_TABS} value={tab} onChange={setTab} scroll={false} />
      )}
      {!!notice && <SuccessBanner message={notice} />}

      {tab === 'eseva' && <EsevaTab onNotice={setNotice} onDone={history.reload} />}
      {tab === 'bio' && <BiometricTab onNotice={setNotice} onDone={history.reload} />}
      {tab === 'std' && <StandardTab onNotice={setNotice} onDone={history.reload} />}

      <SectionTitle>Application history</SectionTitle>
      <Card>
        <CardContent>
          {history.loading ? <SkeletonRows count={3} /> : history.data?.length ? (
            history.data.slice(0, 20).map((txn: any, index: number, shown: any[]) => (
              <View
                key={txn._id || txn.transactionId}
                style={[styles.item, index === shown.length - 1 && styles.itemLast]}
              >
                <View style={styles.itemTop}>
                  <IconTile icon="card-account-details-outline" size={44} iconSize={20} />
                  <Text style={styles.itemType}>
                    {String(txn.type || 'PAN').replace(/_/g, ' ')}
                  </Text>
                  <StatusText status={txn.status} />
                </View>
                <Row label="Amount" value={money(txn.amount)} mono />
                <Row label="Application" value={txn.metadata?.application_number} />
                <Row label="PSA ID" value={txn.metadata?.psa_id} />
                <Row label="Date" value={shortDate(txn.createdAt)} last />
              </View>
            ))
          ) : (
            <EmptyState icon="card-account-details-outline" title="No PAN applications yet" />
          )}
        </CardContent>
      </Card>
    </Screen>
  );
};

/* ------------------------------------------------------------------ eSeva */

const EsevaTab: React.FC<{ onNotice: (m: string) => void; onDone: () => void }> = ({
  onNotice,
  onDone,
}) => {
  const [panNumber, setPanNumber] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [stateName, setStateName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [pincode, setPincode] = useState('');
  const [showStates, setShowStates] = useState(false);
  const [stateQuery, setStateQuery] = useState('');
  const [statusQuery, setStatusQuery] = useState('');
  const [couponCount, setCouponCount] = useState('1');

  const psa = useAsync<any>(async () => await api.getMyPsaId(), []);
  // The agency name eSeva expects on a coupon order is the retailer's own PSA
  // ID, so it is filled from their PSA record instead of typed every time.
  const agencyName = String(psa.data?.psa_id ?? '');

  const apply = useAction(async () => {
    const res = await api.applyPanService({
      pan_number: panNumber.trim().toUpperCase(),
      shop_name: shopName.trim(),
      shop_address: shopAddress.trim(),
      state_name: stateName,
      district_name: districtName.trim(),
      pincode: pincode.trim(),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const buyCoupons = useAction(async () => {
    const res = await api.applyPanCoupon({
      psa_id: psa.data?.psa_id,
      number_of_coupons: Number(couponCount),
      pan_agency_name: agencyName.trim(),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  // Agency applications and coupon purchases have separate application
  // numbers at eSeva, so each is queried against its own endpoint.
  const checkStatus = useAction(async (kind: 'service' | 'coupon') => {
    const res =
      kind === 'coupon'
        ? await api.getPanCouponStatus(statusQuery.trim())
        : await api.getPanServiceStatus(statusQuery.trim());
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const panValid = PAN_RE.test(panNumber.trim().toUpperCase());
  const valid =
    panValid &&
    shopName.trim().length > 2 &&
    shopAddress.trim().length > 4 &&
    !!stateName &&
    districtName.trim().length > 2 &&
    pincode.length === 6;

  const filteredStates = useMemo(
    () => INDIAN_STATES.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase())),
    [stateQuery]
  );

  const hasPsa = !!psa.data?.psa_id;

  return (
    <>
      <SectionTitle>Your eSeva PSA</SectionTitle>
      <Card>
        <CardContent>
          {psa.loading ? (
            <SkeletonRows count={1} amount={false} />
          ) : (
          <>
          <Row label="PSA ID" value={psa.data?.psa_id || 'Not issued yet'} />
          <Row label="Status" value={<StatusText status={psa.data?.status || 'PENDING'} />} />
          <Row label="Application number" value={psa.data?.application_number} last />
          </>
          )}
        </CardContent>
      </Card>

      {/* Registration only when the lookup has answered with no PSA ID — never
          while it is still loading, or it flashes for retailers who have one. */}
      {!psa.loading && !hasPsa && (
        <>
          <SectionTitle>Apply for PAN agency</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Input
                label="PAN number"
                required
                value={panNumber}
                onChangeText={(v) => setPanNumber(v.toUpperCase().slice(0, 10))}
                autoCapitalize="characters"
                maxLength={10}
                placeholder="ABCDE1234F"
                leftIcon="card-account-details-outline"
                error={panNumber.length === 10 && !panValid ? 'Invalid PAN format' : undefined}
                helperText="5 letters, 4 digits, 1 letter"
              />
              <Input label="Shop name" required value={shopName} onChangeText={setShopName} leftIcon="storefront-outline" />
              <Input
                label="Shop address"
                required
                value={shopAddress}
                onChangeText={setShopAddress}
                multiline
                leftIcon="map-marker-outline"
              />
              <Input label="District" required value={districtName} onChangeText={setDistrictName} leftIcon="city" />
              <Input
                label="Pincode"
                required
                value={pincode}
                onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                leftIcon="mailbox-outline"
              />
              <SelectField
                label="State"
                required
                value={stateName}
                placeholder="Select state"
                open={showStates}
                onPress={() => setShowStates(!showStates)}
              />
              {showStates && (
                <View style={styles.picker}>
                  <Input placeholder="Search state" value={stateQuery} onChangeText={setStateQuery} leftIcon="magnify" />
                  <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredStates.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          setStateName(s);
                          setShowStates(false);
                          setStateQuery('');
                        }}
                        style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                        accessibilityRole="button"
                      >
                        <Text style={styles.pickerText}>{s}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              {!!apply.error && <ErrorBanner message={apply.error} />}
              <Button
                onPress={async () => {
                  const res = await apply.run();
                  if (res) {
                    onNotice(res.message || 'PAN agency application submitted.');
                    psa.reload();
                    onDone();
                  }
                }}
                disabled={!valid}
                loading={apply.pending}
                icon="send-outline"
                size="lg"
                fullWidth
              >
                Submit application
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {hasPsa && (
        <>
          <SectionTitle>Buy PAN coupons</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Input
                label="Agency name"
                value={agencyName}
                editable={false}
                leftIcon="storefront-outline"
                helperText="Your PSA ID, filled in automatically"
              />
              <Input
                label="Number of coupons"
                required
                value={couponCount}
                onChangeText={(v) => setCouponCount(v.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                leftIcon="numeric"
              />
              {!!buyCoupons.error && <ErrorBanner message={buyCoupons.error} />}
              <Button
                onPress={async () => {
                  const res = await buyCoupons.run();
                  if (res) {
                    onNotice(res.message || 'Coupon request submitted.');
                    onDone();
                  }
                }}
                disabled={!agencyName.trim() || Number(couponCount) < 1}
                loading={buyCoupons.pending}
                icon="cart-outline"
                fullWidth
              >
                Buy coupons
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <SectionTitle>Check application status</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <Input
            label="Application number"
            value={statusQuery}
            onChangeText={setStatusQuery}
            autoCapitalize="characters"
            leftIcon="identifier"
          />
          {!!checkStatus.error && <ErrorBanner message={checkStatus.error} />}
          <View style={styles.statusRow}>
            <Button
              variant="outline"
              onPress={async () => {
                const res = await checkStatus.run('service');
                if (res) onNotice(res.message || `Status: ${res.data?.status ?? 'updated'}`);
              }}
              loading={checkStatus.pending}
              disabled={statusQuery.trim().length < 4}
              icon="store-search-outline"
              style={styles.flex}
            >
              Agency
            </Button>
            <Button
              variant="outline"
              onPress={async () => {
                const res = await checkStatus.run('coupon');
                if (res) onNotice(res.message || `Status: ${res.data?.status ?? 'updated'}`);
              }}
              loading={checkStatus.pending}
              disabled={statusQuery.trim().length < 4}
              icon="ticket-confirmation-outline"
              style={styles.flex}
            >
              Coupon
            </Button>
          </View>
        </CardContent>
      </Card>
    </>
  );
};

/* -------------------------------------------------------------- Biometric */

const BiometricTab: React.FC<{ onNotice: (m: string) => void; onDone: () => void }> = ({
  onNotice,
  onDone,
}) => {
  const [linkPsaId, setLinkPsaId] = useState('');
  const [manualStatus, setManualStatus] = useState('APPROVED');
  const [couponAmount, setCouponAmount] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const psa = useAsync<any>(async () => await api.getMyPsaStatus(), []);

  const linkPsa = useAction(async () => {
    const res = await api.setPsaId(linkPsaId.trim());
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const syncStatus = useAction(async () => {
    const res = await api.syncPsaStatus({ psa_id: linkPsaId.trim() || psa.data?.data?.psa_id, status: manualStatus });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const buy = useAction(async () => {
    const res = await api.buyPanCoupons({
      psa_id: psa.data?.data?.psa_id,
      amount: Number(couponAmount),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const existing = psa.data?.data;
  const hasPsa = !!psa.data?.hasPsa;

  return (
    <>
      <SectionTitle>Biometric PSA</SectionTitle>
      <Card>
        <CardContent>
          <Row label="PSA ID" value={existing?.psa_id || 'Not registered'} />
          <Row label="Status" value={<StatusText status={existing?.status || 'PENDING'} />} />
          <Row label="Registered" value={shortDate(existing?.createdAt)} last />
        </CardContent>
      </Card>

      {!hasPsa && (
        <Card>
          <CardContent style={styles.form}>
            <Banner
              tone="info"
              message="Register once as a biometric PSA agent to start filing PAN applications. Already registered elsewhere? Link the PSA ID instead."
            />
            <Button
              onPress={() => setShowRegister(true)}
              size="lg"
              fullWidth
            >
              Register as PSA agent
            </Button>
            <Input
              label="Existing PSA ID"
              value={linkPsaId}
              onChangeText={setLinkPsaId}
              autoCapitalize="characters"
              leftIcon="link-variant"
              helperText="Link an agent you already registered elsewhere"
            />
            {!!linkPsa.error && <ErrorBanner message={linkPsa.error} />}
            <Button
              onPress={async () => {
                const res = await linkPsa.run();
                if (res) {
                  onNotice(`PSA ID ${linkPsaId} linked.`);
                  psa.reload();
                }
              }}
              disabled={linkPsaId.trim().length < 3}
              loading={linkPsa.pending}
              icon="link-variant"
              fullWidth
            >
              Link PSA ID
            </Button>
          </CardContent>
        </Card>
      )}

      <SectionTitle>Sync status</SectionTitle>
      <Card>
        <CardContent style={styles.form}>
          <Segmented
            options={[
              { key: 'APPROVED', label: 'Approved' },
              { key: 'PENDING', label: 'Pending' },
              { key: 'REJECTED', label: 'Rejected' },
            ]}
            value={manualStatus}
            onChange={setManualStatus}
          />
          {!!syncStatus.error && <ErrorBanner message={syncStatus.error} />}
          <Button
            variant="outline"
            onPress={async () => {
              const res = await syncStatus.run();
              if (res) {
                onNotice(`Status synced to ${manualStatus}.`);
                psa.reload();
              }
            }}
            loading={syncStatus.pending}
            disabled={!existing?.psa_id && !linkPsaId.trim()}
            icon="sync"
            fullWidth
          >
            Sync PSA status
          </Button>
        </CardContent>
      </Card>

      {hasPsa && (
        <>
          <SectionTitle>Buy coupons</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Input
                label="Amount"
                required
                value={couponAmount}
                onChangeText={(v) => setCouponAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                leftIcon="currency-inr"
              />
              {!!buy.error && <ErrorBanner message={buy.error} />}
              <Button
                onPress={async () => {
                  const res = await buy.run();
                  if (res) {
                    onNotice(res.message || 'Coupon payment submitted.');
                    onDone();
                  }
                }}
                disabled={Number(couponAmount) <= 0}
                loading={buy.pending}
                icon="cart-outline"
                fullWidth
              >
                Buy coupons
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <PsaRegistrationSheet
        visible={showRegister}
        kind="biometric"
        onClose={() => setShowRegister(false)}
        onDone={(message) => {
          onNotice(message);
          psa.reload();
        }}
      />
    </>
  );
};

/* --------------------------------------------------------------- Standard */

const StandardTab: React.FC<{ onNotice: (m: string) => void; onDone: () => void }> = ({
  onNotice,
  onDone,
}) => {
  const [couponAmount, setCouponAmount] = useState('');
  const [showRegister, setShowRegister] = useState(false);

  const psa = useAsync<any>(async () => await api.getMyStdPsaStatus(), []);
  const password = useAction(async () => {
    const res = await api.getStdPsaPassword();
    if (!res.success) throw new Error(res.message);
    return res;
  });
  const buy = useAction(async () => {
    const res = await api.buyStdPanCoupons({
      psa_id: psa.data?.data?.psa_id,
      amount: Number(couponAmount),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const existing = psa.data?.data;
  const hasPsa = !!psa.data?.hasPsa;

  return (
    <>
      <SectionTitle>Standard PSA</SectionTitle>
      <Card>
        <CardContent>
          <Row label="PSA ID" value={existing?.psa_id || 'Not registered'} />
          <Row label="Status" value={<StatusText status={existing?.status || 'PENDING'} />} />
          <Row label="Registered" value={shortDate(existing?.createdAt)} last />
          {/* The provider only accepts a resubmission after a rejection. */}
          {['REJECTED', 'FAILED'].includes(String(existing?.status).toUpperCase()) && (
            <Button
              variant="outline"
              icon="refresh"
              onPress={() => setShowRegister(true)}
              style={{ marginTop: space.md }}
              fullWidth
            >
              Fix and resubmit application
            </Button>
          )}
        </CardContent>
      </Card>

      {!hasPsa ? (
        <Card>
          <CardContent style={styles.form}>
            <Banner
              tone="info"
              message="Register as a standard PSA agent to file PAN applications through the PSA portal. Approval usually takes a working day."
            />
            <Button
              onPress={() => setShowRegister(true)}
              size="lg"
              fullWidth
            >
              Register as standard PSA
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <SectionTitle>Portal password</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              {!!password.error && <ErrorBanner message={password.error} />}
              {!!password.pending === false && null}
              <Button
                variant="outline"
                onPress={async () => {
                  const res = await password.run();
                  if (res) onNotice(`Portal password: ${res.password ?? res.data?.password ?? 'sent'}`);
                }}
                loading={password.pending}
                icon="key-outline"
                fullWidth
              >
                Reveal portal password
              </Button>
            </CardContent>
          </Card>

          <SectionTitle>Buy coupons</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Input
                label="Amount"
                required
                value={couponAmount}
                onChangeText={(v) => setCouponAmount(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                leftIcon="currency-inr"
              />
              {!!buy.error && <ErrorBanner message={buy.error} />}
              <Button
                onPress={async () => {
                  const res = await buy.run();
                  if (res) {
                    onNotice(res.message || 'Coupon payment submitted.');
                    onDone();
                  }
                }}
                disabled={Number(couponAmount) <= 0}
                loading={buy.pending}
                icon="cart-outline"
                fullWidth
              >
                Buy coupons
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <PsaRegistrationSheet
        visible={showRegister}
        kind="standard"
        existing={existing}
        onClose={() => setShowRegister(false)}
        onDone={(message) => {
          onNotice(message);
          psa.reload();
        }}
      />
    </>
  );
};

/** BHIM status: small coloured text, never a filled pill. */
const StatusText: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status || 'PENDING').toUpperCase();
  const color = /SUCCESS|COMPLETE|APPROVED|ACTIVE|ACCEPTED|CONVERTED/.test(s)
    ? colors.success
    : /FAIL|REJECT/.test(s)
      ? colors.destructive
      : colors.warning;
  return (
    <Text style={{ fontSize: t.small, fontWeight: '500', color }}>
      {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
    </Text>
  );
};

const styles = themed((c) => ({
  statusRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  form: { gap: space.lg },
  picker: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  item: { paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: c.border },
  itemLast: { borderBottomWidth: 0 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: 2,
  },
  itemType: { flex: 1, minWidth: 0, fontSize: t.body + 1, fontWeight: '500', color: c.foreground },
}));

export default PanCardScreen;
