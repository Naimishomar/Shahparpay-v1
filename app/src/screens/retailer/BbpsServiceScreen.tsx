import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, themed, radius, space, type as t } from "../../theme/colors";
import {
  Btn,
  DoneBody,
  Field,
  PayReceipt,
  PinStep,
} from "./RechargeScreen";
import {
  Screen,
  Banner,
  SkeletonRows,
  Row,
  Toast,
} from "@/components/ui/Screen";
import { useAsync, useAction } from "@/hooks/useAsync";
import api from "@/services/api";
import { billerField, billerInputValid, cleanBillerInput } from "./billerField";

interface Biller {
  id: string | number;
  name: string;
  displayname?: string;
  // The biller's own name for the consumer identifier — "Consumer Number",
  // "CA Number", "Vehicle Number" — so the field is labelled the way the bill is.
  label?: string;
  // Whether this biller can produce a bill before it is paid. A top-up cannot.
  viewbill?: string;
}

/** The provider refuses anything smaller, on every BBPS service. */
export const MIN_AMOUNT = 10;

interface BbpsForm {
  biller: unknown;
  caNumber: string;
  amount: string;
  pin: string;
}

/**
 * The website's payment check, on every BBPS service: a biller, the biller's
 * own consumer identifier, at least ₹10 and the wallet PIN. Kept out of the
 * component so the rule that gates the money is testable on its own.
 */
export const bbpsFormValid = ({ biller, caNumber, amount, pin }: BbpsForm) =>
  !!biller && caNumber.trim().length >= 4 && !!amount && Number(amount) >= MIN_AMOUNT && pin.length === 4;

/** The website's BBPS receipt rows, in its order and words. */
const bbpsReceipt = (r: any): PayReceipt => {
  const pending = r.status === "PENDING";
  const success = !!r.isSuccess && !pending;
  const bill = r.billDetails || {};
  return {
    settled: success,
    heading: pending ? "Payment Pending" : success ? "Payment Successful!" : "Payment Failed!",
    amount: `₹${r.amount}`,
    rows: [
      { label: "Service", value: r.type || "BBPS" },
      { label: "Biller", value: r.billerName || r.operator || "N/A" },
      { label: "Customer name", value: r.customerName || "N/A" },
      { label: "Customer mobile", value: r.customerMobile || "N/A" },
      { label: "Consumer / account no.", value: r.number || bill.account || "N/A" },
      { label: "Bill number", value: bill.billNumber || "N/A" },
      { label: "Bill date", value: bill.billDate || "N/A" },
      { label: "Due date", value: bill.dueDate || "N/A" },
      { label: "Fetch reference", value: bill.fetchRefId || bill.fetchBillId || "N/A" },
      { label: "Transaction ID", value: r.transactionId || "N/A", dashBefore: true },
      { label: "Operator reference", value: r.operatorRef || r.txnId || "N/A" },
      { label: "Status", value: r.status },
      { label: "Reason for failure", value: !r.isSuccess ? r.errorReason : null },
    ],
  };
};

/**
 * One BBPS category: pick the biller, fetch the bill if there is one, pay it.
 * Mirrors the website's BBPS form field for field.
 */
