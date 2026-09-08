import type { ThreeElements } from '@react-three/fiber';

/* eslint-disable @typescript-eslint/no-empty-object-type -- JSX augmentation requires empty interface extension */

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export {};
