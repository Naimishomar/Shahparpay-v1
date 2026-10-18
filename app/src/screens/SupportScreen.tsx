import React, { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageField } from '@/components/ui/ImageField';
import { Sheet } from '@/components/ui/Sheet';
import { IconTile } from '@/components/ui/Gradient';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  SectionTitle,
  Segmented,
  dateTime,
  SkeletonCard,
  SkeletonRows,
  SkeletonTitle,
} from '@/components/ui/Screen';
import { useAsync, useAction } from '@/hooks/useAsync';
import { useAuth } from '@/context/AuthContext';
import { PickedFile } from '@/services/imagePicker';
import api from '@/services/api';

const CLOSED = ['RESOLVED', 'CLOSED'];

const STATUS_OPTIONS = [
  { key: 'OPEN', label: 'Open' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'CLOSED', label: 'Closed' },
];

/** Status reads as small coloured text, BHIM-style, never a filled pill. */
const statusLabel = (status: string) =>
  String(status || 'OPEN').charAt(0) + String(status || 'OPEN').slice(1).toLowerCase().replace('_', ' ');
const statusColor = (status: string) =>
  CLOSED.includes(String(status))
    ? colors.success
    : String(status) === 'IN_PROGRESS'
      ? colors.warning
      : colors.mutedForeground;

const RECIPIENTS = [
  { key: 'distributor', label: 'My distributor' },
  { key: 'admin', label: 'ShahparPay admin' },
];

/**
 * Support Center. Same ticket store as the web portal: a retailer raises an
 * issue with a photo, the distributor (or admin) answers in the thread, and
 * whoever is handling it moves the status.
 *
 * The thread is a Sheet rather than its own route so the list stays mounted
 * behind it — a reply refreshes both without a navigation round trip.
 */
