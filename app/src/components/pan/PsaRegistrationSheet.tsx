import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { themed, radius, space, type as t } from '../../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Banner, SuccessBanner } from '@/components/ui/Screen';
import { useAction } from '@/hooks/useAsync';
import locations from '@/data/locations.json';
import api from '@/services/api';

interface District {
  id: string;
  name: string;
}
interface State {
  id: string;
  name: string;
  districts: District[];
}

const STATES = [...(locations as State[])].sort((a, b) => a.name.localeCompare(b.name));

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * PSA agent registration for both PAN flavours.
 *
 *   biometric — PaySprint's biometric PSA. Wants the numeric state/district
 *               IDs from locations.json, not their names.
 *   standard  — the standard PSA portal. Wants the state/district *names*,
 *               plus DOB and Aadhaar.
 *
 * Neither needs a fingerprint capture despite the "biometric" label: that name
 * refers to how the agent later files applications, not to registration.
 */
export const PsaRegistrationSheet: React.FC<{
  visible: boolean;
  onClose: () => void;
  kind: 'biometric' | 'standard';
  /** Existing record when re-submitting a rejected standard PSA. */
  existing?: any;
  onDone: (message: string) => void;
}> = ({ visible, onClose, kind, existing, onDone }) => {
  const isStandard = kind === 'standard';
  const isUpdate = isStandard && !!existing?.psa_id;

  const [agencyName, setAgencyName] = useState(existing?.shop_name ?? '');
  const [personName, setPersonName] = useState(existing?.name ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [mobile, setMobile] = useState(existing?.mobile ?? '');
  const [panNo, setPanNo] = useState(existing?.pan_no ?? '');
  const [aadhaar, setAadhaar] = useState('');
  const [dob, setDob] = useState('');
  const [pincode, setPincode] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [location, setLocation] = useState('');

  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [done, setDone] = useState(false);

  const selectedState = useMemo(() => STATES.find((s) => s.id === stateId), [stateId]);
  const districts = useMemo(
    () => [...(selectedState?.districts ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [selectedState]
  );
  const selectedDistrict = districts.find((d) => d.id === districtId);

  const submit = useAction(async () => {
    const payload = isStandard
      ? {
          shop_name: agencyName.trim(),
          name: personName.trim(),
          state: selectedState?.name,
          district: selectedDistrict?.name,
          address: addressLine1.trim(),
          pincode: pincode.trim(),
          mobile: mobile.trim(),
          email: email.trim(),
          dob,
          pan_no: panNo.trim().toUpperCase(),
          aadhar_no: aadhaar.trim(),
          ...(isUpdate ? { psa_id: existing.psa_id } : {}),
        }
      : {
          name: agencyName.trim(),
          contact_person: personName.trim(),
          email: email.trim(),
          mobile: mobile.trim(),
          pin: pincode.trim(),
          pan_no: panNo.trim().toUpperCase(),
          state_id: stateId,
          district_id: districtId,
          location: location.trim(),
          address_line_1: addressLine1.trim(),
          address_line_2: addressLine2.trim() || addressLine1.trim(),
        };

    const res = isStandard
      ? isUpdate
        ? await api.updateStdPsa(payload)
        : await api.registerStdPsa(payload)
      : await api.registerBioPsa(payload);

    if (!res.success) throw new Error(res.message || 'Registration failed.');
    setDone(true);
    onDone(res.message || 'PSA registration submitted.');
    return res;
  });

  const blocked =
    !agencyName.trim()
      ? isStandard
        ? 'Enter the shop name.'
        : 'Enter the agency name.'
      : !personName.trim()
        ? 'Enter the contact person\'s name.'
        : !EMAIL_RE.test(email.trim())
          ? 'Enter a valid email address.'
          : mobile.length !== 10
            ? 'Enter a 10-digit mobile number.'
            : !PAN_RE.test(panNo.trim().toUpperCase())
              ? 'Enter a valid PAN, e.g. ABCDE1234F.'
              : !stateId
                ? 'Select the state.'
                : !districtId
                  ? 'Select the district.'
                  : pincode.length !== 6
                    ? 'Enter a 6-digit pincode.'
                    : !addressLine1.trim()
                      ? 'Enter the shop address.'
                      : isStandard && aadhaar.length !== 12
                        ? 'Enter the 12-digit Aadhaar number.'
                        : isStandard && !dob
                          ? 'Enter the date of birth as YYYY-MM-DD.'
                          : !isStandard && !location.trim()
                            ? 'Enter the locality or landmark.'
                            : null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isStandard ? 'Standard PSA registration' : 'Biometric PSA registration'}
      subtitle={isUpdate ? 'Resubmit your rejected application' : 'One-time agent registration'}
      icon="card-account-details-outline"
      dismissible={!submit.pending}
      footer={
        done ? (
          <Button icon="check" onPress={onClose} fullWidth>
            Done
          </Button>
        ) : (
          <Button
            icon="send-outline"
            size="lg"
            onPress={submit.run}
            loading={submit.pending}
            disabled={!!blocked}
            fullWidth
          >
            {isUpdate ? 'Resubmit application' : 'Submit registration'}
          </Button>
        )
      }
    >
      {done ? (
        <SuccessBanner message="Registration submitted. The PSA ID appears here once the provider approves it — pull to refresh." />
      ) : (
        <>
          <Input
            label={isStandard ? 'Shop name' : 'Agency name'}
            required
            value={agencyName}
            onChangeText={setAgencyName}
            leftIcon="storefront-outline"
            autoCapitalize="words"
          />
          <Input
            label="Contact person"
            required
            value={personName}
            onChangeText={setPersonName}
            leftIcon="account-outline"
            autoCapitalize="words"
          />
          <Input
            label="Email address"
            required
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="email-outline"
          />
          <Input
            label="Mobile number"
            required
            value={mobile}
            onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            leftIcon="phone-outline"
          />
          <Input
            label="PAN number"
            required
            value={panNo}
            onChangeText={(v) => setPanNo(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
            autoCapitalize="characters"
            leftIcon="card-text-outline"
            placeholder="ABCDE1234F"
          />

          {isStandard && (
            <>
              <Input
                label="Aadhaar number"
                required
                value={aadhaar}
                onChangeText={(v) => setAadhaar(v.replace(/\D/g, '').slice(0, 12))}
                keyboardType="number-pad"
                leftIcon="card-account-details-outline"
                placeholder="12 digits"
              />
              <Input
                label="Date of birth"
                required
                value={dob}
                onChangeText={setDob}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                leftIcon="calendar-outline"
              />
            </>
          )}

          <View>
            <SelectField
              label="State"
              required
              value={selectedState?.name ?? ''}
              placeholder="Select the state"
              open={stateOpen}
              onPress={() => setStateOpen(!stateOpen)}
            />
            {stateOpen && (
              <ScrollView style={styles.picker} nestedScrollEnabled>
                {STATES.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setStateId(option.id);
                      // Districts belong to one state; keep them in step.
                      setDistrictId('');
                      setStateOpen(false);
                    }}
                    style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>{option.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View>
            <SelectField
              label="District"
              required
              value={selectedDistrict?.name ?? ''}
              placeholder={stateId ? 'Select the district' : 'Select a state first'}
              open={districtOpen}
              onPress={() => stateId && setDistrictOpen(!districtOpen)}
            />
            {districtOpen && (
              <ScrollView style={styles.picker} nestedScrollEnabled>
                {districts.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setDistrictId(option.id);
                      setDistrictOpen(false);
                    }}
                    style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>{option.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <Input
            label="Pincode"
            required
            value={pincode}
            onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            leftIcon="map-marker-outline"
            placeholder="6 digits"
          />
          <Input
            label={isStandard ? 'Shop address' : 'Address line 1'}
            required
            value={addressLine1}
            onChangeText={setAddressLine1}
            leftIcon="home-outline"
            multiline
          />

          {!isStandard && (
            <>
              <Input
                label="Address line 2"
                value={addressLine2}
                onChangeText={setAddressLine2}
                leftIcon="home-outline"
                helperText="Optional. Line 1 is reused if you leave this blank."
              />
              <Input
                label="Locality"
                required
                value={location}
                onChangeText={setLocation}
                leftIcon="signs-post"
                placeholder="Area or nearest landmark"
              />
            </>
          )}

          {!!blocked && <Banner tone="warning" message={blocked} />}
          {!!submit.error && <Banner tone="error" message={submit.error} />}
        </>
      )}
    </Sheet>
  );
};

const styles = themed((c) => ({
  picker: {
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
}));

export default PsaRegistrationSheet;
