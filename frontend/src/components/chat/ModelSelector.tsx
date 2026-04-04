"use client";

import { useState } from "react";
import { ChevronDown, Shield, Zap, Scale, Brain, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModelOption } from "@/lib/api";

const SPEED_CONFIG = {
  fast:     { icon: Zap,   label: "Fast",      cls: "text-green-600 bg-green-50"   },
  balanced: { icon: Scale, label: "Balanced",   cls: "text-blue-600 bg-blue-50"    },
  thorough: { icon: Brain, label: "Thorough",   cls: "text-purple-600 bg-purple-50" },
} as const;

interface ModelSelectorProps {
  models: ModelOption[];
  selected: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ModelSelector({
  models,
  selected,
  onChange,
  disabled = false,
  compact = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const current = models.find((m) => m.model_id === selected);
  const cfg = current ? SPEED_CONFIG[current.speed] : null;
  const Icon = cfg?.icon ?? Scale;

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 border border-gray-200 rounded-lg transition-colors",
          "hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed",
          compact ? "px-2.5 py-1.5" : "px-3 py-2"
        )}
      >
        {cfg && (
          <span className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded", cfg.cls)}>
            <Icon className="w-3 h-3" />
            {!compact && cfg.label}
          </span>
        )}
        <span className="text-sm font-medium text-gray-700">
          {current?.display_name ?? selected}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-gray-200 shadow-xl w-76 p-1.5">
            <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Choose model
            </p>
            {models.map((m) => {
              const mc = SPEED_CONFIG[m.speed];
              const MI = mc.icon;
              const isSelected = m.model_id === selected;
              return (
                <button
                  key={m.model_id}
                  onClick={() => { onChange(m.model_id); setOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-3",
                    isSelected ? "bg-[#e1f5ee]" : "hover:bg-gray-50"
                  )}
                >
                  <span className={cn("flex items-center gap-1 text-xs px-1.5 py-0.5 rounded mt-0.5 shrink-0", mc.cls)}>
                    <MI className="w-3 h-3" />
                    {mc.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{m.display_name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#0f6e56]" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.description}</p>
                    {m.parameter_count && (
                      <span className="text-[10px] text-gray-400">{m.parameter_count} params</span>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="mt-1.5 pt-1.5 border-t border-gray-100 px-3 pb-1.5">
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-[#0f6e56]" />
                All models run entirely on NZ servers
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
