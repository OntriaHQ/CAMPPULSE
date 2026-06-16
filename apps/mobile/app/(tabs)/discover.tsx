import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, GradientColors, Radius } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';

type Category = 'all' | 'service' | 'conference' | 'youth' | 'special';

interface CampEvent {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  time: string;
  area: string;
  category: Category;
  status: 'upcoming' | 'ongoing' | 'past';
  attendance: string;
  featured?: boolean;
}

const EVENTS: CampEvent[] = [
  {
    id: '1',
    title: 'Holy Ghost Service',
    subtitle: 'Monthly all-night service with Pastor E.A. Adeboye',
    date: 'Fri, 27 Jun 2025',
    time: '7:00 PM — All night',
    area: 'Main Auditorium',
    category: 'service',
    status: 'upcoming',
    attendance: '500,000+',
    featured: true,
  },
  {
    id: '2',
    title: 'Workers In Training (WIT)',
    subtitle: 'Monthly training for RCCG workers and ministers',
    date: 'Sat, 21 Jun 2025',
    time: '9:00 AM — 4:00 PM',
    area: 'Festival Arena',
    category: 'conference',
    status: 'upcoming',
    attendance: '50,000+',
  },
  {
    id: '3',
    title: 'Youth Sunday',
    subtitle: 'Redemption City youth fellowship and praise session',
    date: 'Sun, 22 Jun 2025',
    time: '8:00 AM — 12:00 PM',
    area: 'Auditorium Annex',
    category: 'youth',
    status: 'upcoming',
    attendance: '20,000+',
  },
  {
    id: '4',
    title: 'Pastors & Workers Convention',
    subtitle: 'Annual ministers gathering and leadership summit',
    date: 'Mon 7 — Fri 11 Jul 2025',
    time: 'All day',
    area: 'Main Auditorium · Festival Arena',
    category: 'conference',
    status: 'upcoming',
    attendance: '1,000,000+',
  },
  {
    id: '5',
    title: 'Special Thanksgiving Service',
    subtitle: 'Praise and thanksgiving to God for the new year of blessings',
    date: 'Sun, 15 Jun 2025',
    time: '8:00 AM — 1:00 PM',
    area: 'Main Auditorium',
    category: 'special',
    status: 'past',
    attendance: '200,000+',
  },
  {
    id: '6',
    title: 'RCCG Youth Congress',
    subtitle: 'Annual congress for the youth arm of the RCCG',
    date: 'Fri 1 — Sun 3 Aug 2025',
    time: 'Multi-day',
    area: 'Festival Arena',
    category: 'youth',
    status: 'upcoming',
    attendance: '300,000+',
  },
];

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all',        label: 'All'         },
  { key: 'service',    label: 'Services'    },
  { key: 'conference', label: 'Conferences' },
  { key: 'youth',      label: 'Youth'       },
  { key: 'special',    label: 'Special'     },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const [category, setCategory] = useState<Category>('all');
  const styles = useStyles(C);

  const STATUS_COLOR: Record<string, string> = {
    upcoming: C.accent,
    ongoing:  C.severity.high,
    past:     C.textMuted,
  };

  const featured = EVENTS.find(e => e.featured);
  const filtered = EVENTS.filter(e => {
    if (e.featured) return false;
    if (category !== 'all' && e.category !== category) return false;
    return true;
  });

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.sub}>Redemption City · RCCG</Text>
        </View>

        {featured && (
          <LinearGradient
            colors={['rgba(0,200,150,0.18)', 'rgba(14,165,233,0.12)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featured}
          >
            <View style={styles.featuredBorder} />
            <View style={styles.featuredTag}>
              <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.featuredTagGrad}>
                <Text style={styles.featuredTagText}>Featured</Text>
              </LinearGradient>
              <View style={[styles.statusPill, { borderColor: STATUS_COLOR[featured.status] + '50', backgroundColor: STATUS_COLOR[featured.status] + '18' }]}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[featured.status] }]} />
                <Text style={[styles.statusText, { color: STATUS_COLOR[featured.status] }]}>{featured.status.charAt(0).toUpperCase() + featured.status.slice(1)}</Text>
              </View>
            </View>
            <Text style={styles.featuredTitle}>{featured.title}</Text>
            <Text style={styles.featuredSub}>{featured.subtitle}</Text>
            <View style={styles.featuredMeta}>
              <MetaChip icon="cal"   text={featured.date}       accentColor={C.accent} subColor={C.textSecondary} />
              <MetaChip icon="clock" text={featured.time}       accentColor={C.accent} subColor={C.textSecondary} />
            </View>
            <View style={[styles.featuredMeta, { marginTop: 6 }]}>
              <MetaChip icon="loc" text={featured.area}         accentColor={C.accent} subColor={C.textSecondary} />
              <MetaChip icon="ppl" text={featured.attendance}   accentColor={C.accent} subColor={C.textSecondary} />
            </View>
          </LinearGradient>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterWrap}>
          {CATEGORIES.map(c => {
            const active = category === c.key;
            return active ? (
              <LinearGradient key={c.key} colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.filterActive}>
                <TouchableOpacity onPress={() => setCategory(c.key)}>
                  <Text style={styles.filterLabelActive}>{c.label}</Text>
                </TouchableOpacity>
              </LinearGradient>
            ) : (
              <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} style={[styles.filterInactive, { backgroundColor: C.surface, borderColor: C.border }]} activeOpacity={0.75}>
                <Text style={[styles.filterLabel, { color: C.textMuted }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.list}>
          {filtered.map(event => (
            <TouchableOpacity key={event.id} activeOpacity={0.85} style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              <View style={[styles.cardAccent, { backgroundColor: STATUS_COLOR[event.status] }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{event.title}</Text>
                    <Text style={[styles.cardSub, { color: C.textMuted }]} numberOfLines={1}>{event.subtitle}</Text>
                  </View>
                  <View style={[styles.statusPill, { borderColor: STATUS_COLOR[event.status] + '50', backgroundColor: STATUS_COLOR[event.status] + '18' }]}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[event.status] }]} />
                    <Text style={[styles.statusText, { color: STATUS_COLOR[event.status] }]}>{event.status.charAt(0).toUpperCase() + event.status.slice(1)}</Text>
                  </View>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={[styles.cardMetaText, { color: C.textSecondary }]}>{event.date}</Text>
                  <Text style={[styles.cardMetaDot, { color: C.textMuted }]}>·</Text>
                  <Text style={[styles.cardMetaText, { color: C.textSecondary }]}>{event.area}</Text>
                </View>
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardTime, { color: C.textMuted }]}>{event.time}</Text>
                  <View style={[styles.attendancePill, { backgroundColor: C.accent + '18', borderColor: C.accent + '35' }]}>
                    <Text style={[styles.attendanceText, { color: C.accent }]}>{event.attendance} expected</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function MetaChip({ icon, text, accentColor, subColor }: { icon: string; text: string; accentColor: string; subColor: string }) {
  const icons: Record<string, string> = { cal: '◷', clock: '◈', loc: '◎', ppl: '◉' };
  return (
    <View style={metaStyles.chip}>
      <Text style={[metaStyles.icon, { color: accentColor }]}>{icons[icon]}</Text>
      <Text style={[metaStyles.text, { color: subColor }]}>{text}</Text>
    </View>
  );
}

const metaStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(128,128,128,0.10)', borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  icon: { fontSize: 11 },
  text: { fontFamily: Fonts.medium, fontSize: 11 },
});

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    root:   { flex: 1, backgroundColor: C.background },
    scroll: { paddingHorizontal: 20 },
    header: { marginBottom: 20 },
    title:  { fontFamily: Fonts.bold, fontSize: 28, color: C.textPrimary },
    sub:    { fontFamily: Fonts.regular, fontSize: 13, color: C.textMuted, marginTop: 3 },
    featured:       { borderRadius: Radius.xxl, padding: 20, marginBottom: 20, gap: 8, overflow: 'hidden' },
    featuredBorder: { ...StyleSheet.absoluteFillObject, borderRadius: Radius.xxl, borderWidth: 1, borderColor: 'rgba(0,200,150,0.25)' },
    featuredTag:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    featuredTagGrad:{ borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
    featuredTagText:{ fontFamily: Fonts.semiBold, fontSize: 10, color: '#fff', letterSpacing: 0.3 },
    featuredTitle:  { fontFamily: Fonts.bold, fontSize: 20, color: C.textPrimary, lineHeight: 26 },
    featuredSub:    { fontFamily: Fonts.regular, fontSize: 13, color: C.textSecondary, lineHeight: 19 },
    featuredMeta:   { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
    statusDot:  { width: 5, height: 5, borderRadius: 3 },
    statusText: { fontFamily: Fonts.semiBold, fontSize: 10 },
    filterWrap:     { marginBottom: 16 },
    filters:        { gap: 8, paddingVertical: 2 },
    filterActive:   { borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
    filterInactive: { borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
    filterLabel:       { fontFamily: Fonts.medium, fontSize: 12 },
    filterLabelActive: { fontFamily: Fonts.semiBold, fontSize: 12, color: '#fff' },
    list:       { gap: 12 },
    card:       { flexDirection: 'row', borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
    cardAccent: { width: 4 },
    cardBody:   { flex: 1, padding: 14, gap: 8 },
    cardTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    cardTitle:  { fontFamily: Fonts.semiBold, fontSize: 15 },
    cardSub:    { fontFamily: Fonts.regular, fontSize: 12 },
    cardMeta:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardMetaText: { fontFamily: Fonts.regular, fontSize: 12 },
    cardMetaDot:  { fontSize: 12 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardTime:   { fontFamily: Fonts.medium, fontSize: 12 },
    attendancePill: { borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
    attendanceText: { fontFamily: Fonts.medium, fontSize: 11 },
  }), [C]);
}
