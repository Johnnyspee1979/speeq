/**
 * ProgressChart — SVG voortgangsvisuals voor het WKB project dashboard.
 *
 * Bevat:
 *  1. DonutChart   — cirkeldiagram voor overall status (passed/review/failed/pending)
 *  2. BarChart     — horizontale balkenchrt per discipline/categorie
 *  3. TrendLine    — uploads per dag (laatste 7 dagen)
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

type Theme = {
  colors: {
    background: string;
    surface: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
  };
};

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
  centerSub: string;
  theme: Theme;
  size?: number;
}

export function DonutChart({ segments, total, centerLabel, centerSub, theme, size = 160 }: DonutChartProps) {
  const r     = size * 0.38;
  const cx    = size / 2;
  const cy    = size / 2;
  const circumference = 2 * Math.PI * r;

  const paths = useMemo(() => {
    if (total === 0) return [];
    let offset = -0.25 * circumference; // start at top
    return segments.map(seg => {
      const frac = seg.value / total;
      const dash = frac * circumference;
      const path = {
        ...seg,
        dash,
        offset,
        frac,
      };
      offset += dash;
      return path;
    });
  }, [segments, total, circumference]);

  if (Platform.OS !== 'web') {
    // Fallback for native: simple percentage bars
    return (
      <View style={[styles.donutFallback, { backgroundColor: theme.colors.surface }]}>
        {segments.map(seg => (
          <View key={seg.label} style={styles.donutFallbackRow}>
            <View style={[styles.donutFallbackDot, { backgroundColor: seg.color }]} />
            <Text style={[styles.donutFallbackLabel, { color: theme.colors.textSecondary }]}>{seg.label}</Text>
            <Text style={[styles.donutFallbackValue, { color: theme.colors.textPrimary }]}>{seg.value}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    // @ts-ignore web SVG
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* @ts-ignore */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background circle */}
        {/* @ts-ignore */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.colors.border} strokeWidth={size * 0.12} />
        {paths.map((p, i) => (
          // @ts-ignore
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={p.color}
            strokeWidth={size * 0.12}
            strokeDasharray={`${p.dash} ${circumference - p.dash}`}
            strokeDashoffset={-p.offset}
            style={{ transition: 'all 0.6s ease' }}
          />
        ))}
      </svg>
      {/* Center text */}
      {/* @ts-ignore */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: size, height: size,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* @ts-ignore */}
        <span style={{ fontSize: size * 0.18, fontWeight: 800, color: theme.colors.textPrimary, lineHeight: 1.1 }}>
          {centerLabel}
        </span>
        {/* @ts-ignore */}
        <span style={{ fontSize: size * 0.09, color: theme.colors.textSecondary, marginTop: 2 }}>
          {centerSub}
        </span>
      </div>
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

interface BarChartItem {
  label: string;
  passed: number;
  total: number;
  color?: string;
}

interface BarChartProps {
  items: BarChartItem[];
  theme: Theme;
}

