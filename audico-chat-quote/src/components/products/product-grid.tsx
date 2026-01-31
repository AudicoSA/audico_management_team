"use client";

import { ProductCard } from "./product-card";
import type { Product } from "@/lib/types";

interface ProductGridProps {
  products: Product[];
  onSelect: (product: Product) => void;
  disabled?: boolean;
  selectedId?: string;
}

export function ProductGrid({
  products,
  onSelect,
  disabled = false,
  selectedId,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-8 text-foreground-muted">
        No products found matching your criteria.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.slice(0, 6).map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={onSelect}
          disabled={disabled}
          selected={product.id === selectedId}
        />
      ))}
    </div>
  );
}
