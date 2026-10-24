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
import { CategoryTile, categoryIcon } from "./BbpsScreen";
import {
  Btn,
  DoneBody,
  Field,
  PayReceipt,
  PinStep,
  StatusText,
} from "./RechargeScreen";
import {
  Screen,
  Banner,
  SkeletonRows,
  Row,
  SectionTitle,
  Toast,
  money,
  shortDate,
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
  available: number;
  customerMobile: string;
  pin: string;
}

/**
 * What the provider requires of a bill payment, on every BBPS service: a
 * biller, the biller's own consumer identifier, at least ₹10, a ten-digit
 * mobile number if one is given at all, and the wallet PIN. Kept out of the
 * component so the rule that gates the money is testable on its own.
 */
export const bbpsFormValid = ({
  biller,
  caNumber,
  amount,
  available,
  customerMobile,
  pin,
}: BbpsForm) =>
  !!biller &&
  caNumber.trim().length >= 4 &&
  Number(amount) >= MIN_AMOUNT &&
  Number(amount) <= available &&
  (customerMobile.length === 0 || customerMobile.length === 10) &&
  pin.length === 4;

/**
 * One BBPS category: pick the biller, fetch the bill if there is one, pay it.
 *
 * The category arrives as a route param from the hub, so this screen never
 * switches categories under the retailer — which is what the old combined
 * screen did, quietly resetting the biller and the fetched bill while leaving
 * the form looking filled in.
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
    if (!res.success) throw new Error(res.message || "Could not load billers.");
    return res.data ?? [];
  }, [category]);

  const history = useAsync<any[]>(
    async () => (await api.getRechargeHistory()).data ?? [],
    [],
  );
  const balances = useAsync<any>(
    async () => (await api.getWalletBalance()).data,
    [],
  );

  // The one identifier this biller asks for, named and shaped its way.
  const field = billerField(biller);
  // When that identifier is the customer's mobile, a second mobile box only repeats it.
  const mobileForBill = field.kind === "mobile" ? caNumber : customerMobile;

  // The gateway takes a date of birth only joined to the account: "policy|DD/MM/YYYY".
  const accountNumber = needsDob && dob ? `${caNumber.trim()}|${dob}` : caNumber.trim();
  const dobInvalid = needsDob && !/^\d{2}\/\d{2}\/\d{4}$/.test(dob);

  const fetchBill = useAction(async () => {
    if (dobInvalid) throw new Error("Enter the date of birth as DD/MM/YYYY.");
    const res = await api
      .fetchBill({
      caNumber: accountNumber,
      operator: String(biller?.id),
      type: category,
      customerMobile: mobileForBill || undefined,
      // Some billers quote against an amount rather than returning one.
      ...(Number(amount) > 0 ? { amount: Number(amount) } : {}),
    })
      .catch((err: any) => {
        if (err?.response?.data?.requiredField === "dateofbirth") setNeedsDob(true);
        throw err;
      });
    if (!res.success) throw new Error(res.message);
    return res.data;
  });

  const payBill = useAction(async () => {
    const res = await api.doRecharge({
      number: accountNumber,
      operator: biller?.id,
      amount: Number(amount),
      pin,
      type: category,
      customerMobile: mobileForBill || undefined,
      // What the biller told us about this bill. Without it the payment is
      // stored with no customer name, bill number or due date, and every
      // receipt and report for it reads blank.
      ...(bill
        ? {
            customerName: bill.customerName ?? bill.name ?? undefined,
            billDetails: {
              // The raw fetch rides along: the provider reads its own keys from it.
              ...bill,
              customerName: bill.customerName ?? bill.name ?? null,
              billNumber: bill.billNumber ?? bill.billnumber ?? null,
              billDate: bill.billDate ?? bill.billdate ?? null,
              dueDate: bill.dueDate ?? bill.duedate ?? null,
              billPeriod: bill.billPeriod ?? bill.bilperiod ?? null,
              fetchRefId:
                bill.fetchRefId ?? bill.fetchBillId ?? bill.fetchBillID ?? null,
            },
          }
        : {}),
    });
    if (!res.success) throw new Error(res.message);
    return res;
  });

  const available = balances.data?.mainBalance ?? 0;
  const overBalance = Number(amount) > available;
  // The provider refuses a payment under ₹10 and a mobile number that is not
  // exactly ten digits, so both are caught here rather than by a failed call.
  const belowMinimum =
    !!amount && Number(amount) > 0 && Number(amount) < MIN_AMOUNT;
  const mobileInvalid =
    customerMobile.length > 0 && customerMobile.length !== 10;
  const optionalMobile = field.kind === "mobile" ? "" : customerMobile;
  const identifierValid = billerInputValid(field, caNumber);
  const valid =
    identifierValid &&
    bbpsFormValid({
      biller,
      caNumber,
      amount,
      available,
      customerMobile: optionalMobile,
      pin,
    });
  // Everything but the PIN, which the PIN step collects: the same rule with a
  // stand-in PIN, so the two gates can never disagree.
  const ready =
    identifierValid &&
    bbpsFormValid({
      biller,
      caNumber,
      amount,
      available,
      customerMobile: optionalMobile,
      pin: "0000",
    });

  // A failed fetch or payment is news, not a state: shown as a toast, then drained.
  const [toast, setToast] = useState("");
  useEffect(() => {
    const failed = [payBill, fetchBill].find((a) => a.error);
    if (!failed) return;
    setToast(failed.error as string);
    failed.setError(null);
  }, [payBill.error, fetchBill.error]);

  const filteredBillers = useMemo(
    () =>
      (billers.data ?? []).filter((b) =>
        (b.displayname || b.name || "")
          .toLowerCase()
          .includes(billerQuery.trim().toLowerCase()),
      ),
    [billers.data, billerQuery],
  );

  const onFetchBill = async () => {
    const data = await fetchBill.run();
    if (data) {
      setBill(data);
      // The biller quotes the payable amount under a few different keys.
      const due =
        data.dueAmount ?? data.amount ?? data.dueamount ?? data.billAmount;
      if (due) setAmount(String(due));
    }
  };

  const onPay = async () => {
    const res = await payBill.run();
    if (res) {
      // A biller can accept a payment before confirming it, so the wording
      // must not claim it has landed.
      const settled = !res.pending;
      setReceipt({
        settled,
        heading: settled
          ? `Paid to ${biller?.displayname || biller?.name || categoryLabel}`
          : "Payment accepted, being processed",
        amount: money(amount).replace(/\.00$/, ""),
        rows: [
          { label: "Biller", value: biller?.displayname || biller?.name },
          { label: biller?.label || "Consumer number", value: caNumber.trim() },
          { label: "Customer", value: bill?.customerName || bill?.name },
          { label: "Biller ref", value: res.data?.txnId, dashBefore: true },
          {
            label: "Transaction ID",
            value: res.data?.transactionId,
            dashBefore: !res.data?.txnId,
          },
          { label: "Status", value: settled ? null : res.message },
        ],
      });
      setPin("");
      setStep("form");
      setBill(null);
      balances.reload();
      history.reload();
    }
  };

  // Only this category's payments — the hub already lists everything.
  const categoryHistory = (history.data ?? []).filter(
    (txn: any) =>
      !category ||
      String(txn?.metadata?.mode ?? "").toLowerCase() ===
        category.toLowerCase() ||
      String(txn?.metadata?.type ?? "").toLowerCase() ===
        category.toLowerCase(),
  );

  const toastNode = <Toast message={toast} onHide={() => setToast("")} />;

  if (step === "pin") {
    return (
      <PinStep
        payee={`Paying ${biller?.displayname || biller?.name || categoryLabel}`}
        amount={Number(amount)}
        detail={`${caNumber.trim()} · from Main wallet`}
        pin={pin}
        onPin={setPin}
        onSubmit={() => valid && onPay()}
        onClose={() => {
          setPin("");
          setStep("form");
        }}
        pending={payBill.pending}
        overlay={toastNode}
      />
    );
  }

  // The header already names the category; its glyph marks the history rows.
  const icon = categoryIcon(categoryLabel);

  return (
    <>
      <Screen
        overlay={toastNode}
        refreshing={history.refreshing || billers.refreshing}
        onRefresh={() => {
          history.refresh();
          balances.refresh();
          billers.refresh();
        }}
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
                  message="No billers are available for this category right now."
                />
              </View>
            )}

          <View>
            <Field
              label="Biller"
              value={biller ? biller.displayname || biller.name : ""}
              placeholder={
                billers.loading ? "Loading billers…" : "Select biller"
              }
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
                        // A bill belongs to the biller it was fetched from.
                        setBill(null);
                        setAmount("");
                        setNeedsDob(false);
                        setDob("");
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
              autoCapitalize="characters"
              keyboardType={field.numeric ? "number-pad" : "default"}
              maxLength={field.maxLength}
              placeholder={field.placeholder}
            />
          </View>

          {field.kind !== "mobile" && <View>
            <Field
              label="Customer mobile (optional)"
              value={customerMobile}
              onChangeText={(v) =>
                setCustomerMobile(v.replace(/\D/g, "").slice(0, 10))
              }
              keyboardType="number-pad"
              placeholder="10-digit mobile number"
              maxLength={10}
              error={
                mobileInvalid
                  ? "Enter a valid 10-digit mobile number"
                  : undefined
              }
            />
          </View>}

          {needsDob && (
            <View>
              <Field
                label="Date of birth"
                value={dob}
                onChangeText={(v) => {
                  const d = v.replace(/\D/g, "").slice(0, 8);
                  setDob([d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/"));
                }}
                keyboardType="number-pad"
                placeholder="DD/MM/YYYY"
                maxLength={10}
              />
            </View>
          )}

          {/* A top-up has no bill to fetch, so the step is hidden rather than
            left to fail. */}
          {biller?.viewbill === "true" && (
            <View>
              <Btn
                ghost
                icon="file-search-outline"
                label="Fetch bill"
                onPress={onFetchBill}
                loading={fetchBill.pending}
                disabled={!biller || !identifierValid}
              />
            </View>
          )}

          {!!bill && (
            <View style={styles.card}>
              <Row label="Customer" value={bill.customerName || bill.name} />
              <Row
                label="Account"
                value={bill.account || bill.accountNumber || caNumber}
              />
              <Row
                label="Bill number"
                value={bill.billnumber || bill.billNumber}
              />
              <Row label="Bill date" value={bill.billdate || bill.billDate} />
              <Row label="Due date" value={bill.duedate || bill.dueDate} />
              <Row
                label="Bill period"
                value={bill.bilperiod || bill.billPeriod}
              />
              <Row
                label="Amount due"
                value={money(
                  bill.amount ??
                    bill.Amount ??
                    bill.dueamount ??
                    bill.billAmount,
                )}
                mono
              />
              <Row
                label="Fetch reference"
                value={bill.fetchBillID || bill.fetchRefId || "—"}
                last
              />
            </View>
          )}

          <View>
            <Field
              label="Amount"
              prefix="₹"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="0"
              error={
                overBalance
                  ? "Amount exceeds your main wallet balance"
                  : belowMinimum
                    ? `Minimum payment amount is ₹${MIN_AMOUNT}`
                    : undefined
              }
              helper={`Auto-filled when the biller returns a due amount · Main wallet ${money(available)}`}
            />
          </View>

          <Btn
            label={Number(amount) > 0 ? `Pay ${money(amount)}` : "Pay bill"}
            onPress={() => setStep("pin")}
            disabled={!ready}
          />
          </>)}
        </View>

        <View style={styles.form}>
          <SectionTitle>Recent payments</SectionTitle>
          <View style={styles.list}>
            {history.loading ? <SkeletonRows count={3} /> : categoryHistory.length ? (
              categoryHistory
                .slice(0, 20)
                .map((txn: any, i: number, all: any[]) => (
                  <View
                    key={txn._id || txn.transactionId}
                    style={[
                      styles.rowI,
                      i === all.length - 1 && styles.rowLast,
                    ]}
                  >
                    <CategoryTile icon={icon} size={44} />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {txn.metadata?.caNumber || txn.transactionId}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {[
                          txn.metadata?.operatorName || txn.metadata?.mode,
                          shortDate(txn.createdAt),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>{money(txn.amount)}</Text>
                      <StatusText status={txn.status} />
                    </View>
                  </View>
                ))
            ) : (
              <Text style={styles.empty}>
                No {categoryLabel.toLowerCase()} payments yet
              </Text>
            )}
          </View>
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
  flex: { flex: 1, minWidth: 0 },
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
  list: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  rowI: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { fontSize: t.body, fontWeight: "500", color: c.foreground },
  rowMeta: { fontSize: t.caption, color: c.mutedForeground, marginTop: 3 },
  rowRight: { alignItems: "flex-end", gap: 3 },
  rowAmount: {
    fontSize: t.body,
    fontWeight: "500",
    color: c.foreground,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    fontSize: t.small,
    color: c.mutedForeground,
    paddingVertical: space.lg,
    textAlign: "center",
  },
}));

export default BbpsServiceScreen;
