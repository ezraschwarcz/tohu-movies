import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';

import Button from '@/components/Button';
import Poster from '@/components/Poster';
import { Loading, Message } from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { getFilms, type Film } from '@/lib/films';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function WatchlistScreen() {
  const { user, loading } = useAuth();
  const [films, setFilms] = useState<Film[] | null>(null);
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 5 : 3;
  const cardWidth = (width - space.lg * 2 - space.md * (columns - 1)) / columns;

  // Reload whenever the tab is opened, so a film saved a moment ago shows.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!user) {
        setFilms(null);
        return;
      }
      void (async () => {
        const [all, saved] = await Promise.all([
          getFilms().catch(() => [] as Film[]),
          supabase.from('watchlist').select('film_slug').eq('user_id', user.id),
        ]);
        if (cancelled) return;
        const slugs = new Set(((saved.data ?? []) as { film_slug: string }[]).map((r) => r.film_slug));
        setFilms(all.filter((f) => slugs.has(f.slug)));
      })();
      return () => {
        cancelled = true;
      };
    }, [user]),
  );

  if (loading) return <Loading />;
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: space.xl }}>
        <Message title="Your watchlist" body="Sign in to save films and find them here on any device." />
        <Button label="Sign in or join free" onPress={() => router.push('/sign-in')} />
      </View>
    );
  }
  if (!films) return <Loading />;

  return (
    <FlatList
      key={columns}
      style={{ backgroundColor: colors.bg }}
      data={films}
      numColumns={columns}
      keyExtractor={(f) => f.slug}
      renderItem={({ item }) => <Poster film={item} width={cardWidth} />}
      columnWrapperStyle={{ gap: space.md }}
      contentContainerStyle={{ padding: space.lg, gap: space.lg, flexGrow: 1 }}
      ListEmptyComponent={<Message title="Nothing saved yet" body="Open a film and tap Add to watchlist." />}
    />
  );
}
