import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CaretDown, Eyedropper, Crosshair } from 'phosphor-react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';
import type { TapMode } from './Viewfinder';

interface CameraConfig {
  analogue_gain: number;
  exposure_mode: string;
  awb_mode: string;
  red_gain: number;
  blue_gain: number;
  shutter_speed: number | null;
  ev_compensation: number;
  metering_mode: string;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  noise_reduction: string;
}

interface Props {
  camera: CameraConfig;
  onUpdate: (key: string, value: unknown) => void;
  tapMode?: TapMode;
  onEyedropper?: () => void;
  onMeterPick?: () => void;
}

const AWB_MODES = ['auto', 'daylight', 'cloudy', 'tungsten', 'fluorescent', 'indoor', 'manual'];
const SHUTTER_SPEEDS = [
  { label: '1/1000', value: 1000 },
  { label: '1/500', value: 2000 },
  { label: '1/250', value: 4000 },
  { label: '1/125', value: 8000 },
  { label: '1/60', value: 16667 },
  { label: '1/30', value: 33333 },
  { label: '1/15', value: 66667 },
  { label: '1/8', value: 125000 },
  { label: '1/4', value: 250000 },
  { label: '1/2', value: 500000 },
  { label: '1s', value: 1000000 },
  { label: '2s', value: 2000000 },
  { label: '5s', value: 5000000 },
  { label: '10s', value: 10000000 },
];
const METERING_MODES = ['centre', 'spot', 'matrix'];
const NR_MODES = ['off', 'fast', 'high_quality', 'minimal'];

function Chip({ label, value, active, onPress }: { label: string; value: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipExpanded]} onPress={onPress}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, glowStyle]}>{value}</Text>
      <CaretDown size={8} color={colors.textDim} weight="bold" />
    </TouchableOpacity>
  );
}

function DiscreteStrip({ options, selected, onSelect }: { options: Array<{ label: string; value: unknown }>; selected: unknown; onSelect: (v: unknown) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.label}
          style={[styles.stripItem, opt.value === selected && styles.stripItemActive]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[styles.stripText, opt.value === selected && styles.stripTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SliderStrip({ min, max, step, value, onValueChange, formatLabel }: { min: number; max: number; step: number; value: number; onValueChange: (v: number) => void; formatLabel?: (v: number) => string }) {
  const label = formatLabel ? formatLabel(value) : value.toFixed(1);
  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderValue}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onSlidingComplete={onValueChange}
        minimumTrackTintColor={colors.textMuted}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.text}
      />
    </View>
  );
}

