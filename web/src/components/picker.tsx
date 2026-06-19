"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Dumbbell,
  Home,
  Mountain,
  Pencil,
  Search,
  Smile,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getMru, type MruKey } from "@/lib/mru";
import {
  GYM_CATEGORY_LABEL,
  useGyms,
  type GymCategory,
  type GymRecord,
} from "@/lib/gyms";
import {
  TARGET_CATEGORY_LABEL,
  useTargets,
  type TargetCategory,
  type TargetRecord,
} from "@/lib/targets";

type Mode = "preset" | "custom";

const LOCATION_ICON: Record<GymCategory, LucideIcon> = {
  "gym-seoul": Building2,
  "gym-suburb": Building2,
  outdoor: Mountain,
  home: Home,
};

const TARGET_ICON: Record<TargetCategory, LucideIcon> = {
  grade: TrendingUp,
  condition: Dumbbell,
  technique: Target,
  casual: Smile,
};

// 야외·홈 카테고리는 picker UI에 노출 안 함 (PB 데이터는 유지 — 직접 입력 매칭은 가능).
const VISIBLE_GYM_CATEGORIES: GymCategory[] = ["gym-seoul", "gym-suburb"];

/** 공용 picker 내부 — 두 wrapper (Location/Target)에서 같이 사용. */
function PickerCore<C extends string>({
  label,
  value,
  onChange,
  placeholder,
  mruKey,
  presets,
  isLoading,
  isError,
  categoryLabel,
  iconFor,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  mruKey: MruKey;
  presets: { label: string; category: C }[];
  isLoading: boolean;
  isError: boolean;
  categoryLabel: Record<C, string>;
  iconFor: Record<C, LucideIcon>;
}) {
  const [mode, setMode] = useState<Mode>("preset");
  const [query, setQuery] = useState("");

  // MRU는 mount 시 한 번 읽음 — picker 닫혔다 다시 열면 다시 읽음.
  const mru = useMemo(() => getMru(mruKey), [mruKey]);

  const filteredPresets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.label.toLowerCase().includes(q));
  }, [presets, query]);

  const grouped = useMemo(() => {
    const map = new Map<C, { label: string; category: C }[]>();
    for (const p of filteredPresets) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return Array.from(map.entries());
  }, [filteredPresets]);

  const isCustom = mode === "custom";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-caption text-fg-secondary">{label}</span>
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "preset" ? "custom" : "preset"));
            setQuery("");
          }}
          className={cn(
            "flex min-h-tap items-center gap-1 rounded-md px-3 text-micro transition-colors",
            isCustom
              ? "bg-bg-selected text-brand"
              : "bg-elevated text-fg-secondary hover:text-fg-primary",
          )}
          aria-pressed={isCustom}
          aria-label={isCustom ? "프리셋으로 돌아가기" : "직접 입력 모드로 전환"}
        >
          <Pencil size={12} aria-hidden />
          {isCustom ? "직접 입력 ON" : "직접 입력"}
        </button>
      </div>

      {/* 선택된 값 표시 */}
      <div
        className={cn(
          "min-h-tap rounded-md bg-surface px-3 py-2 text-bodyLg",
          value ? "text-fg-primary" : "text-fg-muted",
        )}
        aria-live="polite"
      >
        {value || placeholder}
      </div>

      {isCustom ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          autoComplete="off"
          inputMode="text"
          autoFocus
          className="h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none placeholder:text-fg-muted"
        />
      ) : (
        <>
          {/* 검색 input */}
          <div className="flex items-center gap-2 rounded-md bg-surface px-3">
            <Search size={16} className="text-fg-muted" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색"
              autoComplete="off"
              inputMode="search"
              className="h-tap-default flex-1 bg-transparent text-fg-primary outline-none placeholder:text-fg-muted"
              aria-label={`${label} 프리셋 검색`}
            />
          </div>

          {/* MRU */}
          {mru.length > 0 && !query && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1 text-micro text-fg-secondary">
                <Sparkles size={12} aria-hidden />
                최근 사용
              </div>
              <div className="flex flex-wrap gap-2">
                {mru.map((m) => (
                  <PresetChip
                    key={`mru-${m}`}
                    label={m}
                    selected={value === m}
                    onClick={() => onChange(m)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 본문: 로딩 / 에러 / 결과.
              presets.length === 0 가드는 stale cache가 남아있는 동안
              skeleton/에러를 깜빡이지 않게 — 캐시 있으면 그대로 chip 표시. */}
          {isLoading && presets.length === 0 ? (
            <SkeletonGrid />
          ) : isError && presets.length === 0 ? (
            <p
              role="status"
              className="rounded-md bg-surface px-3 py-3 text-caption text-fg-muted"
            >
              카탈로그를 불러오지 못했어요. 우측 상단 &ldquo;직접 입력&rdquo;을 눌러 자유롭게 적어주세요.
            </p>
          ) : grouped.length === 0 ? (
            <p className="rounded-md bg-surface px-3 py-3 text-caption text-fg-muted">
              일치하는 프리셋이 없어요. 우측 상단 &ldquo;직접 입력&rdquo;을 눌러 자유롭게 적어주세요.
            </p>
          ) : (
            grouped.map(([cat, items]) => {
              const Icon: LucideIcon = iconFor[cat];
              return (
                <div key={cat} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1 text-micro text-fg-secondary">
                    <Icon size={12} aria-hidden />
                    {categoryLabel[cat]}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((p) => (
                      <PresetChip
                        key={p.label}
                        label={p.label}
                        selected={value === p.label}
                        onClick={() => onChange(p.label)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

function PresetChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "min-h-tap rounded-full border px-3 py-1.5 text-caption transition-colors",
        selected
          ? "border-brand bg-bg-selected text-brand"
          : "border-transparent bg-elevated text-fg-primary hover:bg-surface",
      )}
    >
      {label}
    </button>
  );
}

function SkeletonGrid() {
  // 로딩 중 placeholder. 폭은 모바일 가독성 위해 약간 들쭉날쭉하게.
  const widths = ["w-20", "w-24", "w-28", "w-16", "w-24", "w-20"];
  return (
    <div className="flex flex-col gap-1.5" aria-busy aria-live="polite">
      <div className="flex flex-wrap gap-2">
        {widths.map((w, i) => (
          <span
            key={i}
            className={cn(
              "min-h-tap animate-pulse rounded-full bg-elevated",
              w,
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { data, isLoading, isError } = useGyms();
  const presets = useMemo(
    () =>
      (data ?? [])
        .filter((g: GymRecord) => VISIBLE_GYM_CATEGORIES.includes(g.category))
        .map((g: GymRecord) => ({
          label: g.name,
          category: g.category,
        })),
    [data],
  );
  return (
    <PickerCore<GymCategory>
      label="장소"
      value={value}
      onChange={onChange}
      placeholder="예) 더 클라임 강남"
      mruKey="bt:mru-locations"
      presets={presets}
      isLoading={isLoading}
      isError={isError}
      categoryLabel={GYM_CATEGORY_LABEL}
      iconFor={LOCATION_ICON}
    />
  );
}

export function TargetPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { data, isLoading, isError } = useTargets();
  const presets = useMemo(
    () =>
      (data ?? []).map((t: TargetRecord) => ({
        label: t.label,
        category: t.category,
      })),
    [data],
  );
  return (
    <PickerCore<TargetCategory>
      label="메인 타깃"
      value={value}
      onChange={onChange}
      placeholder="예) V6 프로젝트 + 하프 크림프"
      mruKey="bt:mru-targets"
      presets={presets}
      isLoading={isLoading}
      isError={isError}
      categoryLabel={TARGET_CATEGORY_LABEL}
      iconFor={TARGET_ICON}
    />
  );
}
