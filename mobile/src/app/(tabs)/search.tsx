import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import Poster from '@/components/Poster';
import { Loading, Message } from '@/components/Screen';
import { getFilms, type Film } from '@/lib/films';
import { colors, space } from '@/lib/theme';

export default function SearchScreen() {
  const [films, setFilms] = useState<Film[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 5 : 3;
  const cardWidth = (width - space.lg * 2 - space.md * (columns - 1)) / columns;

  useEffect(() => {
    getFilms()
      .then(setFilms)
      .catch((e: Error) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...(films ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    if (!q) return list;
    return list.filter((f) =>
      [f.title, f.genre, f.director, f.cast_text, String(f.year)].some((v) => v.toLowerCase().includes(q)),
    );
  }, [films, query]);

  if (error && !films) return <Message title="Could not load the films" body={error} />;
  if (!films) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Title, genre, director or cast"
        placeholderTextColor={colors.ink2}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
      <FlatList
        key={columns}
        data={shown}
        numColumns={columns}
        keyExtractor={(f) => f.slug}
        renderItem={({ item }) => <Poster film={item} width={cardWidth} />}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Message title="No films match" body="Try a different word." />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    margin: space.lg,
    marginBottom: 0,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: colors.ink,
    fontSize: 16,
  },
});
