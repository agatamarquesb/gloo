import type { ComponentProps } from 'react';
import { Button } from '@heroui/react';

import { outlineControl } from '@/theme/styleConstants';

/**
 * The counterpart to a primary action: Cancelar beside Salvar, and anything
 * else that dismisses rather than commits.
 *
 * It exists because these had drifted into three different looks — `secondary`,
 * `ghost`, and an outline with a near-black border — so a dialog's two buttons
 * read as unrelated controls rather than a pair. One outlined pill in the same
 * light edge as the routine modal's action pills settles it.
 *
 * Everything HeroUI's Button takes passes through, including `slot="close"`.
 */
export function SecondaryButton({ className = '', ...props }: ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" className={`rounded-full ${outlineControl} ${className}`} {...props} />
  );
}
