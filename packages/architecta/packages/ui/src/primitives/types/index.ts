import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from "react";

/**
 * Extract props from a component type, excluding ref
 */
export type ComponentProps<T extends React.ElementType> =
  ComponentPropsWithoutRef<T>;

/**
 * Extract ref type from a component
 */
export type ComponentRef<T extends React.ElementType> = ElementRef<T>;

/**
 * Common props for components that can render as different elements
 */
export interface AsChildProps {
  asChild?: boolean;
}

/**
 * Common props for components with children
 */
export interface WithChildren {
  children?: ReactNode;
}

/**
 * Common size variants
 */
export type Size = "sm" | "md" | "lg";

/**
 * Common variant types for buttons and similar components
 */
export type Variant =
  | "default"
  | "primary"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";
