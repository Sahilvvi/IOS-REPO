import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

const SIZE = 140;
const RADIUS = 58;
const STROKE = 12;
const CENTER = SIZE / 2;

const LEVEL_COLORS: Record<string, string> = {
 comfortable: '#2EE89E',
 watch: '#F5C842',
 'ease-off': '#F54257',
};

interface FitRingProps {
 score: number;
 level: string;
 size?: number;
}

export function FitRing({ score, level, size = SIZE }: FitRingProps) {
 const animatedScore = useRef(score);
 const [displayScore, setDisplayScore] = useState(() => Math.round(animatedScore.current));

 useEffect(() => {
 let start = animatedScore.current;
 const end = score;
 const duration = 600;
 const startTime = Date.now();

 const tick = () => {
 const elapsed = Date.now() - startTime;
 const t = Math.min(1, elapsed / duration);
 const eased = 1 - Math.pow(1 - t, 3);
 const current = Math.round(start + (end - start) * eased);
 setDisplayScore(current);
 animatedScore.current = current;
 if (t < 1) requestAnimationFrame(tick);
 };

 requestAnimationFrame(tick);
 }, [score]);

 const circumference = 2 * Math.PI * RADIUS;
 const offset = circumference - (displayScore / 100) * circumference;
 const accent = LEVEL_COLORS[level] || '#00D4F5';
 const label = level === 'comfortable' ? 'COMFORTABLE' : level === 'watch' ? 'WATCH' : 'EASE OFF';
 const color = level === 'comfortable' ? '#2EE89E' : level === 'watch' ? '#F5C842' : '#F54257';

 return (
 <View style={[styles.container, { width: size, height: size }]}>
 <Svg width={size} height={size}>
 <G rotation="-90" origin={`${CENTER},${CENTER}`}>
 {/* Background ring */}
 <Circle
 cx={CENTER}
 cy={CENTER}
 r={RADIUS}
 stroke="#1A2238"
 strokeWidth={STROKE}
 fill="none"
 />
 {/* Foreground arc */}
 <Circle
 cx={CENTER}
 cy={CENTER}
 r={RADIUS}
 stroke={color}
 strokeWidth={STROKE}
 fill="none"
 strokeDasharray={circumference}
 strokeDashoffset={offset}
 strokeLinecap="round"
 />
 </G>
 {/* Score text */}
 <SvgText
 x={CENTER}
 y={CENTER - 6}
 fill="#E8EDF8"
 fontSize={32}
 fontWeight="700"
 fontFamily="Manrope_700Bold"
 textAnchor="middle"
 alignmentBaseline="middle"
 >
 {displayScore}
 </SvgText>
 {/* Label */}
 <SvgText
 x={CENTER}
 y={CENTER + 20}
 fill={color}
 fontSize={9}
 fontWeight="600"
 fontFamily="DM Mono_500Medium"
 textAnchor="middle"
 letterSpacing={1.5}
 >
 {label}
 </SvgText>
 </Svg>
 </View>
 );
}

const styles = StyleSheet.create({
 container: {
 justifyContent: 'center',
 alignItems: 'center',
 },
});

