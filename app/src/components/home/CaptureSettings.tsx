import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet } from 'react-native';
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

function EditableValue({ value, onSubmit, suffix, minValue }: { value: number; onSubmit: (v: number) => void; suffix: string; minValue?: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  const handleSubmit = () => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && (!minValue || num >= minValue)) {
      onSubmit(num);
    } else {
      setText(String(value));
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
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
      />
    );
  }

  return (
    <TouchableOpacity onPress={() => { setText(String(value)); setEditing(true); }}>
      <Text style={[styles.settingValue, glowStyle]}>{value}{suffix}</Text>
    </TouchableOpacity>
  );
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
  const hwMinutes = Math.round(hardwareInterval / 60);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>CAPTURE</Text>

      <View style={styles.row}>
        <View style={styles.setting}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <EditableValue value={softwareInterval} onSubmit={v => onUpdate('software_interval_sec', v)} suffix="s" />
        </View>

        <View style={styles.divider} />

        <View style={styles.setting}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <Text style={styles.hwLabel}>HW</Text>
          <EditableValue value={hwMinutes} onSubmit={v => onUpdate('hardware_interval_sec', v * 60)} suffix="m" minValue={1} />
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
