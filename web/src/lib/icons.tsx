// Ícones SVG da loja (traços em iconPaths.ts), como componente React.
import { paths, type IconName } from "./iconPaths";

export type { IconName };
type Props = { name: IconName; size?: number; label?: string; className?: string };

export function Icon({ name, size = 20, label, className }: Props) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: "false" as const };
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      dangerouslySetInnerHTML={{ __html: paths[name] ?? "" }}
    />
  );
}
