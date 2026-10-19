import type { ButtonHTMLAttributes } from 'react';
export function Button({
  type = 'button',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`button ${className}`} {...props} />;
}
