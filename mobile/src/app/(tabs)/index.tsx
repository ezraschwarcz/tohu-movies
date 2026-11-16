import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import FilmRail from '@/components/FilmRail';
import { Loading, Message } from '@/components/Screen';
import { confirmAge } from '@/lib/ageGate';
import { useAuth } from '@/lib/auth';
import { formatRuntime, genresOf, getFilms, getViewCounts, stillUrl, type Film } from '@/lib/films';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const [films, setFilms] = useState<Film[] | null>(null);
  const [views, setViews] = useState<Record<string, number>>({});
  const [resume, setResume] = useState<Film[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [heroSeed] = useState(() => Math.random());

  const load = useCallback(
    async (force: boolean) => {
      try {
        const [list, counts] = await Promise.all([getFilms(force), getViewCounts()]);
        setFilms(list);
        setViews(counts);
        setError(null);
        if (user) {
          const { data } = await supabase
            .from('continue_watching')
            .select('film_slug,position_seconds,duration_seconds,updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(10);
          const rows = (data ?? []) as {
            film_slug: string;
            position_seconds: number;
            duration_seconds: number;
          }[];
          setResume(
            rows
              .filter(
                (r) =>
                  r.position_seconds >= 60 &&
                  r.duration_seconds > 0 &&
                  r.position_seconds / r.duration_seconds < 0.95,
              )
              .map((r) => list.find((f) => f.slug === r.film_slug))
              .filter((f): f is Film => Boolean(f)),
          );
        } else {
          setResume([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the films.');
      }
    },
    [user],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const hero = useMemo(
    () => (films && films.length ? films[Math.floor(heroSeed * films.length)] : null),
    [films, heroSeed],
  );

  const trending = useMemo(
    () =>
      (films ?? [])
        .filter((f) => views[f.slug])
        .sort((a, b) => (views[b.slug] ?? 0) - (views[a.slug] ?? 0))
        .slice(0, 10),
    [films, views],
  );

  const byGenre = useMemo(() => {
    const map = new Map<string, Film[]>();
    for (const f of films ?? []) {
      for (const g of genresOf(f)) {
        map.set(g, [...(map.get(g) ?? []), f]);
      }
    }
    return [...map.entries()]
      .filter(([, list]) => list.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 8);
  }, [films]);

  if (error && !films) return <Message title="Could not load the films" body={error} />;
  if (!films) return <Loading />;

  async function openHero() {
    if (hero && (await confirmAge(hero))) {
      router.push({ pathname: '/film/[slug]', params: { slug: hero.slug } });
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      refreshControl={
        <RefreshControl
          tintColor={colors.accent}
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(true);
            setRefreshing(false);
          }}
        />
      }>
      {hero ? (
        <Pressable onPress={() => void openHero()} accessibilityRole="button" accessibilityLabel={`Watch ${hero.title}`}>
          <View style={styles.hero}>
            <Image source={{ uri: stillUrl(hero) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            <View style={styles.heroShade} />
            <View style={styles.heroText}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {hero.title}
              </Text>
              <Text style={styles.heroMeta}>
                {hero.year} · {formatRuntime(hero.runtime_minutes)} · {hero.rating} · {genresOf(hero).slice(0, 2).join(', ')}
              </Text>
              <Button label="▶  Watch free" onPress={() => void openHero()} style={{ alignSelf: 'flex-start', marginTop: space.md }} />
            </View>
          </View>
        </Pressable>
      ) : null}

      <FilmRail title="Continue watching" films={resume} />
      <FilmRail title="Trending now" films={trending} />
      <FilmRail title="New on Tohu" films={films.slice(0, 12)} />
      {byGenre.map(([genre, list]) => (
        <FilmRail key={genre} title={genre} films={list} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 16 / 11, backgroundColor: colors.panel2, justifyContent: 'flex-end' },
  heroShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,11,9,0.45)' },
  heroText: { padding: space.lg },
  heroTitle: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'uppercase',
    lineHeight: 34,
  },
  heroMeta: { color: colors.ink, fontSize: 14, marginTop: space.sm },
});
