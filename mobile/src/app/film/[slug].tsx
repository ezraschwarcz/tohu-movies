import { useEvent, useEventListener } from 'expo';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import FilmRail from '@/components/FilmRail';
import { Loading, Message } from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { filmUrl, formatRuntime, genresOf, getFilms, stillUrl, streamUrl, type Film } from '@/lib/films';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

type FilmComment = {
  id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string } | { display_name: string }[] | null;
};

export default function FilmScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [films, setFilms] = useState<Film[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFilms()
      .then(setFilms)
      .catch((e: Error) => setError(e.message));
  }, []);

  const film = useMemo(() => films?.find((f) => f.slug === slug) ?? null, [films, slug]);

  if (error && !films) return <Message title="Could not load this film" body={error} />;
  if (!films) return <Loading />;
  if (!film) return <Message title="This film is not available" body="It may have been removed." />;
  return <FilmDetails key={film.slug} film={film} films={films} />;
}

function FilmDetails({ film, films }: { film: Film; films: Film[] }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const player = useVideoPlayer(
    {
      uri: streamUrl(film),
      contentType: 'hls',
      metadata: { title: film.title, artist: 'Tohu Movies', artwork: stillUrl(film, 800) },
    },
    (p) => {
      p.timeUpdateEventInterval = 5;
      p.staysActiveInBackground = true;
      p.showNowPlayingNotification = true;
    },
  );
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Resume where a signed-in member stopped.
  const resumeAt = useRef<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase
      .from('continue_watching')
      .select('position_seconds,duration_seconds')
      .eq('user_id', userId)
      .eq('film_slug', film.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as { position_seconds: number; duration_seconds: number };
        if (row.position_seconds >= 60 && row.position_seconds / Math.max(1, row.duration_seconds) < 0.95) {
          resumeAt.current = row.position_seconds;
          if (player.status === 'readyToPlay') {
            player.currentTime = row.position_seconds;
            resumeAt.current = null;
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, film.slug, player]);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && resumeAt.current !== null) {
      player.currentTime = resumeAt.current;
      resumeAt.current = null;
    }
  });

  // Count one view after about 30 seconds of play, and save progress
  // every 15 seconds for signed-in members.
  const watched = useRef(0);
  const counted = useRef(false);
  const lastSaved = useRef(0);
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!player.playing) return;
    watched.current += 5;
    if (!counted.current && watched.current >= 30) {
      counted.current = true;
      void supabase.rpc('record_film_view', { p_slug: film.slug }).then(
        () => {},
        () => {},
      );
    }
    if (userId && player.duration > 0 && Math.abs(currentTime - lastSaved.current) >= 15) {
      lastSaved.current = currentTime;
      void supabase
        .from('continue_watching')
        .upsert(
          {
            user_id: userId,
            film_slug: film.slug,
            position_seconds: Math.floor(currentTime),
            duration_seconds: Math.floor(player.duration),
          },
          { onConflict: 'user_id,film_slug' },
        )
        .then(
          () => {},
          () => {},
        );
    }
  });

  // Watchlist.
  const [saved, setSaved] = useState(false);
  const [savingList, setSavingList] = useState(false);
  useEffect(() => {
    if (!userId) {
      setSaved(false);
      return;
    }
    let cancelled = false;
    void supabase
      .from('watchlist')
      .select('film_slug')
      .eq('user_id', userId)
      .eq('film_slug', film.slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSaved(data !== null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, film.slug]);

  async function toggleSaved() {
    if (!userId) {
      router.push('/sign-in');
      return;
    }
    setSavingList(true);
    if (saved) {
      const { error } = await supabase.from('watchlist').delete().eq('user_id', userId).eq('film_slug', film.slug);
      if (!error) setSaved(false);
    } else {
      const { error } = await supabase.from('watchlist').insert({ user_id: userId, film_slug: film.slug });
      if (!error) setSaved(true);
    }
    setSavingList(false);
  }

  // Comments: approved ones are public; a new one waits for review.
  const [comments, setComments] = useState<FilmComment[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentNote, setCommentNote] = useState<string | null>(null);
  const loadComments = useCallback(async () => {
    const { data } = await supabase
      .from('comments')
      .select('id,body,created_at,profiles(display_name)')
      .eq('film_slug', film.slug)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50);
    setComments((data ?? []) as unknown as FilmComment[]);
  }, [film.slug]);
  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function post() {
    const text = draft.trim();
    if (!text || !userId) return;
    setPosting(true);
    setCommentNote(null);
    const { error } = await supabase.from('comments').insert({ film_slug: film.slug, body: text, user_id: userId });
    setPosting(false);
    if (error) {
      setCommentNote(
        /row-level security/i.test(error.message)
          ? 'Your account cannot post comments right now.'
          : 'Could not post your comment. Try again.',
      );
      return;
    }
    setDraft('');
    setCommentNote('Thanks. Your comment will appear once it has been reviewed.');
  }

  const related = useMemo(() => {
    const mine = new Set(genresOf(film));
    return films
      .filter((f) => f.slug !== film.slug)
      .map((f) => ({ f, score: genresOf(f).filter((g) => mine.has(g)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.f);
  }, [film, films]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: film.title }} />
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture
        fullscreenOptions={{ enable: true }}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{film.title}</Text>
        <Text style={styles.meta}>
          {film.year} · {formatRuntime(film.runtime_minutes)} · {film.rating} · {genresOf(film).join(', ')}
        </Text>
        <View style={styles.actions}>
          <Button
            label={isPlaying ? 'Pause' : '▶  Play'}
            onPress={() => (isPlaying ? player.pause() : player.play())}
            style={{ flex: 1 }}
          />
          <Button
            kind="ghost"
            label={saved ? '✓ In watchlist' : '+ Watchlist'}
            onPress={() => void toggleSaved()}
            busy={savingList}
            style={{ flex: 1 }}
          />
        </View>
        <Button
          kind="ghost"
          label="Share"
          onPress={() => void Share.share({ message: `Watch ${film.title} free on Tohu Movies: ${filmUrl(film)}` })}
        />
        <Text style={styles.synopsis}>{film.synopsis}</Text>
        {film.warnings ? <Text style={styles.small}>Content: {film.warnings}</Text> : null}
        {film.director ? <Text style={styles.small}>Director: {film.director}</Text> : null}
        {film.cast_text ? <Text style={styles.small}>Cast: {film.cast_text}</Text> : null}
      </View>

      <FilmRail title="More like this" films={related} />

      <View style={styles.body}>
        <Text style={styles.h2}>Comments</Text>
        {userId ? (
          <>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="What did you think?"
              placeholderTextColor={colors.ink2}
              multiline
              maxLength={2000}
            />
            <Button label="Post comment" onPress={() => void post()} busy={posting} disabled={!draft.trim()} />
          </>
        ) : (
          <Button kind="ghost" label="Sign in to comment" onPress={() => router.push('/sign-in')} />
        )}
        {commentNote ? <Text style={styles.small}>{commentNote}</Text> : null}
        {comments.length === 0 ? (
          <Text style={styles.small}>No comments yet. Be the first.</Text>
        ) : (
          comments.map((c) => {
            const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.commentName}>
                  {p?.display_name ?? 'A viewer'}
                  <Text style={styles.small}>
                    {'  '}
                    {new Date(c.created_at).toLocaleDateString()}
                  </Text>
                </Text>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  body: { padding: space.lg, gap: space.md },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', textTransform: 'uppercase', lineHeight: 31 },
  meta: { color: colors.ink2, fontSize: 14 },
  actions: { flexDirection: 'row', gap: space.md },
  synopsis: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  small: { color: colors.ink2, fontSize: 14, lineHeight: 20 },
  h2: { color: colors.ink, fontSize: 18, fontWeight: '800', textTransform: 'uppercase' },
  input: {
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.ink,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  comment: { paddingVertical: space.md, borderTopWidth: 1, borderTopColor: colors.line, gap: 4 },
  commentName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  commentBody: { color: colors.ink, fontSize: 15, lineHeight: 22 },
});
