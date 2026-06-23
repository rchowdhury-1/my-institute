"use client";

import { useState, useRef, useEffect } from "react";

interface User {
  id: string;
  display_name: string;
  email: string;
}

interface UserSearchInputProps {
  users: User[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function UserSearchInput({
  users,
  value,
  onChange,
  placeholder = "Search by name…",
  disabled = false,
}: UserSearchInputProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = users.find((u) => u.id === value);

  useEffect(() => {
    if (selected) setQuery(selected.display_name);
    else if (!value) setQuery("");
  }, [value, selected]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.trim()
    ? users.filter(
        (u) =>
          u.display_name.toLowerCase().includes(query.toLowerCase()) ||
          u.email.toLowerCase().includes(query.toLowerCase())
      )
    : users;

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-xl border border-black/10 bg-cream text-sm text-charcoal placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-emerald-primary/30 disabled:opacity-50"
      />
      {value && !disabled && (
        <button
          onClick={() => { onChange(""); setQuery(""); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-charcoal/30 hover:text-charcoal/60 text-xs"
          type="button"
        >
          ✕
        </button>
      )}
      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-black/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onChange(u.id);
                setQuery(u.display_name);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-primary/5 transition-colors ${
                u.id === value ? "bg-emerald-primary/10 text-emerald-primary" : "text-charcoal"
              }`}
            >
              {u.display_name}
              <span className="text-charcoal/30 text-xs ml-1">({u.email})</span>
            </button>
          ))}
        </div>
      )}
      {open && !disabled && query.trim() && filtered.length === 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-black/10 rounded-xl shadow-lg px-3 py-2 text-charcoal/40 text-sm">
          No results
        </div>
      )}
    </div>
  );
}
