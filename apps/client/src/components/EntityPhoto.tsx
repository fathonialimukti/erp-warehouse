import { Icon } from '@iconify/react';

type EntityPhotoProps = {
  src?: string | null;
  alt: string;
  className?: string;
  icon?: string;
};

export default function EntityPhoto({
  src,
  alt,
  className = 'h-14 w-14 rounded-2xl',
  icon = 'solar:camera-linear',
}: EntityPhotoProps) {
  if (src) {
    return <img src={src} alt={alt} className={`${className} object-cover`} />;
  }

  return (
    <div className={`${className} flex items-center justify-center bg-default-100 text-muted`} aria-label={alt}>
      <Icon icon={icon} className="size-5" />
    </div>
  );
}