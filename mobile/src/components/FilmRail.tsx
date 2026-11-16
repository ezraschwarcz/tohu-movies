import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { Film } from '@/lib/films';
import { colors, space } from '@/lib/theme';

import Poster from './Poster';

/** A titled, sideways-scrolling row of films. */
export default function FilmRail({ title, films }: { title: string; films: Film[] }) {
  if (films.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        horizontal
        data={films}
        keyExtractor={(f) => f.slug}
        renderItem={({ item }) => <Poster film={item} />}
        ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
        contentContainerStyle={{ paddingHorizontal: space.lg }}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: space.md,
    paddingHorizontal: space.lg,
  },
});
