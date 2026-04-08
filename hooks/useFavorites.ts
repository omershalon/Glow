import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type { Product } from '@/lib/products';

const STORAGE_KEY = '@skinx_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Product[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setFavorites(JSON.parse(raw));
    });
  }, []);

  const save = useCallback((updated: Product[]) => {
    setFavorites(updated);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const toggle = useCallback((product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFavorites((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      const updated = exists ? prev.filter((p) => p.id !== product.id) : [...prev, product];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some((p) => p.id === id), [favorites]);

  return { favorites, toggle, isFavorite };
}
