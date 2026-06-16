"use client";

import { useEffect, useState } from "react";
import { MOD_CATEGORIES } from "@/lib/utils";

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([...MOD_CATEGORIES]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories)) setCategories(d.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}
