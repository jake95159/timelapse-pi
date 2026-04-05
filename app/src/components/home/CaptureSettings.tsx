import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Clock, Sun, SunHorizon } from 'phosphor-react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  softwareInterval: number;
  hardwareInterval: number;
  daylightOnly: boolean;
  sunriseOffset?: number;
  sunsetOffset?: number;
  windowStart?: string;
  windowEnd?: string;
  onUpdate: (key: string, value: unknown) => void;
}

interface DurationPickerProps {
  visible: boolean;
  value: number; // total seconds
  onConfirm: (seconds: number) => void;
  onCancel: () => void;
  minMinutes?: number;
  showSeconds?: boolean;
  title: string;
  infoText?: string;
}

function DurationPickerModal({ visible, value, onConfirm, onCancel, minMinutes, showSeconds = true, title, infoText }: DurationPickerProps) {
  const [hours, setHours] = useState(Math.floor(value / 3600));
  const [minutes, setMinutes] = useState(Math.floor((value % 3600) / 60));
  const [seconds, setSeconds] = useState(value % 60);

  React.useEffect(() => {
    setHours(Math.floor(value / 3600));
    setMinutes(Math.floor((value % 3600) / 60));
    setSeconds(value % 60);
  }, [value, visible]);

  const handleConfirm = () => {
    let total = hours * 3600 + minutes * 60 + (showSeconds ? seconds : 0);
    if (minMinutes && total < minMinutes * 60) total = minMinutes * 60;
    onConfirm(total);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.modal}>
          <Text style={pickerStyles.title}>{title}</Text>

          <View style={pickerStyles.wheelsRow}>
            {/* Hours */}
            <View style={pickerStyles.wheelCol}>
              <Text style={pickerStyles.wheelLabel}>HR</Text>
              <View style={pickerStyles.wheel}>
                <TouchableOpacity onPress={() => setHours(Math.min(hours + 1, 99))}>
                  <Text style={pickerStyles.arrow}>{'\u25B2'}</Text>
                </TouchableOpacity>
                <Text style={pickerStyles.wheelValue}>{String(hours).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setHours(Math.max(hours - 1, 0))}>
                  <Text style={pickerStyles.arrow}>{'\u25BC'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={pickerStyles.colon}>:</Text>

            {/* Minutes */}
            <View style={pickerStyles.wheelCol}>
              <Text style={pickerStyles.wheelLabel}>MIN</Text>
              <View style={pickerStyles.wheel}>
                <TouchableOpacity onPress={() => setMinutes(Math.min(minutes + 1, 59))}>
                  <Text style={pickerStyles.arrow}>{'\u25B2'}</Text>
                </TouchableOpacity>
                <Text style={pickerStyles.wheelValue}>{String(minutes).padStart(2, '0')}</Text>
                <TouchableOpacity onPress={() => setMinutes(Math.max(minutes - 1, 0))}>
                  <Text style={pickerStyles.arrow}>{'\u25BC'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showSeconds && (
              <>
                <Text style={pickerStyles.colon}>:</Text>
                {/* Seconds */}
                <View style={pickerStyles.wheelCol}>
                  <Text style={pickerStyles.wheelLabel}>SEC</Text>
                  <View style={pickerStyles.wheel}>
                    <TouchableOpacity onPress={() => setSeconds(Math.min(seconds + 1, 59))}>
                      <Text style={pickerStyles.arrow}>{'\u25B2'}</Text>
                    </TouchableOpacity>
                    <Text style={pickerStyles.wheelValue}>{String(seconds).padStart(2, '0')}</Text>
                    <TouchableOpacity onPress={() => setSeconds(Math.max(seconds - 1, 0))}>
                      <Text style={pickerStyles.arrow}>{'\u25BC'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>

          {infoText && (
            <View style={pickerStyles.infoBox}>
              <Text style={pickerStyles.infoText}>{infoText}</Text>
            </View>
          )}

          <View style={pickerStyles.buttons}>
            <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onCancel}>
              <Text style={pickerStyles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pickerStyles.confirmBtn} onPress={handleConfirm}>
              <Text style={pickerStyles.confirmText}>SET</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatInterval(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ''}`;
  if (m > 0) return `${m}m${s > 0 ? `${s}s` : ''}`;
  return `${s}s`;
}

function OffsetInput({ value, onSubmit }: { value: number; onSubmit: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(Math.abs(value)));

  const handleSubmit = () => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      onSubmit(value >= 0 ? num : -num);
    }
    setEditing(false);
  };

  const toggleSign = () => onSubmit(-value);

  if (editing) {
    return (
      <TextInput
        style={styles.editInput}
        value={text}
        onChangeText={setText}
        onBlur={handleSubmit}
        onSubmitEditing={handleSubmit}
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <TouchableOpacity onPress={toggleSign}>
        <Text style={[styles.settingValue, { color: colors.textMuted }]}>{value >= 0 ? '+' : '-'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setText(String(Math.abs(value))); setEditing(true); }}>
        <Text style={[styles.settingValue, glowStyle]}>{Math.abs(value)}m</Text>
      </TouchableOpacity>
    </View>
  );
}

function EditableTimeValue({ value, onSubmit }: { value: string; onSubmit: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  const handleSubmit = () => {
    if (/^\d{1,2}:\d{2}$/.test(text)) {
      onSubmit(text);
    } else {
      setText(value);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        style={styles.editInput}
        value={text}
        onChangeText={setText}
        onBlur={handleSubmit}
        onSubmitEditing={handleSubmit}
        autoFocus
        selectTextOnFocus
      />
    );
  }

  return (
    <TouchableOpacity onPress={() => { setText(value); setEditing(true); }}>
      <Text style={[styles.settingValue, glowStyle]}>{value}</Text>
    </TouchableOpacity>
  );
}

export function CaptureSettings({ softwareInterval, hardwareInterval, daylightOnly, sunriseOffset = 0, sunsetOffset = 0, windowStart = '06:00', windowEnd = '20:00', onUpdate }: Props) {
  const [swPickerOpen, setSwPickerOpen] = useState(false);
  const [hwPickerOpen, setHwPickerOpen] = useState(false);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>CAPTURE</Text>

      <View style={styles.row}>
        <View style={styles.setting}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <TouchableOpacity onPress={() => setSwPickerOpen(true)}>
            <Text style={[styles.settingValue, glowStyle]}>{formatInterval(softwareInterval)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.setting}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <Text style={styles.hwLabel}>HW</Text>
          <TouchableOpacity onPress={() => setHwPickerOpen(true)}>
            <Text style={[styles.settingValue, glowStyle]}>{formatInterval(hardwareInterval)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.setting}>
          <Sun size={14} color={colors.textMuted} weight="duotone" />
          <Text style={[styles.settingLabel, daylightOnly && { color: colors.success }]}>DAYLIGHT</Text>
          <Switch
            value={daylightOnly}
            onValueChange={v => onUpdate('daylight_only', v)}
            trackColor={{ false: colors.border, true: colors.successBg }}
            thumbColor={daylightOnly ? colors.success : colors.textMuted}
            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
          />
        </View>
      </View>

      {daylightOnly ? (
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <View style={styles.setting}>
            <SunHorizon size={14} color={colors.textMuted} weight="duotone" />
            <OffsetInput value={sunriseOffset} onSubmit={v => onUpdate('sunrise_offset_min', v)} />
          </View>
          <View style={styles.divider} />
          <View style={styles.setting}>
            <SunHorizon size={14} color={colors.textMuted} weight="duotone" style={{ transform: [{ scaleY: -1 }] }} />
            <OffsetInput value={sunsetOffset} onSubmit={v => onUpdate('sunset_offset_min', v)} />
          </View>
        </View>
      ) : (
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <View style={styles.setting}>
            <Clock size={14} color={colors.textMuted} weight="duotone" />
            <EditableTimeValue value={windowStart} onSubmit={v => onUpdate('window_start', v)} />
          </View>
          <View style={styles.divider} />
          <View style={styles.setting}>
            <Clock size={14} color={colors.textMuted} weight="duotone" />
            <EditableTimeValue value={windowEnd} onSubmit={v => onUpdate('window_end', v)} />
          </View>
        </View>
      )}

      <DurationPickerModal
        visible={swPickerOpen}
        value={softwareInterval}
        onConfirm={v => { onUpdate('software_interval_sec', v); setSwPickerOpen(false); }}
        onCancel={() => setSwPickerOpen(false)}
        showSeconds={true}
        title="SOFTWARE INTERVAL"
      />

      <DurationPickerModal
        visible={hwPickerOpen}
        value={hardwareInterval}
        onConfirm={v => { onUpdate('hardware_interval_sec', v); setHwPickerOpen(false); }}
        onCancel={() => setHwPickerOpen(false)}
        showSeconds={false}
        minMinutes={1}
        title="HARDWARE INTERVAL"
        infoText={"The TPL5110 timer board uses DIP switches to set the interval.\n\nCommon settings:\n  SW1-4: ON OFF OFF OFF = ~1 min\n  SW1-4: OFF ON OFF OFF = ~2 min\n  SW1-4: ON ON OFF OFF = ~4 min\n  SW1-4: OFF OFF ON OFF = ~8 min\n  SW1-4: ON OFF ON OFF = ~16 min\n  SW1-4: OFF ON ON OFF = ~30 min\n  SW1-4: ON ON ON OFF = ~1 hr\n  SW1-4: OFF OFF OFF ON = ~2 hr\n\nSet this value to match your DIP switch setting."}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionHeader: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  settingValue: { fontSize: 11, color: colors.text },
  hwLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  divider: { width: 1, height: 14, backgroundColor: colors.borderLight },
  editInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    minWidth: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modal: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.lg, width: '100%', maxWidth: 320, borderWidth: 1, borderColor: colors.border },
  title: { fontFamily: PIXEL_FONT, fontSize: 14, color: colors.text, textAlign: 'center', marginBottom: spacing.lg, letterSpacing: 1 },
  wheelsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg },
  wheelCol: { alignItems: 'center' },
  wheelLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 1, marginBottom: spacing.xs },
  wheel: { alignItems: 'center', gap: spacing.sm },
  wheelValue: { fontFamily: PIXEL_FONT, fontSize: 28, color: colors.text, textShadowColor: 'rgba(200,200,200,0.3)', textShadowRadius: 4 },
  arrow: { color: colors.textMuted, fontSize: 16, padding: spacing.xs },
  colon: { fontFamily: PIXEL_FONT, fontSize: 28, color: colors.textMuted, marginHorizontal: spacing.sm, marginTop: spacing.lg },
  infoBox: { backgroundColor: colors.surfaceLight, borderRadius: 4, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  infoText: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },
  buttons: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  cancelText: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  confirmBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 4, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.borderLight },
  confirmText: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.text, letterSpacing: 1 },
});
