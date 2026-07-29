"use client";

import { useId, useRef, useState } from "react";
import { Upload } from "lucide-react";
import api from "@/lib/api";
import { getAxiosError } from "@/lib/errors";
import { INPUT_CLASS as inputClass } from "@/lib/styles";

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ImageUploadField({ value, onChange, label = "Image" }: ImageUploadFieldProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/admin/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(res.data.url);
    } catch (err) {
      setUploadError(getAxiosError(err).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="block text-xs font-medium text-charcoal/60 mb-1.5">{label}</label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelected}
        disabled={uploading}
        className="hidden"
        id={fileInputId}
      />
      <label
        htmlFor={fileInputId}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-charcoal/60 text-xs cursor-pointer hover:border-black/20 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <Upload size={13} />
        {uploading ? "Uploading…" : value ? "Change image" : "Upload image"}
      </label>

      {uploadError && <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>}

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
        disabled={uploading}
        className={`${inputClass} mt-2`}
        data-testid="input-image-url"
      />

      {value && (
        <div className="mt-2 w-20 h-20 rounded-lg border border-black/10 overflow-hidden bg-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );
}
