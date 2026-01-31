import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in South African Rand
 * @example formatCurrency(12345) => "R 12 345"
 * @example formatCurrency(0) => "R 0"
 * @example formatCurrency(null) => "N/A"
 */
export function formatCurrency(value: number | undefined | null): string {
  // Only return "N/A" for truly invalid values (null, undefined, NaN)
  // Zero is a valid price and should display as "R 0"
  if (value === undefined || value === null) {
    return "N/A";
  }

  // Check for NaN after coercing to number
  const numValue = Number(value);
  if (Number.isNaN(numValue)) {
    return "N/A";
  }

  // Format the number with space as thousands separator
  return `R ${Math.round(numValue)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Calculate total stock across all locations
 */
export function getTotalStock(stock: { jhb: number; cpt: number; dbn: number }): number {
  return (stock.jhb || 0) + (stock.cpt || 0) + (stock.dbn || 0);
}

/**
 * Get stock status label and color
 */
export function getStockStatus(totalStock: number): {
  label: string;
  color: "success" | "warning" | "error";
} {
  if (totalStock > 5) {
    return { label: "In Stock", color: "success" };
  } else if (totalStock > 0) {
    return { label: "Low Stock", color: "warning" };
  } else {
    return { label: "Out of Stock", color: "error" };
  }
}

/**
 * Parse quantity from natural language
 * @example parseQuantity("2x JBL") => 2
 * @example parseQuantity("pair of speakers") => 2
 */
export function parseQuantity(input: string): number {
  // Check for "Nx" pattern (e.g., "2x", "3x")
  const nxMatch = input.match(/(\d+)\s*x\s/i);
  if (nxMatch) return parseInt(nxMatch[1], 10);

  // Check for "N units" pattern
  const unitsMatch = input.match(/(\d+)\s*units?/i);
  if (unitsMatch) return parseInt(unitsMatch[1], 10);

  // Check for "pair" pattern
  if (/pair/i.test(input)) return 2;

  // Check for number at start
  const startMatch = input.match(/^(\d+)\s/);
  if (startMatch) return parseInt(startMatch[1], 10);

  // Default to 1
  return 1;
}

/**
 * Get first valid image URL or placeholder
 */
export function getProductImage(images: string[] | null | undefined): string {
  if (!images || images.length === 0) {
    return "/placeholder-product.png";
  }
  // Filter out invalid URLs
  const validImage = images.find(
    (img) => img && (img.startsWith("http") || img.startsWith("/"))
  );
  return validImage || "/placeholder-product.png";
}

/**
 * Generate a unique consultation reference code
 * Format: CQ-YYYYMMDD-XXX
 * @param existingCount - Number of consultations already created today
 * @returns Reference code like "CQ-20250126-001"
 * @example generateConsultationReferenceCode(0) => "CQ-20250126-001"
 * @example generateConsultationReferenceCode(5) => "CQ-20250126-006"
 */
export function generateConsultationReferenceCode(existingCount: number = 0): string {
  const now = new Date();

  // Format date as YYYYMMDD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Format counter as 3-digit number (001, 002, etc.)
  const counter = String(existingCount + 1).padStart(3, '0');

  return `CQ-${dateStr}-${counter}`;
}

/**
 * Parse a consultation reference code to extract date and sequence
 * @param referenceCode - Reference code like "CQ-20250126-001"
 * @returns Object with date and sequence number, or null if invalid
 */
export function parseConsultationReferenceCode(referenceCode: string): {
  date: Date;
  sequence: number;
} | null {
  const match = referenceCode.match(/^CQ-(\d{4})(\d{2})(\d{2})-(\d{3})$/);
  if (!match) return null;

  const [, year, month, day, seq] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const sequence = parseInt(seq);

  return { date, sequence };
}
