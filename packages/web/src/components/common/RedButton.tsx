import type { ComponentProps } from 'react';
import { Button } from '@heroui/react';

/**
 * The red button: the app's one destructive action, wherever it appears.
 *
 * `danger-soft` rather than the brand red — our red is a pale status tint for
 * "overdue", and something that destroys data needs a colour that reads as
 * alarming rather than as a label. This is the same treatment the task modal's
 * Excluir already used; it lives here so every other one matches it by
 * construction instead of by memory.
 *
 * Everything HeroUI's Button takes passes through.
 */
export function RedButton({ className = '', ...props }: ComponentProps<typeof Button>) {
  return <Button variant="danger-soft" className={className} {...props} />;
}
