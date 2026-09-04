import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenScaffold, Panel, Lbl, Btn } from '@/components/ui';
import { GearIcon } from '@/components';
import { color, font, space, radius } from '@/theme/tokens';
import { useProfile } from '@/context/ProfileContext';
import { MOODS as MOODS_DATA } from '@/data/moods';
import { ROSTER } from '@/data/roster';
import { USER_GUIDE, PRIVACY_POLICY } from '@/data/supportContent';

// moods.ts stores static hex; map to live theme tokens here so mood colors
// stay correct if the theme changes, without duplicating the mood copy.
const MOOD_COLOR: Record<string, string> = { great: color.green, fine: color.cyan, tight: color.amber, sore: color.red };
const MOODS = MOODS_DATA.map(m => ({ ...m, color: MOOD_COLOR[m.id] ?? m.color }));

export default function CareScreen() {
  const router = useRouter();
  const { activeProfile, updateActiveProfile } = useProfile();
  const [mood, setMood] = useState<string | null>(null);
  const [moodHistory, setMoodHistory] = useState<{ mood: string; date: string }[]>([]);
  const [editingClinician, setEditingClinician] = useState(false);
  const [editingAppt, setEditingAppt] = useState(false);
  const [infoModal, setInfoModal] = useState<'guide' | 'privacy' | null>(null);

  const handleMoodSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMood(id);
    setMoodHistory(prev => [{ mood: id, date: new Date().toLocaleString() }, ...prev].slice(0, 10));
  };

  const handleCall = (phone: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Call Failed', `Could not dial ${name} at ${phone}`);
    });
  };

  const handleMessage = (phone: string, name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(`sms:${phone}`).catch(() => {
      Alert.alert('Message Failed', `Could not message ${name}`);
    });
  };

  return (
    <ScreenScaffold
      title="Care"
      rightAction={
        <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
          <GearIcon size={18} />
        </TouchableOpacity>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Panel style={styles.clinicianCard}>
          <Lbl>Lead Clinician</Lbl>
          {activeProfile?.clinician ? (
            <>
              <View style={styles.clinicianRow}>
                <View style={styles.clinicianAvatar}>
                  <Text style={styles.avatarText}>
                    {activeProfile.clinician.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.clinicianInfo}>
                  <Text style={styles.clinicianName}>{activeProfile.clinician.name}</Text>
                  <Text style={styles.clinicianRole}>{activeProfile.clinician.role}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingClinician(true)} style={{ padding: 4 }}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.clinicianActions}>
                <Btn tone="outline" onPress={() => handleMessage(activeProfile.clinician!.phone, activeProfile.clinician!.name)} style={styles.clinBtn}>
                  Message
                </Btn>
                <Btn tone="cyan" onPress={() => handleCall(activeProfile.clinician!.phone, activeProfile.clinician!.name)} style={styles.clinBtn}>
                  Call
                </Btn>
              </View>
            </>
          ) : (
            <EmptyRow text="No clinician on file." action="Add Clinician" onPress={() => setEditingClinician(true)} />
          )}
        </Panel>

        <Panel style={styles.apptCard}>
          <Lbl>Next Appointment</Lbl>
          {activeProfile?.next_appointment ? (
            <>
              <View style={styles.apptRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.apptDate}>{activeProfile.next_appointment.date_label}</Text>
                  <Text style={styles.apptTime}>{activeProfile.next_appointment.time_label}</Text>
                </View>
              </View>
              <Btn tone="outline" onPress={() => setEditingAppt(true)} style={styles.rescheduleBtn}>
                Reschedule
              </Btn>
            </>
          ) : (
            <EmptyRow text="Nothing scheduled." action="Add Appointment" onPress={() => setEditingAppt(true)} />
          )}
        </Panel>

        <Panel style={styles.moodCard}>
          <Lbl>How does it feel?</Lbl>
          <View style={styles.moodGrid}>
            {MOODS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.moodBtn,
                  mood === m.id && { borderColor: m.color, backgroundColor: m.color + '15' },
                ]}
                onPress={() => handleMoodSelect(m.id)}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, { color: mood === m.id ? m.color : color.textDim }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {mood && (
            <View style={[styles.moodNote, { borderColor: MOODS.find(m => m.id === mood)?.color + '30' }]}>
              <Text style={styles.moodNoteText}>
                {MOODS.find(m => m.id === mood)?.note}
              </Text>
            </View>
          )}
          {moodHistory.length > 0 && (
            <View style={styles.moodHistory}>
              <Text style={styles.moodHistoryLabel}>Recent Log</Text>
              {moodHistory.slice(0, 5).map((entry, i) => {
                const m = MOODS.find(mo => mo.id === entry.mood);
                const d = new Date(entry.date);
                const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <View key={i} style={styles.moodHistoryRow}>
                    <Text style={styles.moodHistoryEmoji}>{m?.emoji}</Text>
                    <Text style={styles.moodHistoryLabel2}>{m?.label}</Text>
                    <Text style={styles.moodHistoryDate}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Panel>

        <Panel style={styles.teamCard}>
          <Lbl>Your Care Team</Lbl>
          {ROSTER.map((member, i) => (
            <View key={i} style={styles.teamRow}>
              <View style={styles.teamAvatar}>
                <Text style={styles.teamAvatarText}>
                  {member.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{member.name}</Text>
                <Text style={styles.teamRole}>{member.role}</Text>
              </View>
              <Btn tone="ghost" onPress={() => handleCall(member.phone, member.name)}>
                Call
              </Btn>
            </View>
          ))}
        </Panel>

        <Panel style={styles.supportCard}>
          <Lbl>Support</Lbl>
          <TouchableOpacity style={styles.supportRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setInfoModal('guide'); }}>
            <Text style={styles.supportIcon}>📋</Text>
            <View>
              <Text style={styles.supportLabel}>User Guide</Text>
              <Text style={styles.supportDesc}>How to use AVA Fit</Text>
            </View>
            <Text style={styles.supportChevron}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.supportRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setInfoModal('privacy'); }}>
            <Text style={styles.supportIcon}>🔒</Text>
            <View>
              <Text style={styles.supportLabel}>Privacy Policy</Text>
              <Text style={styles.supportDesc}>How we handle your data</Text>
            </View>
            <Text style={styles.supportChevron}>›</Text>
          </TouchableOpacity>
        </Panel>
      </ScrollView>

      <ClinicianModal
        visible={editingClinician}
        initial={activeProfile?.clinician}
        onClose={() => setEditingClinician(false)}
        onSave={(clinician) => { updateActiveProfile({ clinician }); setEditingClinician(false); }}
      />
      <AppointmentModal
        visible={editingAppt}
        initial={activeProfile?.next_appointment}
        onClose={() => setEditingAppt(false)}
        onSave={(next_appointment) => { updateActiveProfile({ next_appointment }); setEditingAppt(false); }}
      />
      <InfoModal
        visible={infoModal !== null}
        title={infoModal === 'guide' ? 'User Guide' : 'Privacy Policy'}
        content={infoModal === 'guide' ? USER_GUIDE : PRIVACY_POLICY}
        onClose={() => setInfoModal(null)}
      />
    </ScreenScaffold>
  );
}

function EmptyRow({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.emptyRow}>
      <Text style={styles.emptyText}>{text}</Text>
      <Btn tone="outline" onPress={onPress}>{action}</Btn>
    </View>
  );
}

