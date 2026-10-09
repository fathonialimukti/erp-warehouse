import { AppIcon } from "./AppIcon";
import type { IconName } from "./AppIcon";

type EntityPhotoProps = {
  src?: string | null;
  alt: string;
  className?: string;
  icon?: IconName;
};

function EntityPhoto({
  src,
  alt,
  className = "h-14 w-14 rounded-2xl",
  icon = "camera",
}: EntityPhotoProps) {
  if (src) {
    return <img src={src} alt={alt} className={`${className} object-cover`} />;
  }

  return (
    <div
      className={`${className} flex items-center justify-center bg-default-100 text-muted`}
      aria-label={alt}
    >
      <AppIcon name={icon} className="size-5" />
    </div>
  );
}

export { EntityPhoto };
