import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, GradientColors, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';

type StatusKey = 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
type FilterKey = 'all' | 'active' | 'resolved';

const MOCK = [
  { id: '1', type: 'Flooding',         zone: 'Camp Road',      block: 'Near Medical Centre', severity: 'critical', status: 'in_progress' as StatusKey, upvotes: 7, ago: '2h ago'    },
  { id: '2', type: 'Crowd Congestion', zone: 'North Gate',     block: 'Expressway Entrance', severity: 'high',     status: 'assigned'    as StatusKey, upvotes: 4, ago: '5h ago'    },
  { id: '3', type: 'Streetlight Out',  zone: 'Festival Arena', block: 'East Pathway',        severity: 'medium',   status: 'submitted'   as StatusKey, upvotes: 2, ago: 'Yesterday' },
  { id: '4', type: 'Water Supply',     zone: 'Canaan Land',    block: 'Block C Estate',      severity: 'low',      status: 'resolved'    as StatusKey, upvotes: 1, ago: '3d ago'    },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'active',   label: 'Active'   },
  { key: 'resolved', label: 'Resolved' },
];

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const [filter, setFilter]        = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);
  const styles = useStyles(C);

  const STATUS = useMemo(() => ({
    submitted:   { label: 'Submitted',   color: C.textMuted,         progress: 0.2  },
    assigned:    { label: 'Assigned',    color: C.accentEnd,         progress: 0.4  },
    in_progress: { label: 'In Progress', color: C.severity.high,     progress: 0.65 },
    resolved:    { label: 'Resolved',    color: C.severity.low,      progress: 1.0  },
    closed:      { label: 'Closed',      color: C.textMuted,         progress: 1.0  },
  }), [C]);

  const SEV_COLOR: Record<string, string> = {
    critical: C.severity.critical,
    high:     C.severity.high,
    medium:   C.severity.medium,
    low:      C.severity.low,
  };

  const filtered = MOCK.filter(r => {
    if (filter === 'active')   return !['resolved', 'closed'].includes(r.status);
    if (filter === 'resolved') return  ['resolved', 'closed'].includes(r.status);
    return true;
  });

  async function onRefresh() {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 900));
    setRefreshing(false);
  }

  const activeCount   = MOCK.filter(r => !['resolved', 'closed'].includes(r.status)).length;
  const resolvedCount = MOCK.filter(r =>  ['resolved', 'closed'].includes(r.status)).length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>My Reports</Text>
          <View style={styles.headerMeta}>
            <View style={styles.metaChip}>
              <View style={[styles.metaDot, { backgroundColor: C.severity.high }]} />
              <Text style={[styles.metaText, { color: C.textSecondary }]}>{activeCount} active</Text>
            </View>
            <View style={styles.metaChip}>
              <View style={[styles.metaDot, { backgroundColor: C.severity.low }]} />
              <Text style={[styles.metaText, { color: C.textSecondary }]}>{resolvedCount} resolved</Text>
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return active ? (
              <LinearGradient key={f.key} colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterGradient}>
                <TouchableOpacity onPress={() => setFilter(f.key)} activeOpacity={0.9}>
                  <Text style={styles.filterTextActive}>{f.label}</Text>
                </TouchableOpacity>
              </LinearGradient>
            ) : (
              <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterPill, { borderColor: C.border }]} activeOpacity={0.7}>
                <Text style={[styles.filterText, { color: C.textMuted }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.list}>
          {filtered.map(r => {
            const s = STATUS[r.status];
            const sevColor = SEV_COLOR[r.severity];
            return (
              <TouchableOpacity key={r.id} activeOpacity={0.85}>
                <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <View style={[styles.stripe, { backgroundColor: sevColor }]} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardType, { color: C.textPrimary }]}>{r.type}</Text>
                        <Text style={[styles.cardLocation, { color: C.textMuted }]}>{r.block}  {r.zone}</Text>
                      </View>
                      <View style={styles.upvoteBox}>
                        <Text style={[styles.upvoteArrow, { color: C.textMuted }]}>▲</Text>
                        <Text style={[styles.upvoteNum, { color: C.textSecondary }]}>{r.upvotes}</Text>
                      </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: C.surface2 }]}>
                      <View style={[styles.progressFill, { width: `${s.progress * 100}%` as any, backgroundColor: s.color }]} />
                    </View>
                    <View style={styles.cardBottom}>
                      <View style={[styles.statusPill, { borderColor: s.color + '40', backgroundColor: s.color + '18' }]}>
                        <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                      </View>
                      <Text style={[styles.cardAgo, { color: C.textMuted }]}>{r.ago}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon, { color: C.textMuted }]}>◻</Text>
            <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>No reports here</Text>
            <Text style={[styles.emptySub, { color: C.textMuted }]}>Submitted reports will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.background },
    scroll: { paddingHorizontal: 20 },
    header: { marginBottom: 20 },
    title:  { fontFamily: Fonts.bold, fontSize: 28, color: C.textPrimary, marginBottom: 10 },
    headerMeta: { flexDirection: 'row', gap: 12 },
    metaChip:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaDot:    { width: 7, height: 7, borderRadius: 4 },
    metaText:   { fontFamily: Fonts.medium, fontSize: 13 },
    filterRow:      { flexDirection: 'row', gap: 8, marginBottom: 20 },
    filterGradient: { borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
    filterPill:     { borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8, borderWidth: 1 },
    filterText:       { fontFamily: Fonts.medium, fontSize: 13 },
    filterTextActive: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#fff' },
    list:   { gap: 12 },
    card:   { flexDirection: 'row', borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
    stripe:   { width: 4 },
    cardBody: { flex: 1, padding: 14, gap: 10 },
    cardTop:      { flexDirection: 'row', alignItems: 'flex-start' },
    cardType:     { fontFamily: Fonts.semiBold, fontSize: 15, marginBottom: 3 },
    cardLocation: { fontFamily: Fonts.regular, fontSize: 12 },
    upvoteBox:    { alignItems: 'center', gap: 1 },
    upvoteArrow:  { fontSize: 10 },
    upvoteNum:    { fontFamily: Fonts.semiBold, fontSize: 13 },
    progressTrack: { height: 3, borderRadius: 2 },
    progressFill:  { height: 3, borderRadius: 2 },
    cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusPill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
    statusText: { fontFamily: Fonts.semiBold, fontSize: 11 },
    cardAgo:    { fontFamily: Fonts.regular, fontSize: 11 },
    empty:      { alignItems: 'center', paddingTop: 80, gap: Spacing.sm },
    emptyIcon:  { fontSize: 40 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 17 },
    emptySub:   { fontFamily: Fonts.regular, fontSize: 13, textAlign: 'center' },
  }), [C]);
}
