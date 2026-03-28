import React from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useBatches } from '../../hooks/useBatches';
import { BatchCard } from '../../components/BatchCard';
import { colors, spacing, typography } from '../../theme';

export function BatchListScreen({ navigation }: any) {
  const { data: batches, isPending, refetch } = useBatches();

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={batches || []}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BatchCard
            batch={item}
            onPress={() => navigation.navigate('BatchDetail', { batchId: item.id, batchName: item.name })}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.title}>Gallery</Text>}
        ListEmptyComponent={<Text style={styles.empty}>No batches yet</Text>}
        onRefresh={refetch}
        refreshing={isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, marginBottom: spacing.lg },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
