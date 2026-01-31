"use client";

import Image from "next/image";
import { cn, formatCurrency, getProductImage, getStockStatus } from "@/lib/utils";
import { ShoppingCart, Package } from "lucide-react";
import type { Product } from "@/lib/types";

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  disabled?: boolean;
  selected?: boolean;
}

export function ProductCard({
  product,
  onSelect,
  disabled = false,
  selected = false,
}: ProductCardProps) {
  const stockStatus = getStockStatus(product.stock.total);
  const imageUrl = getProductImage(product.images);

  return (
    <div
      className={cn(
        "card-elevated group relative overflow-hidden transition-all duration-200",
        "hover:border-accent/50 hover:shadow-glow",
        selected && "border-accent ring-2 ring-accent/30",
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      {/* Product Image */}
      <div className="relative h-40 bg-background-elevated rounded-lg mb-4 overflow-hidden">
        {imageUrl.startsWith("http") ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={48} className="text-foreground-subtle" />
          </div>
        )}
        {/* Stock Badge */}
        <div
          className={cn(
            "absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium",
            stockStatus.color === "success" && "bg-success/20 text-success",
            stockStatus.color === "warning" && "bg-warning/20 text-warning",
            stockStatus.color === "error" && "bg-error/20 text-error"
          )}
        >
          {stockStatus.label}
        </div>
      </div>

      {/* Product Info */}
      <div className="space-y-2">
        {/* Brand */}
        {product.brand && (
          <p className="text-xs text-accent font-medium uppercase tracking-wide">
            {product.brand}
          </p>
        )}

        {/* Name */}
        <h3 className="font-semibold text-foreground line-clamp-2 min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* SKU */}
        <p className="text-xs text-foreground-subtle">{product.sku}</p>

        {/* Price */}
        <p className="text-xl font-bold text-foreground">
          {formatCurrency(product.price)}
        </p>

        {/* Stock Details */}
        {product.stock.total > 0 && (
          <div className="flex gap-2 text-xs text-foreground-muted">
            {product.stock.jhb > 0 && <span>JHB: {product.stock.jhb}</span>}
            {product.stock.cpt > 0 && <span>CPT: {product.stock.cpt}</span>}
            {product.stock.dbn > 0 && <span>DBN: {product.stock.dbn}</span>}
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={() => onSelect(product)}
          disabled={disabled}
          className={cn(
            "btn-primary w-full mt-3 flex items-center justify-center gap-2",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <ShoppingCart size={16} />
          <span>Add to Quote</span>
        </button>
      </div>
    </div>
  );
}
