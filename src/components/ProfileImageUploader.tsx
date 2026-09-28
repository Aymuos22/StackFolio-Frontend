import { Camera, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";
import toast from "react-hot-toast";
import { deleteProfileImage, uploadProfileImage } from "../api/portfolio";
import { apiErrorMessage, cn, initials } from "../lib/utils";
import Button from "./Button";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

type ProfileImageUploaderProps = {
  imageUrl?: string | null;
  fullName?: string;
  primaryColor?: string;
  disabled?: boolean;
  onImageChange: (imageUrl: string | null) => void;
};

function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 5MB or smaller.";
  }
  return null;
}

export default function ProfileImageUploader({
  imageUrl,
  fullName = "You",
  primaryColor = "#2563eb",
  disabled,
  onImageChange,
}: ProfileImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState("");

  const displayUrl = previewUrl ?? imageUrl ?? null;
  const busy = isUploading || isRemoving;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setError("");
    setIsUploading(true);

    try {
      const data = await uploadProfileImage(file);
      onImageChange(data.imageUrl);
      toast.success(data.message || "Profile image uploaded successfully");
      setPreviewUrl(null);
    } catch (uploadError) {
      setPreviewUrl(null);
      const message = apiErrorMessage(uploadError, "Unable to upload profile image.");
      setError(message);
      toast.error(message);
    } finally {
      URL.revokeObjectURL(localPreview);
      setIsUploading(false);
    }
  }

  async function handleRemove() {
    const ok = window.confirm("Remove your profile image?");
    if (!ok) return;

    setError("");
    setIsRemoving(true);
    try {
      await deleteProfileImage();
      setPreviewUrl(null);
      onImageChange(null);
      toast.success("Profile image removed.");
    } catch (removeError) {
      const message = apiErrorMessage(removeError, "Unable to remove profile image.");
      setError(message);
      toast.error(message);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <section className={cn("panel p-5", disabled && "opacity-60")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-950">Profile image</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a square photo for your public portfolio. JPEG, PNG, WebP, or GIF up to 5MB.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative shrink-0">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={`${fullName} profile`}
              className="h-24 w-24 rounded-lg object-cover ring-1 ring-line"
            />
          ) : (
            <div
              className="flex h-24 w-24 items-center justify-center rounded-lg text-2xl font-bold text-white"
              style={{ backgroundColor: primaryColor }}
              aria-hidden="true"
            >
              {initials(fullName)}
            </div>
          )}
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-950/50 text-xs font-semibold text-white">
              Uploading…
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(event) => void handleFileChange(event)}
          />
          <Button
            type="button"
            variant="secondary"
            icon={displayUrl ? <Camera className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            isLoading={isUploading}
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {displayUrl ? "Replace image" : "Upload image"}
          </Button>
          {imageUrl || previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              icon={<Trash2 className="h-4 w-4" />}
              isLoading={isRemoving}
              disabled={disabled || busy}
              onClick={() => void handleRemove()}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <p className="error mt-3">{error}</p> : null}
    </section>
  );
}
