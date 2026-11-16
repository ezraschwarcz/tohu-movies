import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { confirmAge } from '@/lib/ageGate';
import { posterCandidates, type Film } from '@/lib/films';
import { colors } from '@/lib/theme';

/** A film's cover art as a tappable card. Tries each cover-art source
 *  in turn, so a film with no official art still shows a frame. */
export default function Poster({ film, width = 124 }: { film: Film; width?: number }) {
  const sources = posterCandidates(film);
  const [index, setIndex] = useState(0);

  async function open() {
    if (await confirmAge(film)) {
      router.push({ pathname: '/film/[slug]', params: { slug: film.slug } });
    }
  }

  return (
    <Pressable
      onPress={() => void open()}
      style={({ pressed }) => [{ width, opacity: pressed ? 0.75 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${film.title}, ${film.year}`}>
      <View style={[styles.frame, { width, height: width * 1.5 }]}>
        <Image
          source={{ uri: sources[Math.min(index, sources.length - 1)] }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onError={() => setIndex((i) => Math.min(i + 1, sources.length - 1))}
        />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {film.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {film.year} · {film.rating}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.panel2,
  },
  title: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 6 },
  meta: { color: colors.ink2, fontSize: 12, marginTop: 1 },
});
