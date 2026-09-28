import { cn, initials } from "../lib/utils";

type AvatarProps = {
  name: string;
  imageUrl?: string | null;
  sizeClassName?: string;
  textClassName?: string;
  backgroundColor?: string;
  className?: string;
};

export default function Avatar({
  name,
  imageUrl,
  sizeClassName = "h-12 w-12",
  textClassName = "text-lg",
  backgroundColor = "#2563eb",
  className,
}: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${name} profile`}
        className={cn(sizeClassName, "rounded-md object-cover ring-1 ring-black/10", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md font-bold text-white",
        sizeClassName,
        textClassName,
        className,
      )}
      style={{ backgroundColor }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