/**
 * Shared bottom-sheet shell for the two edit forms below. Fixes the bug
 * where opening the keyboard (e.g. for the PHONE field) covered the title
 * and pushed Cancel/Save off-screen with no way back — the card had no
 * KeyboardAvoidingView and no scroll region, so anything the keyboard
 * overlapped simply became unreachable. Now: the keyboard pads the whole
 * sheet up, the title + an explicit close (✕) stay pinned above the fields
 * no matter what, the fields scroll in the space that's left, and tapping
 * the backdrop also closes it.
 */
function ModalSheet({
  visible, title, onClose, children, footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* `undefined` behavior is a no-op on Android — see the note on the
          equivalent KeyboardAvoidingView in app/login.tsx for why that
          matters with edge-to-edge enabled. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {children}
            </ScrollView>
            <View style={styles.modalFooter}>{footer}</View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ClinicianModal({ visible, initial, onClose, onSave }: {
  visible: boolean;
  initial?: { name: string; role: string; phone: string };
  onClose: () => void;
  onSave: (v: { name: string; role: string; phone: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  React.useEffect(() => { if (visible) { setName(initial?.name ?? ''); setRole(initial?.role ?? ''); setPhone(initial?.phone ?? ''); } }, [visible]);

  return (
    <ModalSheet
      visible={visible}
      title="Clinician Info"
      onClose={onClose}
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Btn tone="ghost" onPress={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn tone="cyan" onPress={() => name.trim() && onSave({ name: name.trim(), role: role.trim(), phone: phone.trim() })} style={{ flex: 1 }}>Save</Btn>
        </View>
      }
    >
      <ModalField label="NAME" value={name} onChangeText={setName} placeholder="Dr. Jane Smith" />
      <ModalField label="ROLE" value={role} onChangeText={setRole} placeholder="Lead Prosthetist" />
      <ModalField label="PHONE" value={phone} onChangeText={setPhone} placeholder="+1 555 0100" keyboardType="phone-pad" />
    </ModalSheet>
  );
}

function AppointmentModal({ visible, initial, onClose, onSave }: {
  visible: boolean;
  initial?: { date_label: string; time_label: string };
  onClose: () => void;
  onSave: (v: { date_label: string; time_label: string }) => void;
}) {
  const [dateLabel, setDateLabel] = useState(initial?.date_label ?? '');
  const [timeLabel, setTimeLabel] = useState(initial?.time_label ?? '');
  React.useEffect(() => { if (visible) { setDateLabel(initial?.date_label ?? ''); setTimeLabel(initial?.time_label ?? ''); } }, [visible]);

  return (
    <ModalSheet
      visible={visible}
      title="Next Appointment"
      onClose={onClose}
      footer={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Btn tone="ghost" onPress={onClose} style={{ flex: 1 }}>Cancel</Btn>
          <Btn tone="cyan" onPress={() => dateLabel.trim() && onSave({ date_label: dateLabel.trim(), time_label: timeLabel.trim() })} style={{ flex: 1 }}>Save</Btn>
        </View>
      }
    >
      <ModalField label="DATE" value={dateLabel} onChangeText={setDateLabel} placeholder="Thursday, 4 September" />
      <ModalField label="TIME & LOCATION" value={timeLabel} onChangeText={setTimeLabel} placeholder="10:30 AM · Quorum Prosthetics Clinic" />
    </ModalSheet>
  );
}

function ModalField({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: 'phone-pad';
}) {
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={styles.modalFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        keyboardType={keyboardType}
        style={styles.modalInput}
      />
    </View>
  );
}

function InfoModal({ visible, title, content, onClose }: { visible: boolean; title: string; content: string; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, { maxHeight: '80%' }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.infoBody}>{content}</Text>
          </ScrollView>
          <Btn tone="cyan" onPress={onClose} style={{ marginTop: space.lg }}>Done</Btn>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.xxl },
  clinicianCard: { padding: space.md, marginBottom: space.md },
  clinicianRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  clinicianAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.cyan + '20', borderWidth: 1, borderColor: color.cyan + '40', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: 'DM Mono_500Medium', fontSize: 14, color: color.cyan },
  clinicianInfo: { marginLeft: space.md, flex: 1 },
  clinicianName: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: color.text },
  clinicianRole: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, marginTop: 2 },
  clinicianActions: { flexDirection: 'row', gap: space.sm },
  clinBtn: { flex: 1 },
  editLink: { fontFamily: 'DM Mono_500Medium', fontSize: 11, color: color.cyan },
  emptyRow: { alignItems: 'center', paddingVertical: space.sm, gap: space.sm },
  emptyText: { fontFamily: 'DM Mono_400Regular', fontSize: 11, color: color.textFaint },
  apptCard: { padding: space.md, marginBottom: space.md },
  apptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
  apptDate: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: color.text },
  apptTime: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, marginTop: 2 },
  rescheduleBtn: { alignSelf: 'flex-start' },
  moodCard: { padding: space.md, marginBottom: space.md },
  moodGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  moodBtn: { flex: 1, alignItems: 'center', padding: space.sm, marginHorizontal: 3, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: color.panelDeep },
  moodEmoji: { fontSize: 24, marginBottom: 4 },
  moodLabel: { fontFamily: 'DM Mono_500Medium', fontSize: 10, letterSpacing: 0.5 },
  moodNote: { marginTop: space.sm, padding: space.sm, borderRadius: radius.sm, borderWidth: 1 },
  moodNoteText: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, lineHeight: 18 },
  moodHistory: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line },
  moodHistoryLabel: { fontFamily: 'DM Mono_500Medium', fontSize: 10, color: color.textFaint, letterSpacing: 0.5, marginBottom: space.sm },
  moodHistoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: space.sm },
  moodHistoryEmoji: { fontSize: 18 },
  moodHistoryLabel2: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: color.text, flex: 1 },
  moodHistoryDate: { fontFamily: 'DM Mono_400Regular', fontSize: 10, color: color.textFaint },
  teamCard: { padding: space.md, marginBottom: space.md },
  teamRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  teamAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.panelDeep, borderWidth: 1, borderColor: color.line, justifyContent: 'center', alignItems: 'center' },
  teamAvatarText: { fontFamily: 'DM Mono_500Medium', fontSize: 12, color: color.textDim },
  teamName: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: color.text },
  teamRole: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: color.textDim, marginTop: 1 },
  supportCard: { padding: space.md, marginBottom: space.md },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  supportIcon: { fontSize: 20, width: 32, textAlign: 'center' },
  supportLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: color.text },
  supportDesc: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: color.textFaint, marginTop: 1 },
  supportChevron: { fontFamily: 'DM Mono_400Regular', fontSize: 20, color: color.textFaint, fontWeight: '300' },
  divider: { height: 1, backgroundColor: color.line, marginVertical: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,16,0.7)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '85%', backgroundColor: color.panel, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg, paddingBottom: space.xl },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalCloseIcon: { fontFamily: font.body, fontSize: 16, color: color.textFaint, padding: 4 },
  // React Native's default flexShrink is 0 (unlike web CSS's 1) — without
  // setting it explicitly here, this ScrollView wouldn't shrink to fit
  // modalCard's maxHeight at all, and its overflow would just get clipped
  // by the parent instead of becoming scrollable, reintroducing the exact
  // "can't reach it" bug this component exists to fix.
  modalScroll: { flexGrow: 0, flexShrink: 1, marginTop: space.sm },
  modalFooter: { marginTop: space.md },
  modalTitle: { fontFamily: font.bodyBold, fontSize: 18, color: color.text },
  modalFieldLabel: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: color.textFaint, marginBottom: 6 },
  modalInput: { fontFamily: font.body, fontSize: 14, color: color.text, borderWidth: 1, borderColor: color.line, backgroundColor: color.panelDeep, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 12 },
  infoBody: { fontFamily: font.body, fontSize: 13, color: color.textDim, lineHeight: 20 },
});
