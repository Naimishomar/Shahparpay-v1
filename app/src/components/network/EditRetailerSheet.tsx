import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, Row, StatusPill, SuccessBanner, money } from '@/components/ui/Screen';
import { useAction } from '@/hooks/useAsync';
import { INDIAN_STATES } from '@/constants';
import api from '@/services/api';

const SERVICE_PACKAGES = [
  { key: 'dmtPackage', label: 'DMT' },
  { key: 'rechargePackage', label: 'Recharge' },
  { key: 'aepsPackage', label: 'AEPS' },
  { key: 'bbpsPackage', label: 'BBPS' },
  { key: 'payoutPackage', label: 'Payout' },
  { key: 'cmsPackage', label: 'CMS' },
  { key: 'ccpayPackage', label: 'CCPay' },
  { key: 'payinPackage', label: 'Payin' },
  { key: 'upiPackage', label: 'UPI' },
] as const;

const PACKAGES = ['Standard', 'Premium'];

/**
 * Retailer detail + edit, opened from the distributor portal's list. Only the
 * fields the backend's updateRetailer accepts are shown; identity documents
 * are read-only here because changing them would desync the merchant's KYC.
 */
export const EditRetailerSheet: React.FC<{
  retailer: any | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ retailer, onClose, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [packages, setPackages] = useState<Record<string, string>>({});
  const [openPackage, setOpenPackage] = useState<string | null>(null);

  // Seeding on open rather than in an effect: the sheet is mounted per
  // selection, so this runs exactly once per retailer.
  const startEditing = () => {
    setFirstName(retailer?.firstName ?? '');
    setLastName(retailer?.lastName ?? '');
    setContactNumber(retailer?.contactNumber ?? '');
    setBusinessName(retailer?.businessName ?? '');
    setBusinessAddress(retailer?.businessAddress ?? '');
    setCity(retailer?.address?.city ?? '');
    setDistrict(retailer?.address?.district ?? '');
    setState(retailer?.address?.state ?? '');
    setIsActive(retailer?.isActive !== false);
    setPackages(
      Object.fromEntries(
        SERVICE_PACKAGES.map((service) => [service.key, retailer?.[service.key] ?? '']).filter(
          ([, value]) => value
        )
      ) as Record<string, string>
    );
    setPassword('');
    setSaved(false);
    setEditing(true);
  };

  const save = useAction(async () => {
    const res = await api.updateRetailer(retailer._id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      contactNumber: contactNumber.trim(),
      businessName: businessName.trim(),
      businessAddress: businessAddress.trim(),
      address: { city: city.trim(), district: district.trim(), state },
      isActive,
      // Omitted when blank so the controller leaves the existing hash alone.
      ...(password ? { password } : {}),
      ...packages,
    });
    if (!res.success) throw new Error(res.message || 'Could not update the retailer.');
    setSaved(true);
    setEditing(false);
    onSaved();
    return res;
  });

  if (!retailer) return null;

  return (
    <Sheet
      visible
      onClose={onClose}
      title={retailer.businessName || retailer.name || retailer.retailerId}
      subtitle={retailer.retailerId}
      icon="store-outline"
      dismissible={!save.pending}
      footer={
        editing ? (
          <View style={styles.footerRow}>
            <Button variant="secondary" onPress={() => setEditing(false)} style={styles.flex}>
              Cancel
            </Button>
            <Button
              icon="content-save-outline"
              onPress={save.run}
              loading={save.pending}
              style={styles.flex}
            >
              Save changes
            </Button>
          </View>
        ) : (
          <Button icon="pencil-outline" onPress={startEditing} fullWidth>
            Edit retailer
          </Button>
        )
      }
    >
      {saved && <SuccessBanner message="Retailer updated." />}

      {editing ? (
        <>
          <Input label="First name" value={firstName} onChangeText={setFirstName} leftIcon="account-outline" autoCapitalize="words" />
          <Input label="Last name" value={lastName} onChangeText={setLastName} leftIcon="account-outline" autoCapitalize="words" />
          <Input
            label="Mobile number"
            value={contactNumber}
            onChangeText={(v) => setContactNumber(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            leftIcon="phone-outline"
          />
          <Input label="Business name" value={businessName} onChangeText={setBusinessName} leftIcon="storefront-outline" />
          <Input label="Street address" value={businessAddress} onChangeText={setBusinessAddress} leftIcon="map-marker-outline" />
          <Input label="City" value={city} onChangeText={setCity} leftIcon="city-variant-outline" />
          <Input label="District" value={district} onChangeText={setDistrict} leftIcon="map-outline" />

          <View>
            <SelectField
              label="State"
              value={state}
              placeholder="Select the state"
              open={stateOpen}
              onPress={() => setStateOpen(!stateOpen)}
            />
            {stateOpen && (
              <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                {INDIAN_STATES.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setState(option);
                      setStateOpen(false);
                    }}
                    style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>{option}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <Input
            label="Reset password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-reset"
            placeholder="Leave blank to keep the current one"
            helperText="Setting this signs them out of nothing — it just replaces the password"
          />

          <Pressable
            onPress={() => setIsActive(!isActive)}
            style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.8 }]}
            accessibilityRole="switch"
            accessibilityState={{ checked: isActive }}
            accessibilityLabel="Account active"
          >
            <MaterialCommunityIcons
              name={isActive ? 'checkbox-marked' : 'checkbox-blank-outline'}
              size={22}
              color={isActive ? colors.accent : colors.mutedForeground}
            />
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Account active</Text>
              <Text style={styles.toggleHint}>
                Turning this off blocks the retailer from signing in and transacting.
              </Text>
            </View>
          </Pressable>

          <Text style={styles.sectionHint}>Commission packages</Text>
          {SERVICE_PACKAGES.map((service) => (
            <View key={service.key}>
              <SelectField
                label={`${service.label} package`}
                value={packages[service.key] ?? ''}
                placeholder="Platform default"
                open={openPackage === service.key}
                onPress={() => setOpenPackage(openPackage === service.key ? null : service.key)}
              />
              {openPackage === service.key && (
                <View style={styles.picker}>
                  {PACKAGES.map((option) => (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setPackages({ ...packages, [service.key]: option });
                        setOpenPackage(null);
                      }}
                      style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerText}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ))}

          {!!save.error && <Banner tone="error" message={save.error} />}
        </>
      ) : (
        <>
          <View style={styles.details}>
            <Row label="Status" value={<StatusPill status={retailer.isActive === false ? 'INACTIVE' : 'ACTIVE'} />} />
            <Row label="Retailer ID" value={retailer.retailerId} mono />
            <Row label="Owner" value={retailer.name} />
            <Row label="Email" value={retailer.email} />
            <Row label="Mobile" value={retailer.contactNumber} mono />
            <Row label="Business" value={retailer.businessName} />
            <Row
              label="Address"
              value={[retailer.address?.city, retailer.address?.district, retailer.address?.state]
                .filter(Boolean)
                .join(', ') || '—'}
            />
            <Row label="Aadhaar" value={retailer.aadhaarNumber || '—'} mono />
            <Row label="PAN" value={retailer.panNumber || '—'} mono />
            <Row
              label="Merchant eKYC"
              value={<StatusPill status={retailer.isMerchantKycComplete ? 'COMPLETED' : 'PENDING'} />}
              last
            />
          </View>

          <View style={styles.details}>
            <Row label="AEPS wallet" value={money(retailer.aepsWalletBalance)} mono />
            <Row label="Main wallet" value={money(retailer.mainWalletBalance)} mono />
            <Row label="Commissions earned" value={money(retailer.commissionsEarned)} mono last />
          </View>

          <View style={styles.details}>
            {SERVICE_PACKAGES.map((service, index) => (
              <Row
                key={service.key}
                label={`${service.label} package`}
                value={retailer[service.key] || 'Platform default'}
                last={index === SERVICE_PACKAGES.length - 1}
              />
            ))}
          </View>
        </>
      )}
    </Sheet>
  );
};

const styles = themed((c) => ({
  footerRow: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  details: {
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  picker: { marginTop: 6, borderRadius: radius.md, backgroundColor: c.secondary, padding: space.xs },
  pickerScroll: {
    marginTop: 6,
    maxHeight: 220,
    borderRadius: radius.md,
    backgroundColor: c.secondary,
    padding: space.xs,
  },
  pickerItem: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  pickerItemPressed: { backgroundColor: c.surfaceAlt },
  pickerText: { fontSize: t.small, color: c.foreground },
  sectionHint: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 44 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: t.small, fontWeight: '600', color: c.foreground },
  toggleHint: { fontSize: t.micro, color: c.mutedForeground, lineHeight: 16 },
}));

export default EditRetailerSheet;
