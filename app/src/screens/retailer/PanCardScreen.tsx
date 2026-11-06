import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/Gradient';
import { Input, SelectField } from '@/components/ui/Input';
import {
  Screen,
  SectionTitle,
  Banner,
  ErrorBanner,
  Row,
  Segmented,
  SuccessBanner,
  Toast,
  money,
  shortDate,
  SkeletonRows,
} from '@/components/ui/Screen';
import { PsaRegistrationSheet } from '@/components/pan/PsaRegistrationSheet';
import { useAsync, useAction } from '@/hooks/useAsync';
import locations from '@/data/locations.json';
import api from '@/services/api';

// Same state/district source as the web form (frontend/src/data/locations.json).
type Place = { id: string; name: string };
const LOCATIONS = locations as (Place & { districts?: Place[] })[];
const STATES = [...LOCATIONS].sort((a, b) => a.name.localeCompare(b.name));
const districtsOf = (stateName: string) =>
  [...(LOCATIONS.find((s) => s.name === stateName)?.districts ?? [])].sort((a, b) => a.name.localeCompare(b.name));

// Biometric and Standard PSA are switched off, as on the website: only the
// eSeva flow is offered. Their tabs below are kept intact for when the
// provider brings them back — restore the tab bar and these two lines then.
const TABS = [
  { key: 'eseva', label: 'eSeva' },
  { key: 'bio', label: 'Biometric' },
  { key: 'std', label: 'Standard' },
];
const ENABLED_TABS = TABS.filter((t) => t.key === 'eseva');

type Notify = (message: string, tone?: 'success' | 'error') => void;

export const PanCardScreen: React.FC = () => {
  const [tab, setTab] = useState('eseva');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>({ message: '', tone: 'error' });
  const notify: Notify = (message, tone = 'error') => setToast({ message, tone });

  return (
    <Screen
      refreshing={false}
      onRefresh={() => {
        api.invalidateCache();
        setRefreshKey((k) => k + 1);
      }}
      overlay={<Toast message={toast.message} tone={toast.tone} onHide={() => setToast((s) => ({ ...s, message: '' }))} />}
    >
      {ENABLED_TABS.length > 1 && (
        <Segmented options={ENABLED_TABS} value={tab} onChange={setTab} scroll={false} />
      )}
      {!!notice && <SuccessBanner message={notice} />}

      {tab === 'eseva' && <EsevaTab refreshKey={refreshKey} notify={notify} />}
      {tab === 'bio' && <BiometricTab onNotice={setNotice} onDone={() => {}} />}
      {tab === 'std' && <StandardTab onNotice={setNotice} onDone={() => {}} />}
    </Screen>
  );
};

/* ------------------------------------------------------------------ eSeva */
// Mirrors frontend/src/components/pancard/EsevaPanTab.tsx field for field.

type SubTab = 'SERVICE' | 'COUPON' | 'STATUS';
const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'SERVICE', label: 'PAN Service' },
  { key: 'COUPON', label: 'PAN Coupon' },
  { key: 'STATUS', label: 'Status & History' },
];
const EMPTY_SERVICE = { pan_number: '', shop_name: '', shop_address: '', state_name: '', district_name: '', pincode: '' };

