import React, { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, themed, radius, space, type as t } from '../theme/colors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageField } from '@/components/ui/ImageField';
import { Sheet } from '@/components/ui/Sheet';
import {
  Screen,
  EmptyState,
  ErrorBanner,
  Segmented,
  StatusPill,
  dateTime,
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
      refreshing={tickets.refreshing}
      onRefresh={tickets.refresh}
      error={tickets.error}
      onRetry={tickets.reload}
    >
      <Card>
        <CardHeader>
          <CardTitle icon="headset">How can we help?</CardTitle>
        </CardHeader>
        <CardContent style={styles.form}>
          <Text style={styles.help}>
            Raise an issue with a screenshot and track every reply here. Include the transaction
            reference whenever the problem is about one.
          </Text>
          <Button onPress={() => setComposing(true)} icon="message-plus-outline" fullWidth>
            New request
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle icon="ticket-outline">My requests</CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.data?.length ? (
            tickets.data.map((ticket: any, index: number) => (
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
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  <Text style={styles.itemBody} numberOfLines={2}>
                    {ticket.description}
                  </Text>
                  <Text style={styles.itemMeta}>Updated {dateTime(ticket.updatedAt)}</Text>
                </View>
                <StatusPill status={ticket.status} />
              </Pressable>
            ))
          ) : (
            <EmptyState
              icon="message-outline"
              title="No support requests yet"
              subtitle="Open one whenever you need help"
              action={{ label: 'New request', onPress: () => setComposing(true) }}
            />
          )}
        </CardContent>
      </Card>

      <Sheet
        visible={composing}
        onClose={() => setComposing(false)}
        title="New support request"
        icon="message-plus-outline"
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
            icon="send"
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
        subtitle={selected ? String(selected.status).replace('_', ' ') : undefined}
        icon="message-text-outline"
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
                      style={[styles.bubbleTime, item.senderRole === 'user' && styles.bubbleTextMine]}
                    >
                      {dateTime(item.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {CLOSED.includes(String(selected.status)) ? (
              <View style={styles.closed}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={16}
                  color={colors.mutedForeground}
                />
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
                  icon="send"
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
  fieldLabel: { fontSize: t.caption, fontWeight: '600', color: c.mutedForeground },
  help: { flex: 1, fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  textarea: { minHeight: 96, textAlignVertical: 'top', paddingTop: space.sm },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  itemLast: { borderBottomWidth: 0 },
  itemPressed: { opacity: 0.6 },
  itemText: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { fontSize: t.body, fontWeight: '700', color: c.foreground },
  itemBody: { fontSize: t.caption, color: c.mutedForeground, lineHeight: 18 },
  itemMeta: { fontSize: t.micro, color: c.mutedForeground, marginTop: 2 },

  // Capped so the reply box stays on screen on a small handset; the thread
  // scrolls inside the sheet rather than pushing the composer off it.
  thread: { maxHeight: 320 },
  bubbleRow: { flexDirection: 'row', marginBottom: space.sm },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '85%',
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: c.secondary,
    gap: 4,
  },
  bubbleMine: { backgroundColor: c.primary },
  bubbleText: { fontSize: t.small, color: c.foreground, lineHeight: 19 },
  bubbleTextMine: { color: c.primaryForeground },
  bubbleTime: { fontSize: t.micro, color: c.mutedForeground },
  attachment: { width: 200, height: 140, borderRadius: radius.md, marginTop: 4 },

  closed: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));

export default SupportScreen;