export const BbpsServiceScreen: React.FC = () => {
  const route = useRoute<any>();
  const category = String(route.params?.category ?? "");
  const categoryLabel = String(route.params?.title ?? "Bill payment");

  const [biller, setBiller] = useState<Biller | null>(null);
  const [showBillers, setShowBillers] = useState(false);
  const [billerQuery, setBillerQuery] = useState("");
  const [caNumber, setCaNumber] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  // Set once the biller asks for a date of birth (LIC); typed as DD/MM/YYYY.
  const [needsDob, setNeedsDob] = useState(false);
  const [dob, setDob] = useState("");
  const [amount, setAmount] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"form" | "pin">("form");
  const [bill, setBill] = useState<any>(null);
  const [receipt, setReceipt] = useState<PayReceipt | null>(null);

  const billers = useAsync<Biller[]>(async () => {
    if (!category) return [];
    const res = await api.getRechargeOperators(category);
    if (!res.success) throw new Error(res.message || "Could not load billers");
    return res.data ?? [];
  }, [category]);

  // The one identifier this biller asks for, named and shaped its way.
  const field = billerField(biller);
  // When that identifier is the customer's mobile, a second mobile box only repeats it.
  const mobileForBill = field.kind === "mobile" ? caNumber : customerMobile;
  const viewBill = biller?.viewbill === "true";

  // The gateway takes a date of birth only joined to the account: "policy|DD/MM/YYYY".
  const accountNumber = needsDob && dob ? `${caNumber.trim()}|${dob}` : caNumber.trim();

  const fetchBill = useAction(async () => {
    const res = await api
      .fetchBill({
        operator: String(biller?.id),
        caNumber: accountNumber,
        type: category,
        category,
        customerMobile: mobileForBill || undefined,
      })
      .catch((err: any) => {
        if (err?.response?.data?.requiredField === "dateofbirth") setNeedsDob(true);
        if (!err?.response?.data?.message) throw new Error("Error fetching bill");
        throw err;
      });
    if (!res.success) throw new Error(res.message || "Failed to fetch bill details");
    return res.data;
  });

  // Never throws: the website answers every outcome, failure included, with a receipt.
  const payBill = useAction(async () => {
    try {
      const res = await api.doRecharge({
        type: category,
        number: accountNumber,
        operator: biller?.id,
        amount,
        pin,
        customerName: bill?.customerName || undefined,
        customerMobile: mobileForBill || undefined,
        billDetails: bill || undefined,
      });
      return { res, error: null as any };
    } catch (error: any) {
      return { res: null, error };
    }
  });

  // A failed fetch is news, not a state: shown as a toast, then drained.
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!fetchBill.error) return;
    setToast(fetchBill.error);
    fetchBill.setError(null);
  }, [fetchBill.error]);

  const filteredBillers = useMemo(
    () =>
      (billers.data ?? []).filter((b) =>
        (b.displayname || b.name || "")
          .toLowerCase()
          .includes(billerQuery.trim().toLowerCase()),
      ),
    [billers.data, billerQuery],
  );

  const resetBillerFields = () => {
    setCaNumber("");
    setCustomerMobile("");
    setNeedsDob(false);
    setDob("");
    setAmount("");
    setBill(null);
  };

  const onFetchBill = async () => {
    if (!biller || !billerInputValid(field, caNumber)) return setToast(`Enter a valid ${field.label}`);
    if (needsDob && !dob) return setToast("Please enter the date of birth");
    if (needsDob && !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) return setToast("Enter the date of birth as DD/MM/YYYY.");
    const data = await fetchBill.run();
    if (data) {
      setBill(data);
      const fetched = data.amount || data.Amount || data.billAmount;
      if (fetched) setAmount(String(fetched));
    }
  };

  const onPayPress = () => {
    if (!bbpsFormValid({ biller, caNumber, amount, pin: "0000" }) || !billerInputValid(field, caNumber))
      return setToast("Please fill all fields");
    if (viewBill && !bill) return setToast("Fetch the bill details before making a payment");
    setStep("pin");
  };

  const onPay = async () => {
    const out = await payBill.run();
    if (!out) return;
    const { res, error } = out;
    const base = {
      amount,
      number: caNumber,
      operator: String(biller?.id ?? ""),
      billerName: biller?.name,
      customerName: bill?.customerName,
      customerMobile: mobileForBill,
      billDetails: bill,
      type: category,
      isSuccess: false,
    };
    if (res?.success) {
      const d = res.data || {};
      const pending = Boolean(res.pending || String(d.status || "").toUpperCase() === "PENDING");
      setReceipt(
        bbpsReceipt({
          ...base,
          ...d,
          amount: d.amount ?? amount,
          billDetails: d.billDetails || bill,
          billerName: biller?.name,
          customerName: d.customerName || bill?.customerName,
          customerMobile: d.customerMobile || mobileForBill,
          status: pending ? "PENDING" : "SUCCESS",
          isSuccess: !pending,
        }),
      );
      // The website closes the form on success: the next payment starts clean.
      setBiller(null);
      resetBillerFields();
    } else {
      const body = res ?? error?.response?.data;
      const msg = String(body?.message ?? "").trim();
      setReceipt(
        bbpsReceipt({
          ...base,
          status: (res && body?.data?.Status) || "FAILED",
          transactionId: body?.data?.ApiTransID || "N/A",
          operatorRef: (res && body?.data?.OperatorRef) || "N/A",
          errorReason: msg || "Payment Failed",
        }),
      );
    }
    setPin("");
    setStep("form");
  };

  const toastNode = <Toast message={toast} onHide={() => setToast("")} />;

  if (step === "pin") {
    return (
      <PinStep
        payee={`Paying ${biller?.displayname || biller?.name || categoryLabel}`}
        amount={Number(amount)}
        detail={`${caNumber.trim()} · from Utility Wallet`}
        pin={pin}
        onPin={setPin}
        onSubmit={() => pin.length === 4 && onPay()}
        onClose={() => {
          setPin("");
          setStep("form");
        }}
        pending={payBill.pending}
        overlay={toastNode}
      />
    );
  }

  const amountLocked = !!(bill?.amount || bill?.Amount || bill?.billAmount);

  return (
    <>
      <Screen
        overlay={toastNode}
        refreshing={billers.refreshing}
        onRefresh={billers.refresh}
      >
        <View style={styles.form}>
          {!!billers.error && (
            <View>
              <Banner
                tone="error"
                message={billers.error}
                action={{ label: "Retry", onPress: billers.reload }}
              />
            </View>
          )}
          {!billers.loading &&
            !billers.error &&
            !(billers.data ?? []).length && (
              <View>
                <Banner
                  tone="warning"
                  message="No billers are available for this category right now"
                />
              </View>
            )}

          <View>
            <Field
              label="Operator / Biller"
              value={biller ? biller.displayname || biller.name : ""}
              placeholder="Select Biller"
              open={showBillers}
              onPress={() => setShowBillers(!showBillers)}
            />
          </View>
          {showBillers && (
            <View style={styles.picker}>
              <Field
                label="Search biller"
                value={billerQuery}
                onChangeText={setBillerQuery}
                autoCapitalize="none"
              />
              {billers.loading ? (
                <SkeletonRows count={5} amount={false} avatar={36} />
              ) : (
                <ScrollView
                  style={styles.pickerList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredBillers.map((b) => (
                    <Pressable
                      key={String(b.id)}
                      onPress={() => {
                        setBiller(b);
                        setShowBillers(false);
                        setBillerQuery("");
                        // Every field below belongs to the biller it was typed for.
                        resetBillerFields();
                      }}
                      style={({ pressed }) => [
                        styles.pickerItem,
                        pressed && styles.pickerItemPressed,
                      ]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.pickerText}>
                        {b.displayname || b.name}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  ))}
                  {!filteredBillers.length && (
                    <Text style={styles.pickerEmpty}>
                      No billers in this category
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Nothing but the biller until one is chosen: every field below is
            that biller's, named and shaped the way it asks for it. */}
          {!biller ? (
            <Text style={styles.hint}>Choose the biller to see what it needs.</Text>
          ) : (<>
          <View>
            <Field
              label={field.label}
              value={caNumber}
              onChangeText={(v) => setCaNumber(cleanBillerInput(field, v))}
              autoCapitalize={field.kind === "vehicle" ? "characters" : "none"}
              keyboardType={field.numeric ? "number-pad" : "default"}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
              editable={!bill}
            />
          </View>

          {field.kind !== "mobile" && <View>
            <Field
              label="Customer Mobile (optional)"
              value={customerMobile}
              onChangeText={(v) =>
                setCustomerMobile(v.replace(/\D/g, "").slice(0, 10))
              }
              keyboardType="number-pad"
              placeholder="10-digit mobile number"
              maxLength={10}
              editable={!bill}
            />
          </View>}

          {needsDob && (
            <View>
              <Field
                label="Date of Birth"
                value={dob}
                onChangeText={(v) => {
                  const d = v.replace(/\D/g, "").slice(0, 8);
                  setDob([d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/"));
                }}
                keyboardType="number-pad"
                placeholder="DD/MM/YYYY"
                maxLength={10}
                editable={!bill}
              />
            </View>
          )}

          {/* A biller with a bill to fetch shows only that step until it is fetched. */}
          {!bill && viewBill ? (
            <Btn
              label="Fetch Bill Details"
              onPress={onFetchBill}
              loading={fetchBill.pending}
            />
          ) : (<>
          {!!bill && (
            <View style={styles.card}>
              <Row label="Customer" value={bill.customerName || "N/A"} />
              <Row label="Account" value={bill.account || caNumber} />
              <Row label="Bill number" value={bill.billNumber || "N/A"} />
              <Row label="Bill date" value={bill.billDate || "N/A"} />
              <Row label="Due date" value={bill.dueDate || "N/A"} />
              <Row label="Bill period" value={bill.billPeriod || "N/A"} />
              <Row
                label="Fetch reference"
                value={bill.fetchRefId || bill.fetchBillId || "N/A"}
              />
              <Row
                label="Amount due"
                value={`₹${bill.dueAmount ?? bill.amount ?? amount}`}
                mono
                last
              />
            </View>
          )}

          <View>
            <Field
              label="Amount (₹)"
              prefix="₹"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              editable={!amountLocked}
            />
          </View>

          <Btn
            label={viewBill ? "Pay Bill Securely" : "Pay Securely"}
            onPress={onPayPress}
          />
          {!!bill && (
            <Btn ghost small label="Fetch Different Bill" onPress={() => setBill(null)} />
          )}
          </>)}
          </>)}
        </View>
      </Screen>

      <Modal
        visible={!!receipt}
        animationType="slide"
        onRequestClose={() => setReceipt(null)}
        statusBarTranslucent
      >
        {!!receipt && (
          <DoneBody
            receipt={receipt}
            shareTitle="SHAHPARPAY — BILL PAYMENT"
            onDone={() => setReceipt(null)}
          />
        )}
      </Modal>
    </>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  hint: { fontSize: t.small, color: c.mutedForeground },
  card: {
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  picker: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  pickerList: { maxHeight: 260 },
  pickerItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  pickerItemPressed: { opacity: 0.6 },
  pickerText: { flex: 1, fontSize: t.body, color: c.foreground },
  pickerEmpty: {
    fontSize: t.caption,
    color: c.mutedForeground,
    padding: space.md,
  },
}));

export default BbpsServiceScreen;
