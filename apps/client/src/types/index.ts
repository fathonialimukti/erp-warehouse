import { SVGAttributes } from 'react';

export interface IconSvgProps extends SVGAttributes<SVGElement> {
  className?: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<IconSvgProps>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
