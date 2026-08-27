import React, { useMemo } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';

import { pressureColor } from '@/pressure/ramp';
import { REGIONS, SIDES, SENSOR_COUNT } from '@/pressure/types';

const styles = StyleSheet.create({
 container: {
 width: '100%',
 aspectRatio: 3,
 },
 row: {
 flexDirection: 'row',
 flex: 1,
 },
 cell: {
 flex: 1,
 margin: 1,
 borderRadius: 3,
 justifyContent: 'center',
 alignItems: 'center',
 position: 'relative',
 },
 cellInner: {
 alignItems: 'center',
 justifyContent: 'center',
 },
 label: {
 fontFamily: 'DM Mono_500Medium',
 fontSize: 9,
 color: '#FFFFFF',
 textShadowColor: 'rgba(0,0,0,0.6)',
 textShadowOffset: { width: 0, height: 1 },
 textShadowRadius: 2,
 },
 hotRing: {
 position: 'absolute',
 top: -1, left: -1, right: -1, bottom: -1,
 borderRadius: 4,
 borderWidth: 2,
 borderColor: '#FFFFFF',
 pointerEvents: 'none',
 },
});

export interface PressureGridProps {
 frame: number[];
 maxKpa: number;
 hotIndex: number;
 rows?: number;
 cols?: number;
}

export function PressureGrid({ frame, maxKpa, hotIndex, rows = 3, cols = 6 }: PressureGridProps) {

 const grid = useMemo(() => {
 const result: React.ReactNode[][] = [];
 for (let r = 0; r < rows; r++) {
 const rowNodes: React.ReactNode[] = [];
 for (let c = 0; c < cols; c++) {
 const idx = r * cols + c;
 const kpa = frame[idx] ?? 0;
 const isHot = idx === hotIndex;
 const bg = pressureColor(kpa, maxKpa);

 rowNodes.push(
 <View key={c} style={[styles.cell, { backgroundColor: bg }]}>
 {isHot && <View style={styles.hotRing} />}
 <View style={styles.cellInner}>
 <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
 <Text style={{ fontFamily: 'DM Mono_500Medium', fontSize: 11, color: '#FFFFFF', fontWeight: '500' }}>
 {kpa.toFixed(0)}
 </Text>
 <Text style={{ fontFamily: 'DM Mono_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.6)', marginLeft: 1 }}>
 kPa
 </Text>
 </View>
 </View>
 </View>
 );
 }
 result.push(rowNodes);
 }
 return result;
 }, [frame, maxKpa, hotIndex, rows, cols]);

 return (
 <View style={[styles.container, { aspectRatio: (cols / rows) * 1.5 }]}>
 {grid.map((row, r) => (
 <View key={r} style={styles.row}>
 {row}
 </View>
 ))}
 </View>
 );
}