export function BarChart({ items, theme }: BarChartProps) {
  if (items.length === 0) return null;
  const maxTotal = Math.max(...items.map(i => i.total), 1);

  return (
    <View style={styles.barChart}>
      {items.map(item => {
        const pct = item.total > 0 ? (item.passed / item.total) * 100 : 0;
        const barWidth = (item.total / maxTotal) * 100;
        return (
          <View key={item.label} style={styles.barRow}>
            <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {item.label}
            </Text>
            <View style={[styles.barTrack, { backgroundColor: theme.colors.border }]}>
              {/* Total bar */}
              <View style={[styles.barFill, {
                width: `${barWidth}%` as any,
                backgroundColor: theme.colors.accent + '30',
              }]} />
              {/* Passed portion */}
              {item.passed > 0 && (
                <View style={[styles.barFill, {
                  position: 'absolute',
                  left: 0,
                  width: `${(item.passed / item.total) * barWidth}%` as any,
                  backgroundColor: '#059669',
                }]} />
              )}
            </View>
            <Text style={[styles.barValue, { color: theme.colors.textPrimary }]}>
              {item.passed}/{item.total}
            </Text>
            <Text style={[styles.barPct, { color: pct >= 80 ? '#059669' : pct >= 40 ? '#d97706' : theme.colors.textSecondary }]}>
              {Math.round(pct)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Trend Line (uploads per dag) ─────────────────────────────────────────────

interface TrendDay {
  day: string;   // kort label bijv. 'ma', 'di'
  count: number;
}

interface TrendLineProps {
  days: TrendDay[];
  theme: Theme;
  height?: number;
}

export function TrendLine({ days, theme, height = 60 }: TrendLineProps) {
  const maxCount = Math.max(...days.map(d => d.count), 1);
  const w = 300;
  const h = height;
  const padX = 10;
  const padY = 6;
  const stepX = days.length > 1 ? (w - padX * 2) / (days.length - 1) : w;

  const points = days.map((d, i) => ({
    x: padX + i * stepX,
    y: h - padY - ((d.count / maxCount) * (h - padY * 2)),
    ...d,
  }));

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  if (Platform.OS !== 'web' || days.length === 0) return null;

  return (
    // @ts-ignore
    <div style={{ width: '100%' }}>
      {/* @ts-ignore */}
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Grid line */}
        {/* @ts-ignore */}
        <line x1={0} y1={h - padY} x2={w} y2={h - padY} stroke={theme.colors.border} strokeWidth="1" />
        {/* Area fill */}
        {/* @ts-ignore */}
        <polygon
          points={`${points[0]?.x ?? 0},${h - padY} ${polyline} ${points[points.length-1]?.x ?? w},${h - padY}`}
          fill={theme.colors.accent + '18'}
        />
        {/* Line */}
        {/* @ts-ignore */}
        <polyline points={polyline} fill="none" stroke={theme.colors.accent} strokeWidth="2" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          // @ts-ignore
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={theme.colors.accent} />
        ))}
      </svg>
      {/* Day labels */}
      {/* @ts-ignore */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -2 }}>
        {days.map((d, i) => (
          // @ts-ignore
          <span key={i} style={{ fontSize: 9, color: theme.colors.textSecondary, minWidth: 20, textAlign: 'center' }}>
            {d.day}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Samengesteld dashboard blok ──────────────────────────────────────────────

interface ProjectProgressBlockProps {
  total: number;
  passed: number;
  review: number;
  failed: number;
  pending: number;
  vandaag: number;
  categoryStats: BarChartItem[];
  trendDays: TrendDay[];
  theme: Theme;
}

export function ProjectProgressBlock({
  total, passed, review, failed, pending, vandaag,
  categoryStats, trendDays, theme,
}: ProjectProgressBlockProps) {
  const pctDone = total > 0 ? Math.round((passed / total) * 100) : 0;

  const segments: DonutSegment[] = [
    { value: passed,  color: '#059669', label: 'Akkoord'   },
    { value: review,  color: '#d97706', label: 'Review'    },
    { value: failed,  color: '#ef4444', label: 'Afgekeurd' },
    { value: pending, color: '#9ca3af', label: 'Pending'   },
  ];

  return (
    <View style={[styles.block, {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    }]}>
      <Text style={[styles.blockTitle, { color: theme.colors.textPrimary }]}>
        📊 Projectvoortgang
      </Text>

      <View style={styles.blockRow}>
        {/* Donut */}
        <View style={styles.donutWrap}>
          <DonutChart
            segments={segments}
            total={total}
            centerLabel={`${pctDone}%`}
            centerSub="akkoord"
            theme={theme}
            size={140}
          />
        </View>

        {/* Legenda */}
        <View style={styles.legend}>
          {segments.map(s => (
            <View key={s.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={[styles.legendLabel, { color: theme.colors.textSecondary }]}>{s.label}</Text>
              <Text style={[styles.legendValue, { color: theme.colors.textPrimary }]}>{s.value}</Text>
            </View>
          ))}
          <View style={[styles.legendRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 6 }]}>
            <Text style={[styles.legendLabel, { color: theme.colors.accent, fontWeight: '700' }]}>
              Vandaag: +{vandaag}
            </Text>
          </View>
        </View>
      </View>

      {/* Bar chart per categorie */}
      {categoryStats.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            PER DISCIPLINE
          </Text>
          <BarChart items={categoryStats} theme={theme} />
        </>
      )}

      {/* Trend */}
      {trendDays.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            UPLOADS AFGELOPEN 7 DAGEN
          </Text>
          <TrendLine days={trendDays} theme={theme} />
        </>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  block: {
    borderWidth: 1.5, borderRadius: 14, padding: 16, gap: 12,
  },
  blockTitle: {
    fontSize: 14, fontWeight: '800', marginBottom: 4,
  },
  blockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
  },
  donutWrap: {
    alignItems: 'center',
  },
  legend: {
    flex: 1, gap: 6,
  },
  legendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  legendDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12, flex: 1,
  },
  legendValue: {
    fontSize: 13, fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4,
  },
  barChart: { gap: 8 },
  barRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  barLabel: {
    fontSize: 11, width: 80,
  },
  barTrack: {
    flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative',
  },
  barFill: {
    height: 8, borderRadius: 4,
  },
  barValue: {
    fontSize: 10, width: 32, textAlign: 'right',
  },
  barPct: {
    fontSize: 10, fontWeight: '700', width: 30, textAlign: 'right',
  },
  // Fallback
  donutFallback: {
    borderRadius: 10, padding: 10, gap: 6,
  },
  donutFallbackRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  donutFallbackDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  donutFallbackLabel: { fontSize: 11, flex: 1 },
  donutFallbackValue: { fontSize: 12, fontWeight: '700' },
});
