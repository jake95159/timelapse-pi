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

// ── Shared wheel column: arrows to increment, tap value to type ──

interface WheelColumnProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}

function WheelColumn({ label, value, onChange, min, max }: WheelColumnProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const handleTap = () => {
    setText(String(value));
    setEditing(true);
  };

  const handleSubmit = () => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)));
    }
    setEditing(false);
  };

  const increment = () => {
    setEditing(false);
    onChange(Math.min(value + 1, max));
  };

  const decrement = () => {
    setEditing(false);
    onChange(Math.max(value - 1, min));
  };

  return (
    <View style={pickerStyles.wheelCol}>
      <Text style={pickerStyles.wheelLabel}>{label}</Text>
      <View style={pickerStyles.wheel}>
        <TouchableOpacity onPress={increment} hitSlop={{ top: 4, bottom: 4, left: 12, right: 12 }}>
          <Text style={pickerStyles.arrow}>{'\u25B2'}</Text>
        </TouchableOpacity>
        {editing ? (
          <TextInput
            style={pickerStyles.wheelInput}
            value={text}
            onChangeText={setText}
            onBlur={handleSubmit}
            onSubmitEditing={handleSubmit}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            maxLength={2}
          />
        ) : (
          <TouchableOpacity onPress={handleTap} hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}>
            <Text style={pickerStyles.wheelValue}>{String(value).padStart(2, '0')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={decrement} hitSlop={{ top: 4, bottom: 4, left: 12, right: 12 }}>
          <Text style={pickerStyles.arrow}>{'\u25BC'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Duration picker (for SW interval, value in seconds) ──

interface DurationPickerProps {
  visible: boolean;
  value: number;
  onConfirm: (seconds: number) => void;
  onCancel: () => void;
  showSeconds?: boolean;
  title: string;
}

function DurationPickerModal({ visible, value, onConfirm, onCancel, showSeconds = true, title }: DurationPickerProps) {
  const [hours, setHours] = useState(Math.floor(value / 3600));
  const [minutes, setMinutes] = useState(Math.floor((value % 3600) / 60));
  const [seconds, setSeconds] = useState(value % 60);

  React.useEffect(() => {
    setHours(Math.floor(value / 3600));
    setMinutes(Math.floor((value % 3600) / 60));
    setSeconds(value % 60);
  }, [value, visible]);

  const handleConfirm = () => {
    onConfirm(hours * 3600 + minutes * 60 + (showSeconds ? seconds : 0));
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.modal}>
          <Text style={pickerStyles.title}>{title}</Text>

          <View style={pickerStyles.wheelsRow}>
            <WheelColumn label="HR" value={hours} onChange={setHours} min={0} max={99} />
            <Text style={pickerStyles.colon}>:</Text>
            <WheelColumn label="MIN" value={minutes} onChange={setMinutes} min={0} max={59} />
            {showSeconds && (
              <>
                <Text style={pickerStyles.colon}>:</Text>
                <WheelColumn label="SEC" value={seconds} onChange={setSeconds} min={0} max={59} />
              </>
            )}
          </View>

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

// ── TPL5110 DIP switch timing engine ──

const SWITCH_RESISTORS: [string, number][] = [
  ['A', 16200],
  ['B', 22000],
  ['C', 93100],
  ['D', 124000],
  ['E', 169000],
];

const TIMING_SETS = [
  { minT: 1, maxT: 5, a: 0.2253, b: -20.7654, c: 570.5679 },
  { minT: 5, maxT: 10, a: -0.1284, b: 46.9861, c: -2651.8889 },
  { minT: 10, maxT: 100, a: 0.1972, b: -19.3450, c: 692.1201 },
  { minT: 100, maxT: 1000, a: 0.2617, b: -56.2407, c: 5957.7934 },
  { minT: 1000, maxT: 7200, a: 0.3177, b: -136.2571, c: 34522.4680 },
];

function resistanceToTime(rOhms: number): number {
  const rd = rOhms / 100;
  for (const { minT, maxT, a, b, c } of TIMING_SETS) {
    const t = Math.floor((a * rd * rd + b * rd + c) / 100);
    if (t >= minT && t <= maxT) return t;
  }
  const last = TIMING_SETS[TIMING_SETS.length - 1];
  return Math.max(1, Math.floor((last.a * rd * rd + last.b * rd + last.c) / 100));
}

interface DipCombo {
  sw: boolean[];
  seconds: number;
  label: string;
}

function formatDipTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function buildDipCombos(): DipCombo[] {
  const combos: DipCombo[] = [];
  for (let mask = 1; mask < 32; mask++) {
    const sw = [false, false, false, false, false];
    const resistances: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (mask & (1 << i)) {
        sw[i] = true;
        resistances.push(SWITCH_RESISTORS[i][1]);
      }
    }
    const rParallel = 1 / resistances.reduce((sum, r) => sum + 1 / r, 0);
    const seconds = resistanceToTime(rParallel);
    combos.push({ sw, seconds, label: formatDipTime(seconds) });
  }
  combos.sort((a, b) => a.seconds - b.seconds);
  return combos;
}

// Pre-compute all valid combos (≥ 55s to include B's ~59s ≈ 1 min)
const ALL_DIP_COMBOS = buildDipCombos();
const VALID_DIP_COMBOS = ALL_DIP_COMBOS.filter(c => c.seconds >= 55);

// ── Hardware interval picker with DIP switch selector ──

function HardwareIntervalPicker({ visible, value, onConfirm, onCancel }: {
  visible: boolean;
  value: number;
  onConfirm: (seconds: number) => void;
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);

  React.useEffect(() => {
    let closest = 0;
    let minDiff = Infinity;
    VALID_DIP_COMBOS.forEach((c, i) => {
      const diff = Math.abs(value - c.seconds);
      if (diff < minDiff) { closest = i; minDiff = diff; }
    });
    setIndex(closest);
  }, [value, visible]);

  const combo = VALID_DIP_COMBOS[index];
  const atMax = index >= VALID_DIP_COMBOS.length - 1;
  const atMin = index <= 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.modal}>
          <Text style={pickerStyles.title}>HARDWARE INTERVAL</Text>

          <View style={hwStyles.selector}>
            <TouchableOpacity
              onPress={() => !atMax && setIndex(index + 1)}
              hitSlop={{ top: 8, bottom: 4, left: 20, right: 20 }}
            >
              <Text style={[pickerStyles.arrow, atMax && { color: colors.border }]}>{'\u25B2'}</Text>
            </TouchableOpacity>
            <Text style={hwStyles.timeDisplay}>{combo.label}</Text>
            <TouchableOpacity
              onPress={() => !atMin && setIndex(index - 1)}
              hitSlop={{ top: 4, bottom: 8, left: 20, right: 20 }}
            >
              <Text style={[pickerStyles.arrow, atMin && { color: colors.border }]}>{'\u25BC'}</Text>
            </TouchableOpacity>
          </View>

          <DipSwitchGraphic switches={combo.sw} />

          <View style={pickerStyles.buttons}>
            <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onCancel}>
              <Text style={pickerStyles.cancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pickerStyles.confirmBtn} onPress={() => onConfirm(combo.seconds)}>
              <Text style={pickerStyles.confirmText}>SET</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── DIP switch graphic ──

function DipSwitchGraphic({ switches }: { switches: boolean[] }) {
  return (
    <View style={dipStyles.container}>
      <View style={dipStyles.housing}>
        <Text style={dipStyles.onLabel}>ON</Text>
        <View style={dipStyles.switchRow}>
          {switches.map((isOn, i) => (
            <View key={i} style={dipStyles.switchCol}>
              <View style={[dipStyles.track, isOn && dipStyles.trackOn]}>
                <View style={[dipStyles.knob, isOn && dipStyles.knobOn]} />
              </View>
              <Text style={[dipStyles.num, isOn && dipStyles.numOn]}>
                {String.fromCharCode(65 + i)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── Offset picker (for sunrise/sunset offsets, value in minutes) ──

interface OffsetPickerProps {
  visible: boolean;
  value: number;
  onConfirm: (minutes: number) => void;
  onCancel: () => void;
  title: string;
}

function OffsetPickerModal({ visible, value, onConfirm, onCancel, title }: OffsetPickerProps) {
  const [positive, setPositive] = useState(value >= 0);
  const [hours, setHours] = useState(Math.floor(Math.abs(value) / 60));
  const [minutes, setMinutes] = useState(Math.abs(value) % 60);

  React.useEffect(() => {
    setPositive(value >= 0);
    setHours(Math.floor(Math.abs(value) / 60));
    setMinutes(Math.abs(value) % 60);
  }, [value, visible]);

  const handleConfirm = () => {
    const total = hours * 60 + minutes;
    onConfirm(positive ? total : -total);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.modal}>
          <Text style={pickerStyles.title}>{title}</Text>

          <View style={pickerStyles.signRow}>
            <TouchableOpacity
              style={[pickerStyles.signBtn, positive && pickerStyles.signBtnActive]}
              onPress={() => setPositive(true)}
            >
              <Text style={[pickerStyles.signText, positive && pickerStyles.signTextActive]}>+ AFTER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pickerStyles.signBtn, !positive && pickerStyles.signBtnActive]}
              onPress={() => setPositive(false)}
            >
              <Text style={[pickerStyles.signText, !positive && pickerStyles.signTextActive]}>- BEFORE</Text>
            </TouchableOpacity>
          </View>

          <View style={pickerStyles.wheelsRow}>
            <WheelColumn label="HR" value={hours} onChange={setHours} min={0} max={12} />
            <Text style={pickerStyles.colon}>:</Text>
            <WheelColumn label="MIN" value={minutes} onChange={setMinutes} min={0} max={59} />
          </View>

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

// ── Time picker (for start/end window, value as "HH:MM") ──

interface TimePickerProps {
  visible: boolean;
  value: string;
  onConfirm: (time: string) => void;
  onCancel: () => void;
  title: string;
}

function TimePickerModal({ visible, value, onConfirm, onCancel, title }: TimePickerProps) {
  const parts = value.split(':').map(Number);
  const [hours, setHours] = useState(parts[0] || 0);
  const [minutes, setMinutes] = useState(parts[1] || 0);

  React.useEffect(() => {
    const p = value.split(':').map(Number);
    setHours(p[0] || 0);
    setMinutes(p[1] || 0);
  }, [value, visible]);

  const handleConfirm = () => {
    onConfirm(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.modal}>
          <Text style={pickerStyles.title}>{title}</Text>

          <View style={pickerStyles.wheelsRow}>
            <WheelColumn label="HR" value={hours} onChange={setHours} min={0} max={23} />
            <Text style={pickerStyles.colon}>:</Text>
            <WheelColumn label="MIN" value={minutes} onChange={setMinutes} min={0} max={59} />
          </View>

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

// ── Helpers ──

function formatInterval(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ''}`;
  if (m > 0) return `${m}m${s > 0 ? `${s}s` : ''}`;
  return `${s}s`;
}

function formatOffset(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h > 0 && m > 0) return `${sign}${h}h${m}m`;
  if (h > 0) return `${sign}${h}h`;
  return `${sign}${m}m`;
}

// ── Main component ──

const TOUCH_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export function CaptureSettings({ softwareInterval, hardwareInterval, daylightOnly, sunriseOffset = 0, sunsetOffset = 0, windowStart = '06:00', windowEnd = '20:00', onUpdate }: Props) {
  const [swPickerOpen, setSwPickerOpen] = useState(false);
  const [hwPickerOpen, setHwPickerOpen] = useState(false);
  const [sunrisePickerOpen, setSunrisePickerOpen] = useState(false);
  const [sunsetPickerOpen, setSunsetPickerOpen] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>CAPTURE</Text>

      <View style={styles.row}>
        <TouchableOpacity style={styles.setting} onPress={() => setSwPickerOpen(true)} hitSlop={TOUCH_SLOP}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <Text style={[styles.settingValue, glowStyle]}>{formatInterval(softwareInterval)}</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.setting} onPress={() => setHwPickerOpen(true)} hitSlop={TOUCH_SLOP}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <Text style={styles.hwLabel}>HW</Text>
          <Text style={[styles.settingValue, glowStyle]}>{formatInterval(hardwareInterval)}</Text>
        </TouchableOpacity>

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

        {daylightOnly ? (
          <>
            <TouchableOpacity style={styles.setting} onPress={() => setSunrisePickerOpen(true)} hitSlop={TOUCH_SLOP}>
              <SunHorizon size={14} color={colors.textMuted} weight="duotone" />
              <Text style={[styles.settingValue, glowStyle]}>{formatOffset(sunriseOffset)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.setting} onPress={() => setSunsetPickerOpen(true)} hitSlop={TOUCH_SLOP}>
              <SunHorizon size={14} color={colors.textMuted} weight="duotone" style={{ transform: [{ scaleY: -1 }] }} />
              <Text style={[styles.settingValue, glowStyle]}>{formatOffset(sunsetOffset)}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.setting} onPress={() => setStartPickerOpen(true)} hitSlop={TOUCH_SLOP}>
              <Clock size={14} color={colors.textMuted} weight="duotone" />
              <Text style={[styles.settingValue, glowStyle]}>{windowStart}</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.setting} onPress={() => setEndPickerOpen(true)} hitSlop={TOUCH_SLOP}>
              <Clock size={14} color={colors.textMuted} weight="duotone" />
              <Text style={[styles.settingValue, glowStyle]}>{windowEnd}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <DurationPickerModal
        visible={swPickerOpen}
        value={softwareInterval}
        onConfirm={v => { onUpdate('software_interval_sec', v); setSwPickerOpen(false); }}
        onCancel={() => setSwPickerOpen(false)}
        showSeconds={true}
        title="SOFTWARE INTERVAL"
      />

      <HardwareIntervalPicker
        visible={hwPickerOpen}
        value={hardwareInterval}
        onConfirm={v => { onUpdate('hardware_interval_sec', v); setHwPickerOpen(false); }}
        onCancel={() => setHwPickerOpen(false)}
      />

      <OffsetPickerModal
        visible={sunrisePickerOpen}
        value={sunriseOffset}
        onConfirm={v => { onUpdate('sunrise_offset_min', v); setSunrisePickerOpen(false); }}
        onCancel={() => setSunrisePickerOpen(false)}
        title="SUNRISE OFFSET"
      />

      <OffsetPickerModal
        visible={sunsetPickerOpen}
        value={sunsetOffset}
        onConfirm={v => { onUpdate('sunset_offset_min', v); setSunsetPickerOpen(false); }}
        onCancel={() => setSunsetPickerOpen(false)}
        title="SUNSET OFFSET"
      />

      <TimePickerModal
        visible={startPickerOpen}
        value={windowStart}
        onConfirm={v => { onUpdate('window_start', v); setStartPickerOpen(false); }}
        onCancel={() => setStartPickerOpen(false)}
        title="START TIME"
      />

      <TimePickerModal
        visible={endPickerOpen}
        value={windowEnd}
        onConfirm={v => { onUpdate('window_end', v); setEndPickerOpen(false); }}
        onCancel={() => setEndPickerOpen(false)}
        title="END TIME"
      />
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionHeader: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  settingValue: { fontSize: 11, color: colors.text },
  hwLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  divider: { width: 1, height: 14, backgroundColor: colors.borderLight },
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
  wheelInput: {
    fontFamily: PIXEL_FONT,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
    paddingVertical: 0,
    minWidth: 48,
  },
  arrow: { color: colors.textMuted, fontSize: 16, padding: spacing.xs },
  colon: { fontFamily: PIXEL_FONT, fontSize: 28, color: colors.textMuted, marginHorizontal: spacing.sm, marginTop: spacing.lg },
  buttons: { flexDirection: 'row', gap: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  cancelText: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  confirmBtn: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 4, backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.borderLight },
  confirmText: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.text, letterSpacing: 1 },
  signRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md, gap: spacing.sm },
  signBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
  signBtnActive: { borderColor: colors.textMuted, backgroundColor: colors.surfaceLight },
  signText: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.textMuted, letterSpacing: 1 },
  signTextActive: { color: colors.text },
});

const hwStyles = StyleSheet.create({
  selector: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timeDisplay: {
    fontFamily: PIXEL_FONT,
    fontSize: 28,
    color: colors.text,
    textShadowColor: 'rgba(200,200,200,0.3)',
    textShadowRadius: 4,
    letterSpacing: 2,
  },
});

const dipStyles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: spacing.lg },
  housing: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  onLabel: {
    fontFamily: PIXEL_FONT,
    fontSize: 8,
    color: colors.textDim,
    letterSpacing: 2,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  switchRow: { flexDirection: 'row', gap: 12 },
  switchCol: { alignItems: 'center', gap: 4 },
  track: {
    width: 24,
    height: 44,
    backgroundColor: colors.background,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    justifyContent: 'flex-end' as const,
  },
  trackOn: {
    justifyContent: 'flex-start' as const,
    borderColor: colors.textMuted,
  },
  knob: {
    width: '100%' as unknown as number,
    height: 16,
    backgroundColor: colors.textDim,
    borderRadius: 2,
  },
  knobOn: {
    backgroundColor: colors.text,
    shadowColor: 'rgba(200,200,200,0.4)',
    shadowRadius: 4,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  num: { fontFamily: PIXEL_FONT, fontSize: 10, color: colors.textDim },
  numOn: { color: colors.textMuted },
});
