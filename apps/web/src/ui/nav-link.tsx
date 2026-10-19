import type { AnchorHTMLAttributes } from 'react';
import { navigate, routeHref } from '../lib/navigation';
export function NavLink({
  path = '',
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { path?: string }) {
  return (
    <a
      {...props}
      href={routeHref(path)}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !props.target
        ) {
          event.preventDefault();
          navigate(path);
        }
      }}
    />
  );
}