const EsevaTab: React.FC<{ notify: Notify; refreshKey: number }> = ({ notify, refreshKey }) => {
  const [sub, setSub] = useState<SubTab>('SERVICE');
  const [form, setForm] = useState(EMPTY_SERVICE);
  const [picker, setPicker] = useState<'state' | 'district' | null>(null);
  const [query, setQuery] = useState('');
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceResult, setServiceResult] = useState<any>(null);

  const [psaId, setPsaId] = useState('');
  const [couponCount, setCouponCount] = useState('1');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponResult, setCouponResult] = useState<any>(null);

  const [appNumber, setAppNumber] = useState('');
  const [statusLoading, setStatusLoading] = useState<'SERVICE' | 'COUPON' | null>(null);
  const [statusResult, setStatusResult] = useState<any>(null);

  const myPsa = useAsync<string | null>(async () => {
    const res = await api.getMyPsaId();
    const id = res?.success && res?.psa_id ? String(res.psa_id) : null;
    if (id) setPsaId(id);
    return id;
  }, [refreshKey]);
  const myPsaId = myPsa.data ?? null;
  const hasPsaId = !!myPsaId;

  const history = useAsync<any[]>(async () => {
    const res = await api.getPanHistory();
    return res?.success ? res.transactions ?? res.data ?? [] : [];
  }, [refreshKey]);

  const options = useMemo(() => {
    const list = picker === 'district' ? districtsOf(form.state_name) : picker === 'state' ? STATES : [];
    const q = query.trim().toLowerCase();
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [picker, query, form.state_name]);

  const set = (patch: Partial<typeof EMPTY_SERVICE>) => setForm((f) => ({ ...f, ...patch }));
  const errorOf = (error: any, fallback: string) => error?.response?.data?.message || fallback;

  const applyService = async () => {
    if (hasPsaId) return notify('Your PSA ID is already generated. No need to apply for PAN Service again.');
    // The web form's `required` attributes block an empty submit.
    if (Object.values(form).some((v) => !v.trim())) return notify('Please fill in all required fields.');
    if (form.pan_number.length !== 10) return notify('PAN number must be 10 characters');
    if (form.pincode.length !== 6) return notify('Pincode must be 6 digits');
    setServiceLoading(true);
    setServiceResult(null);
    try {
      const res = await api.applyPanService({ ...form, pan_number: form.pan_number.toUpperCase() });
      if (res.success) {
        setServiceResult(res);
        notify(res.message || 'PAN Service application submitted successfully!', 'success');
        history.reload();
      } else {
        notify(res.message || 'Failed to submit PAN Service application.');
      }
    } catch (error) {
      notify(errorOf(error, 'An error occurred. Please try again.'));
    } finally {
      setServiceLoading(false);
    }
  };

  const applyCoupon = async () => {
    if (!psaId.trim()) return notify('PSA ID is required');
    if (!couponCount || Number(couponCount) < 1) return notify('Minimum 1 coupon is required');
    setCouponLoading(true);
    setCouponResult(null);
    try {
      const res = await api.applyPanCoupon({
        psa_id: psaId.trim(),
        number_of_coupons: Number(couponCount),
        pan_agency_name: 'UTIITSL',
      });
      if (res.success) {
        setCouponResult(res);
        notify(res.message || 'PAN Coupon request submitted successfully!', 'success');
        history.reload();
      } else {
        notify(res.message || 'Failed to submit PAN Coupon request.');
      }
    } catch (error) {
      notify(errorOf(error, 'An error occurred. Please try again.'));
    } finally {
      setCouponLoading(false);
    }
  };

  const checkStatus = async (type: 'SERVICE' | 'COUPON', number?: number | string) => {
    const application_number = number ?? appNumber;
    if (!application_number) return notify('Enter the application number');
    setStatusLoading(type);
    setStatusResult(null);
    try {
      const res =
        type === 'SERVICE'
          ? await api.getPanServiceStatus(Number(application_number))
          : await api.getPanCouponStatus(Number(application_number));
      if (res.success) {
        setStatusResult(res);
        setAppNumber(String(application_number));
        notify('Status fetched successfully!', 'success');
        history.reload();
      } else {
        notify(res.message || 'Failed to fetch status.');
      }
    } catch (error) {
      notify(errorOf(error, 'An error occurred while checking status.'));
    } finally {
      setStatusLoading(null);
    }
  };

  const count = Math.max(0, Number(couponCount) || 0);
  const setCount = (n: number) => setCouponCount(String(Math.max(1, n)));
  const psaVerified = !!myPsaId && psaId.trim() === myPsaId;

  const renderResult = (result: any, type: 'SERVICE' | 'COUPON') => (
    <Card>
      <CardContent style={styles.form}>
        <SuccessBanner message="Application Submitted Successfully" />
        <View>
          <Row label="Application No." value={`#${result.application_number ?? ''}`} />
          <Row label="Admin Fee" value={money(result.admin_fee)} />
          <Row label="GST (18%)" value={money(result.gst_amount)} />
          <Row label="Total Debited" value={money(result.final_amount)} />
          <Row label="Commission" value={money(result.commission_amount)} />
          <Row label="Net Credit (after 2% TDS)" value={money(result.net_commission)} />
          {result.number_of_coupons !== undefined && <Row label="Number of Coupons" value={String(result.number_of_coupons)} />}
          {!!result.psa_id && <Row label="PSA ID" value={result.psa_id} mono />}
          <Row label="New Wallet Balance" value={money(result.new_wallet_balance)} last />
        </View>
        {!!result.warning && <Banner tone="warning" message={result.warning} />}
        <Button
          onPress={() => checkStatus(type, result.application_number)}
          loading={statusLoading === type}
          disabled={statusLoading !== null}
          icon="magnify"
          fullWidth
        >
          Check Live Status
        </Button>
      </CardContent>
    </Card>
  );

  const pickerList = !!picker && (
    <View style={styles.picker}>
      <Input
        placeholder={picker === 'state' ? 'Search state' : 'Search district'}
        value={query}
        onChangeText={setQuery}
        leftIcon="magnify"
      />
      <ScrollView style={styles.pickerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {options.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              set(picker === 'state' ? { state_name: p.name, district_name: '' } : { district_name: p.name });
              setPicker(null);
              setQuery('');
            }}
            style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.pickerText}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <>
      <Card>
        <CardContent style={styles.form}>
          <View style={styles.inline}>
            <IconTile icon="card-account-details-outline" size={48} iconSize={22} />
            <View style={styles.flex}>
              <Text style={styles.title}>PAN Card Services</Text>
              <Text style={styles.help}>Get your PSA ID, buy UTI PAN coupons and track applications.</Text>
            </View>
          </View>
          {!!myPsaId && <Row label="PSA ID" value={myPsaId} mono last />}
        </CardContent>
      </Card>
      <Segmented options={SUB_TABS} value={sub} onChange={setSub} />

      {sub === 'SERVICE' && (
        <>
          <SectionTitle>PAN Service</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              {[
                ['1', 'Submit Application', 'Apply for PAN Service for your shop / agent.'],
                ['2', 'Auto Wallet Debit', 'Admin Fee + 18% GST debited instantly.'],
                ['3', 'PSA ID on Approval', 'After admin approval, PSA ID is assigned and you can apply for PAN Coupons.'],
              ].map(([n, title, text]) => (
                <View key={n} style={styles.inline}>
                  <View style={styles.stepNo}><Text style={styles.stepNoText}>{n}</Text></View>
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{title}</Text>
                    <Text style={styles.help}>{text}</Text>
                  </View>
                </View>
              ))}
            </CardContent>
          </Card>

          <SectionTitle>PAN Service Application Form</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              {hasPsaId ? (
                <>
                  <SuccessBanner message="PSA ID Already Generated" />
                  <Text style={styles.help}>
                    Your PSA ID <Text style={styles.strong}>#{myPsaId}</Text> has already been generated and approved.
                    There is no need to apply for the PAN Service again — you can directly purchase PAN coupons using your
                    PSA ID.
                  </Text>
                  <Row label="Your PSA ID" value={myPsaId!} mono last />
                  <Button onPress={() => setSub('COUPON')} icon="shopping-outline" fullWidth>
                    Go to PAN Coupon
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    label="Shop / Business Name"
                    required
                    value={form.shop_name}
                    onChangeText={(shop_name) => set({ shop_name })}
                    leftIcon="storefront-outline"
                    placeholder="Enter shop / business name"
                  />
                  <Input
                    label="Agent / Shop PAN Number"
                    required
                    value={form.pan_number}
                    onChangeText={(v) => set({ pan_number: v.toUpperCase() })}
                    autoCapitalize="characters"
                    maxLength={10}
                    leftIcon="card-account-details-outline"
                    placeholder="10-character PAN (e.g. ABCDE1234F)"
                  />
                  <Input
                    label="Full Shop Address"
                    required
                    value={form.shop_address}
                    onChangeText={(shop_address) => set({ shop_address })}
                    leftIcon="map-marker-outline"
                    placeholder="Shop No., Market, Road, Near landmark"
                  />
                  <SelectField
                    label="State"
                    required
                    value={form.state_name}
                    placeholder="Select State"
                    open={picker === 'state'}
                    onPress={() => {
                      setQuery('');
                      setPicker(picker === 'state' ? null : 'state');
                    }}
                  />
                  {picker === 'state' && pickerList}
                  <SelectField
                    label="District"
                    required
                    value={form.district_name}
                    placeholder="Select District"
                    open={picker === 'district'}
                    onPress={() => {
                      if (!form.state_name) return;
                      setQuery('');
                      setPicker(picker === 'district' ? null : 'district');
                    }}
                  />
                  {picker === 'district' && pickerList}
                  <Input
                    label="Pincode"
                    required
                    value={form.pincode}
                    onChangeText={(v) => set({ pincode: v.replace(/\D/g, '').slice(0, 6) })}
                    keyboardType="number-pad"
                    maxLength={6}
                    leftIcon="phone-outline"
                    placeholder="6-digit pincode"
                  />
                  <Button onPress={applyService} loading={serviceLoading} icon="chevron-right" size="lg" fullWidth>
                    {serviceLoading ? 'Submitting PAN Service Application...' : 'Submit PAN Service Application'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          {!hasPsaId && !!serviceResult && renderResult(serviceResult, 'SERVICE')}
        </>
      )}

      {sub === 'COUPON' && (
        <>
          <SectionTitle>Apply PAN Coupons</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Text style={styles.help}>Only for agents whose PAN Service is approved and PSA ID is assigned.</Text>
              <Input
                label="PSA ID"
                required
                value={psaId}
                onChangeText={setPsaId}
                autoCapitalize="none"
                leftIcon="key-outline"
                rightIcon={psaVerified ? 'check-decagram-outline' : undefined}
                placeholder="Enter approved PSA ID"
                helperText={
                  psaId
                    ? `${psaVerified ? 'Verified. ' : ''}Auto-filled from your approved PAN Service. You can still edit it.`
                    : 'Auto-filled once your PAN Service is approved.'
                }
              />
              <View style={styles.field}>
                <Text style={styles.label}>Number of Coupons</Text>
                <View style={styles.inline}>
                  <Button variant="outline" onPress={() => setCount(count - 1)} disabled={count <= 1} accessibilityLabel="Fewer coupons">
                    −
                  </Button>
                  <Input
                    value={couponCount}
                    onChangeText={(v) => setCouponCount(v.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    placeholder="1"
                    containerStyle={styles.flex}
                    style={{ textAlign: 'center' }}
                  />
                  <Button variant="outline" onPress={() => setCount(count + 1)} accessibilityLabel="More coupons">
                    +
                  </Button>
                </View>
                <Segmented
                  options={[1, 5, 10, 25].map((n) => ({ key: String(n), label: `${n} ${n === 1 ? 'coupon' : 'coupons'}` }))}
                  value={String(count)}
                  onChange={(v) => setCount(Number(v))}
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>PAN Agency</Text>
                <View style={styles.inline}>
                  <IconTile icon="card-account-details-outline" size={40} iconSize={18} />
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>UTIITSL</Text>
                    <Text style={styles.help}>UTI Infrastructure Technology and Services Ltd.</Text>
                  </View>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
                </View>
              </View>
            </CardContent>
          </Card>

          <SectionTitle>Summary</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Row label="PAN Coupon" value="UTIITSL" />
              <Row label={count === 1 ? 'application token' : 'application tokens'} value={`×${count || 0}`} />
              <Row label="PSA ID" value={psaId || '—'} mono last />
              <Banner
                tone="info"
                message="Coupon charges are calculated by Shahparpay and debited from your Utility Wallet on submission."
              />
              <Button onPress={applyCoupon} loading={couponLoading} icon="chevron-right" size="lg" fullWidth>
                {couponLoading ? 'Submitting Coupon Request...' : 'Submit PAN Coupon Request'}
              </Button>
            </CardContent>
          </Card>
          {!!couponResult && renderResult(couponResult, 'COUPON')}
        </>
      )}

      {sub === 'STATUS' && (
        <>
          <SectionTitle>Check Application Status</SectionTitle>
          <Card>
            <CardContent style={styles.form}>
              <Text style={styles.help}>Enter the application number returned at submission time.</Text>
              <Input
                value={appNumber}
                onChangeText={setAppNumber}
                keyboardType="number-pad"
                leftIcon="magnify"
                placeholder="Application Number (e.g. 2001)"
              />
              <View style={styles.inline}>
                <Button
                  onPress={() => checkStatus('SERVICE')}
                  loading={statusLoading === 'SERVICE'}
                  disabled={statusLoading !== null}
                  icon="file-document-outline"
                  style={styles.flex}
                >
                  PAN Service
                </Button>
                <Button
                  variant="outline"
                  onPress={() => checkStatus('COUPON')}
                  loading={statusLoading === 'COUPON'}
                  disabled={statusLoading !== null}
                  icon="shopping-outline"
                  style={styles.flex}
                >
                  PAN Coupon
                </Button>
              </View>

              {!!statusResult && (
                <View>
                  <Row label={statusResult.service_type || 'Status'} value={<EsevaStatus status={statusResult.status} />} />
                  <Row label="Application No." value={`#${statusResult.application_number ?? ''}`} />
                  <Row label="Public Remarks" value={statusResult.public_remarks || '—'} />
                  {statusResult.psa_id !== undefined && <Row label="PSA ID" value={statusResult.psa_id || 'Not assigned'} mono />}
                  {!!statusResult.pan_number && <Row label="PAN Number" value={String(statusResult.pan_number).toUpperCase()} mono />}
                  {statusResult.number_of_coupons !== undefined && <Row label="Coupons" value={String(statusResult.number_of_coupons)} />}
                  {statusResult.final_amount !== undefined && <Row label="Amount" value={money(statusResult.final_amount)} />}
                  {!!(statusResult.created_at || statusResult.updated_at) && (
                    <Text style={styles.caption}>
                      Submitted: {statusResult.created_at ? new Date(statusResult.created_at).toLocaleString() : '—'}
                      {!!statusResult.updated_at && statusResult.updated_at !== statusResult.created_at
                        ? `  •  Updated: ${new Date(statusResult.updated_at).toLocaleString()}`
                        : ''}
                    </Text>
                  )}
                </View>
              )}
            </CardContent>
          </Card>

          <SectionTitle>Application History</SectionTitle>
          <Card>
            <CardContent>
              {history.loading ? (
                <SkeletonRows count={3} />
              ) : !history.data?.length ? (
                <Text style={[styles.help, { textAlign: 'center' }]}>
                  No eSevaTech PAN applications yet. Submit a PAN Service or PAN Coupon request to get started.
                </Text>
              ) : (
                history.data.map((tx: any, index: number, all: any[]) => {
                  const isService = tx.type === 'PAN_SERVICE';
                  return (
                    <View key={tx._id || index} style={[styles.item, index === all.length - 1 && styles.itemLast]}>
                      <View style={styles.inline}>
                        <IconTile icon="card-account-details-outline" size={44} iconSize={20} />
                        <Text style={styles.itemType}>{isService ? 'PAN Service' : 'PAN Coupon'}</Text>
                        <EsevaStatus status={tx.metadata?.eseva_status || tx.status || 'PENDING'} />
                      </View>
                      <Row label="Application No." value={`#${tx.metadata?.application_number ?? '—'}`} mono />
                      <Row
                        label="Date"
                        value={new Date(tx.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata',
                        })}
                      />
                      <Row label="Amount" value={money(tx.amount)} last />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="magnify"
                        onPress={() => checkStatus(isService ? 'SERVICE' : 'COUPON', tx.metadata?.application_number)}
                        loading={statusLoading !== null}
                        style={styles.statusButton}
                      >
                        Check Status
                      </Button>
                    </View>
                  );
                })
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
};

/** Web's statusChipClass buckets, as coloured text. */
const EsevaStatus: React.FC<{ status?: string | null }> = ({ status }) => {
  const s = String(status || '').toUpperCase();
  const color =
    s.includes('COMPLET') || s.includes('SUCCESS') || s.includes('APPROV')
      ? colors.success
      : s.includes('REJECT')
        ? colors.destructive
        : s.includes('PROCESS') || s.includes('SUBMIT')
          ? colors.warning
          : colors.mutedForeground;
  return <Text style={{ fontSize: t.small, fontWeight: '500', color }}>{s || 'N/A'}</Text>;
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
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  field: { gap: space.sm },
  label: { fontSize: t.small, fontWeight: '500', color: c.mutedForeground },
  title: { fontSize: t.h2, fontWeight: '500', color: c.foreground },
  help: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  caption: { fontSize: t.caption, color: c.mutedForeground, marginTop: space.sm },
  strong: { fontWeight: '600', color: c.foreground },
  itemTitle: { fontSize: t.body, fontWeight: '500', color: c.foreground },
  stepNo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  stepNoText: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  statusButton: { alignSelf: 'flex-start', marginTop: space.xs },
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
  itemType: { flex: 1, minWidth: 0, fontSize: t.body + 1, fontWeight: '500', color: c.foreground },
}));

export default PanCardScreen;