export const SupportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isRetailer = user?.role === 'retailer' || (!!user && !user.role);
  const canSetStatus = user?.role === 'distributor' || user?.role === 'admin';

  const [composing, setComposing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [recipient, setRecipient] = useState('distributor');
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [reply, setReply] = useState('');
  const [replyPhoto, setReplyPhoto] = useState<PickedFile | null>(null);

  const tickets = useAsync<any[]>(async () => (await api.getSupportTickets()).data ?? [], []);

  // Read out of the list rather than held in its own state, so a reload shows
  // the new message in the open thread instead of a stale copy of it.
  const selected = (tickets.data ?? []).find((ticket: any) => ticket._id === selectedId) ?? null;

  const create = useAction(async () => {
    const res = await api.createSupportTicket(
      { subject: subject.trim(), description: description.trim(), recipient },
      attachment ?? undefined
    );
    if (!res.success) throw new Error(res.message || 'Could not create the request.');
    return res;
  });

  const send = useAction(async (id: string) => {
    const res = await api.addSupportMessage(id, reply.trim(), replyPhoto ?? undefined);
    if (!res.success) throw new Error(res.message || 'Could not send the message.');
    return res;
  });

  const setStatus = useAction(async (id: string, status: string) => {
    const res = await api.updateSupportTicket(id, status);
    if (!res.success) throw new Error(res.message || 'Could not update the status.');
    return res;
  });

  const onCreate = async () => {
    if (!subject.trim() || (!description.trim() && !attachment)) return;
    const res = await create.run();
    if (!res) return;
    setSubject('');
    setDescription('');
    setAttachment(null);
    setComposing(false);
    await tickets.reload();
    setSelectedId(res.data?._id ?? null);
  };

  const onReply = async () => {
    if (!selected || (!reply.trim() && !replyPhoto)) return;
    const res = await send.run(selected._id);
    if (!res) return;
    setReply('');
    setReplyPhoto(null);
    tickets.reload();
  };

  return (
    <Screen
      loading={tickets.loading}
      skeleton={<View style={{ gap: 16 }}><SkeletonCard><SkeletonRows count={1} amount={false} avatar={48} /></SkeletonCard><SkeletonCard><SkeletonRows count={2} amount={false} /></SkeletonCard><SkeletonTitle /><SkeletonCard><SkeletonRows count={3} /></SkeletonCard></View>}
      refreshing={tickets.refreshing}
      onRefresh={tickets.refresh}
      error={tickets.error}
      onRetry={tickets.reload}
    >
      <View style={styles.hero}>
        <IconTile icon="headset" size={64} iconSize={28} />
        <Text style={styles.heroTitle}>How can we help?</Text>
        <Text style={styles.heroText}>
          Raise an issue with a screenshot and track every reply here. Include the transaction
          reference whenever the problem is about one.
        </Text>
      </View>
      <Button onPress={() => setComposing(true)} fullWidth>
        New request
      </Button>

      {isRetailer && (
        <View style={styles.card}>
          {[
            { route: 'PipeStatus', icon: 'git-network-outline', title: 'AEPS pipe status', sub: 'Which bank pipes are live' },
            { route: 'BiometricSupport', icon: 'finger-print-outline', title: 'Biometric support', sub: 'Device drivers and RD service' },
          ].map((link) => (
            <Pressable
              key={link.route}
              onPress={() => navigation.navigate(link.route)}
              style={({ pressed }) => [styles.link, pressed && styles.itemPressed]}
              accessibilityRole="button"
              accessibilityLabel={link.title}
            >
              <View style={styles.lineIcon}>
                <Ionicons name={link.icon as any} size={22} color={colors.foreground} />
              </View>
              <View style={styles.itemText}>
                <Text style={styles.linkTitle}>{link.title}</Text>
                <Text style={styles.linkSub}>{link.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )}

      <SectionTitle>My requests</SectionTitle>
      {tickets.data?.length ? (
        <View style={styles.card}>
          {tickets.data.map((ticket: any, index: number) => {
            const closed = CLOSED.includes(String(ticket.status));
            return (
              <Pressable
                key={ticket._id}
                onPress={() => setSelectedId(ticket._id)}
                style={({ pressed }) => [
                  styles.item,
                  index === (tickets.data?.length ?? 0) - 1 && styles.itemLast,
                  pressed && styles.itemPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${ticket.subject}. ${ticket.status}`}
              >
                <View style={styles.lineIcon}>
                  <Ionicons
                    name={closed ? 'checkmark-circle-outline' : 'chatbubble-ellipses-outline'}
                    size={22}
                    color={colors.foreground}
                  />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  <Text style={styles.itemBody} numberOfLines={2}>
                    {ticket.description}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {`Updated ${dateTime(ticket.updatedAt)} · `}
                    <Text style={{ color: statusColor(ticket.status) }}>{statusLabel(ticket.status)}</Text>
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon="message-outline"
          title="No support requests yet"
          subtitle="Open one whenever you need help"
          action={{ label: 'New request', onPress: () => setComposing(true) }}
        />
      )}

      <Sheet
        visible={composing}
        onClose={() => setComposing(false)}
        title="New support request"
        dismissible={!create.pending}
      >
        <View style={styles.form}>
          {isRetailer && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Send to</Text>
              <Segmented options={RECIPIENTS} value={recipient} onChange={setRecipient} scroll={false} />
            </View>
          )}
          <Input
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            maxLength={150}
            placeholder="What do you need help with?"
            required
          />
          <Input
            label="Describe the issue"
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            numberOfLines={5}
            style={styles.textarea}
            placeholder="Transaction reference, error message, what you expected…"
          />
          <ImageField
            label="Issue photo"
            value={attachment}
            onChange={setAttachment}
            helperText="Optional — a screenshot of the error resolves most tickets faster"
          />
          {!!create.error && <ErrorBanner message={create.error} />}
          <Button
            onPress={onCreate}
            loading={create.pending}
            disabled={!subject.trim() || (!description.trim() && !attachment)}
            fullWidth
          >
            Submit request
          </Button>
        </View>
      </Sheet>

      <Sheet
        visible={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.subject ?? 'Request'}
        subtitle={selected ? statusLabel(selected.status) : undefined}
        dismissible={!send.pending}
      >
        {!!selected && (
          <View style={styles.form}>
            {canSetStatus && (
              <Segmented
                options={STATUS_OPTIONS}
                value={String(selected.status)}
                onChange={(next) => setStatus.run(selected._id, next).then(() => tickets.reload())}
              />
            )}

            <ScrollView style={styles.thread} nestedScrollEnabled>
              {(selected.messages?.length
                ? selected.messages
                : [
                    {
                      senderRole: 'user',
                      message: selected.description,
                      createdAt: selected.createdAt,
                    },
                  ]
              ).map((item: any, index: number) => (
                <View
                  key={index}
                  style={[styles.bubbleRow, item.senderRole === 'user' && styles.bubbleRowMine]}
                >
                  <View style={[styles.bubble, item.senderRole === 'user' && styles.bubbleMine]}>
                    <Text
                      style={[styles.bubbleText, item.senderRole === 'user' && styles.bubbleTextMine]}
                    >
                      {item.message}
                    </Text>
                    {(item.attachments ?? []).map((file: any) => (
                      <Image
                        key={file.url}
                        source={{ uri: file.url }}
                        style={styles.attachment}
                        resizeMode="cover"
                      />
                    ))}
                    <Text
                      style={styles.bubbleTime}
                    >
                      {dateTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {CLOSED.includes(String(selected.status)) ? (
              <View style={styles.closed}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />
                <Text style={styles.help}>
                  This request is closed. Open a new one if you still need help.
                </Text>
              </View>
            ) : (
              <>
                <Input
                  label="Reply"
                  value={reply}
                  onChangeText={setReply}
                  multiline
                  numberOfLines={3}
                  style={styles.textarea}
                  placeholder="Write a reply…"
                />
                <ImageField label="Attach a photo" value={replyPhoto} onChange={setReplyPhoto} />
                {!!send.error && <ErrorBanner message={send.error} />}
                {!!setStatus.error && <ErrorBanner message={setStatus.error} />}
                <Button
                  onPress={onReply}
                  loading={send.pending}
                  disabled={!reply.trim() && !replyPhoto}
                  fullWidth
                >
                  Send
                </Button>
              </>
            )}
          </View>
        )}
      </Sheet>
    </Screen>
  );
};

const styles = themed((c) => ({
  form: { gap: space.lg },
  field: { gap: 7 },
  fieldLabel: { fontSize: t.small, fontWeight: '500', color: c.mutedForeground },
  help: { flex: 1, fontSize: t.small, color: c.mutedForeground, lineHeight: 19 },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: space.sm },

  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.md, paddingHorizontal: space.lg },
  heroTitle: { fontSize: t.title, fontWeight: '500', color: c.foreground, marginTop: space.sm },
  heroText: { fontSize: t.small, color: c.mutedForeground, lineHeight: 19, textAlign: 'center' },

  card: {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  lineIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72, paddingVertical: space.md },
  linkTitle: { fontSize: t.bodyLg - 1, fontWeight: '400', color: c.foreground },
  linkSub: { fontSize: t.small, color: c.mutedForeground },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemPressed: { opacity: 0.6 },
  itemText: { flex: 1, minWidth: 0, gap: 3 },
  itemTitle: { fontSize: t.bodyLg - 1, fontWeight: '500', color: c.foreground },
  itemBody: { fontSize: t.small, color: c.mutedForeground, lineHeight: 18 },
  itemMeta: { fontSize: t.caption, color: c.mutedForeground, marginTop: 2 },

  // Capped so the reply box stays on screen on a small handset; the thread
  // scrolls inside the sheet rather than pushing the composer off it.
  thread: { maxHeight: 320 },
  bubbleRow: { flexDirection: 'row', marginBottom: space.sm },
  bubbleRowMine: { justifyContent: 'flex-end' },
  // Calm and dark: theirs a card on the sheet, mine one step lighter. No
  // orange fill — colour stays for the one primary action.
  bubble: {
    maxWidth: '85%',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    borderBottomLeftRadius: 6,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    gap: 4,
  },
  bubbleMine: {
    backgroundColor: c.surfaceAlt,
    borderColor: c.surfaceAlt,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: 6,
  },
  bubbleText: { fontSize: t.body, color: c.foreground, lineHeight: 21 },
  bubbleTextMine: { color: c.foreground },
  bubbleTime: { fontSize: t.caption, color: c.mutedForeground },
  attachment: { width: 200, height: 140, borderRadius: radius.md, marginTop: 4 },

  closed: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

export default SupportScreen;