export function CameraSettings({ camera, onUpdate, tapMode = 'none', onEyedropper, onMeterPick }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tier2Open, setTier2Open] = useState(false);

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  const shutterLabel = () => {
    if (!camera.shutter_speed) return 'AUTO';
    const match = SHUTTER_SPEEDS.find(s => s.value === camera.shutter_speed);
    return match?.label ?? `${camera.shutter_speed}us`;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>CAMERA</Text>

      {/* Tier 1 */}
      <View style={styles.chipRow}>
        <Chip label="GAIN" value={`${camera.analogue_gain.toFixed(1)}×`} active={expanded === 'gain'} onPress={() => toggle('gain')} />
        <Chip label="EXP" value={camera.exposure_mode === 'auto' ? 'AUTO' : 'MAN'} active={expanded === 'exp'} onPress={() => toggle('exp')} />
        <Chip label="WB" value={camera.awb_mode.toUpperCase()} active={expanded === 'wb'} onPress={() => toggle('wb')} />
        <Chip label="EV" value={camera.ev_compensation >= 0 ? `+${camera.ev_compensation}` : String(camera.ev_compensation)} active={expanded === 'ev'} onPress={() => toggle('ev')} />
        {camera.exposure_mode === 'manual' && (
          <Chip label="SHTR" value={shutterLabel()} active={expanded === 'shtr'} onPress={() => toggle('shtr')} />
        )}
      </View>

      {/* Tier 1 inline strips */}
      {expanded === 'gain' && (
        <SliderStrip min={1.0} max={22.0} step={0.1} value={camera.analogue_gain} onValueChange={v => { onUpdate('analogue_gain', Math.round(v * 10) / 10); setExpanded(null); }} formatLabel={v => `${v.toFixed(1)}×`} />
      )}
      {expanded === 'exp' && (
        <DiscreteStrip
          options={[{ label: 'AUTO', value: 'auto' }, { label: 'MANUAL', value: 'manual' }]}
          selected={camera.exposure_mode}
          onSelect={v => { onUpdate('exposure_mode', v); setExpanded(null); }}
        />
      )}
      {expanded === 'wb' && (
        <DiscreteStrip
          options={AWB_MODES.map(m => ({ label: m.toUpperCase(), value: m }))}
          selected={camera.awb_mode}
          onSelect={v => { onUpdate('awb_mode', v); setExpanded(null); }}
        />
      )}
      {expanded === 'ev' && (
        <SliderStrip min={-4} max={4} step={0.5} value={camera.ev_compensation} onValueChange={v => { onUpdate('ev_compensation', v); setExpanded(null); }} formatLabel={v => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)} />
      )}
      {expanded === 'shtr' && (
        <DiscreteStrip
          options={SHUTTER_SPEEDS.map(s => ({ label: s.label, value: s.value }))}
          selected={camera.shutter_speed}
          onSelect={v => { onUpdate('shutter_speed', v); setExpanded(null); }}
        />
      )}

      {/* Manual WB: persistent R/B gain sliders + eyedropper */}
      {camera.awb_mode === 'manual' && (
        <View style={styles.wbGainsBox}>
          <View style={styles.wbHeaderRow}>
            <Text style={styles.wbHeaderLabel}>COLOUR GAINS</Text>
            {onEyedropper && (
              <TouchableOpacity
                style={[styles.pickBtn, tapMode === 'wb' && styles.pickBtnActive]}
                onPress={onEyedropper}
              >
                <Eyedropper size={14} color={tapMode === 'wb' ? colors.text : colors.textMuted} weight={tapMode === 'wb' ? 'fill' : 'regular'} />
                <Text style={[styles.pickLabel, tapMode === 'wb' && { color: colors.text }]}>PICK</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.wbGainRow}>
            <Text style={[styles.wbGainLabel, { color: '#ff8080' }]}>R</Text>
            <Text style={styles.wbGainValue}>{camera.red_gain.toFixed(2)}×</Text>
            <Slider
              style={styles.wbGainSlider}
              minimumValue={0.5}
              maximumValue={4.0}
              step={0.05}
              value={camera.red_gain}
              onSlidingComplete={v => onUpdate('red_gain', Math.round(v * 100) / 100)}
              minimumTrackTintColor="#ff8080"
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.text}
            />
          </View>
          <View style={styles.wbGainRow}>
            <Text style={[styles.wbGainLabel, { color: '#8080ff' }]}>B</Text>
            <Text style={styles.wbGainValue}>{camera.blue_gain.toFixed(2)}×</Text>
            <Slider
              style={styles.wbGainSlider}
              minimumValue={0.5}
              maximumValue={4.0}
              step={0.05}
              value={camera.blue_gain}
              onSlidingComplete={v => onUpdate('blue_gain', Math.round(v * 100) / 100)}
              minimumTrackTintColor="#8080ff"
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.text}
            />
          </View>
        </View>
      )}

      {/* Tier 2 toggle */}
      <TouchableOpacity style={styles.tier2Toggle} onPress={() => setTier2Open(!tier2Open)}>
        <Text style={styles.sectionHeader}>IMAGE</Text>
        <CaretDown size={10} color={colors.textDim} weight="bold" style={tier2Open ? { transform: [{ rotate: '180deg' }] } : undefined} />
      </TouchableOpacity>

      {tier2Open && (
        <>
          <View style={styles.chipRow}>
            <Chip label="SHRP" value={camera.sharpness.toFixed(1)} active={expanded === 'shrp'} onPress={() => toggle('shrp')} />
            <Chip label="CNTR" value={camera.contrast.toFixed(1)} active={expanded === 'cntr'} onPress={() => toggle('cntr')} />
            <Chip label="SAT" value={camera.saturation.toFixed(1)} active={expanded === 'sat'} onPress={() => toggle('sat')} />
            <Chip label="BRT" value={camera.brightness.toFixed(1)} active={expanded === 'brt'} onPress={() => toggle('brt')} />
          </View>
          <View style={styles.chipRow}>
            <Chip label="MTR" value={camera.metering_mode.toUpperCase()} active={expanded === 'mtr'} onPress={() => toggle('mtr')} />
            <Chip label="NR" value={camera.noise_reduction.toUpperCase().replace('_', ' ')} active={expanded === 'nr'} onPress={() => toggle('nr')} />
          </View>

          {expanded === 'shrp' && <SliderStrip min={0} max={16} step={0.5} value={camera.sharpness} onValueChange={v => { onUpdate('sharpness', v); setExpanded(null); }} />}
          {expanded === 'cntr' && <SliderStrip min={0} max={32} step={0.5} value={camera.contrast} onValueChange={v => { onUpdate('contrast', v); setExpanded(null); }} />}
          {expanded === 'sat' && <SliderStrip min={0} max={32} step={0.5} value={camera.saturation} onValueChange={v => { onUpdate('saturation', v); setExpanded(null); }} />}
          {expanded === 'brt' && <SliderStrip min={-1} max={1} step={0.1} value={camera.brightness} onValueChange={v => { onUpdate('brightness', v); setExpanded(null); }} />}
          {expanded === 'mtr' && (
            <DiscreteStrip options={METERING_MODES.map(m => ({ label: m.toUpperCase(), value: m }))} selected={camera.metering_mode} onSelect={v => { onUpdate('metering_mode', v); setExpanded(null); }} />
          )}
          {camera.metering_mode === 'spot' && onMeterPick && (
            <View style={styles.meterPickRow}>
              <Text style={styles.wbHeaderLabel}>SPOT POINT</Text>
              <TouchableOpacity
                style={[styles.pickBtn, tapMode === 'meter' && styles.pickBtnActive]}
                onPress={onMeterPick}
              >
                <Crosshair size={14} color={tapMode === 'meter' ? colors.text : colors.textMuted} weight={tapMode === 'meter' ? 'fill' : 'regular'} />
                <Text style={[styles.pickLabel, tapMode === 'meter' && { color: colors.text }]}>PICK</Text>
              </TouchableOpacity>
            </View>
          )}
          {expanded === 'nr' && (
            <DiscreteStrip options={NR_MODES.map(m => ({ label: m.toUpperCase().replace('_', ' '), value: m }))} selected={camera.noise_reduction} onSelect={v => { onUpdate('noise_reduction', v); setExpanded(null); }} />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionHeader: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 4,
  },
  chipExpanded: { borderColor: colors.textMuted },
  chipLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  chipValue: { fontSize: 11, color: colors.text },
  strip: { marginBottom: spacing.sm },
  stripContent: { gap: spacing.xs, paddingVertical: spacing.xs },
  stripItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  stripItemActive: { borderColor: colors.text, backgroundColor: colors.surfaceLight },
  stripText: { fontFamily: PIXEL_FONT, fontSize: 10, color: colors.textMuted },
  stripTextActive: { color: colors.text },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm },
  sliderValue: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.text, width: 40, textAlign: 'center' },
  slider: { flex: 1, height: 30 },
  tier2Toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, marginBottom: spacing.xs },
  wbGainsBox: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    marginBottom: spacing.xs,
    gap: 4,
  },
  wbHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  wbHeaderLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2 },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  pickBtnActive: { borderColor: colors.text, backgroundColor: colors.surfaceLight },
  pickLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  meterPickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  wbGainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wbGainLabel: { fontFamily: PIXEL_FONT, fontSize: 11, fontWeight: 'bold', width: 14 },
  wbGainValue: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.text, width: 40, textAlign: 'center' },
  wbGainSlider: { flex: 1, height: 30 },
});
