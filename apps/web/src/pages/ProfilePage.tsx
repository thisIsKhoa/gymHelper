import { AnimatePresence, motion } from "framer-motion";
import { Award, ShieldQuestion, Sparkles, Star, Key, Code, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";

import { Card } from "../components/ui/Card.tsx";
import { ChartContainer } from "../components/ui/ChartContainer.tsx";
import { LoadingState } from "../components/ui/LoadingState.tsx";
import { loadGamificationProfile } from "../lib/gamification.ts";
import { apiRequest } from "../lib/api.ts";
import type {
  AchievementItem,
  GamificationProfileResponse,
  MuscleSkillCode,
} from "../types/gamification.ts";

const PROFILE_QUERY_KEY = ["gamification-profile"] as const;
const LEVEL_UP_POPUP_DURATION_MS = 3_400;

type LevelUpPayload = {
  skill: MuscleSkillCode;
  level: number;
};

type LevelUpEventDetail = {
  skill?: unknown;
  level?: unknown;
};

type ProfileViewModel = GamificationProfileResponse & {
  sortedAchievements: AchievementItem[];
  strongestBranchLabel: string;
};

const SKILL_LABELS: Record<MuscleSkillCode, string> = {
  CHEST: "Chest",
  BACK: "Back",
  LATS: "Lats",
  LEGS: "Legs",
  ARMS: "Arms",
  CORE: "Core",
};

function toSkillLabel(skill: MuscleSkillCode): string {
  return SKILL_LABELS[skill] ?? skill;
}

function isMuscleSkillCode(value: unknown): value is MuscleSkillCode {
  return (
    value === "CHEST" ||
    value === "BACK" ||
    value === "LATS" ||
    value === "LEGS" ||
    value === "ARMS" ||
    value === "CORE"
  );
}

function parseLevelUpEvent(detail: unknown): LevelUpPayload | null {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const payload = detail as LevelUpEventDetail;

  if (!isMuscleSkillCode(payload.skill)) {
    return null;
  }

  if (typeof payload.level !== "number" || !Number.isFinite(payload.level)) {
    return null;
  }

  return {
    skill: payload.skill,
    level: payload.level,
  };
}

function achievementTheme(item: AchievementItem): string {
  return item.isUnlocked
    ? "border-amber-300/50 bg-[linear-gradient(140deg,rgba(251,191,36,0.22),rgba(251,191,36,0.06))]"
    : "border-[var(--border)] bg-[var(--surface-solid)] grayscale";
}

function AchievementIcon({ item }: { item: AchievementItem }) {
  if (!item.isUnlocked && item.isHidden) {
    return <ShieldQuestion size={16} />;
  }

  if (item.category === "pr") {
    return <Star size={16} />;
  }

  return <Award size={16} />;
}

function toProfileViewModel(
  profile: GamificationProfileResponse,
): ProfileViewModel {
  const sortedAchievements = [...profile.achievements].sort((a, b) => {
    if (a.isUnlocked === b.isUnlocked) {
      return a.title.localeCompare(b.title);
    }

    return a.isUnlocked ? -1 : 1;
  });

  const strongestBranchLabel =
    profile.muscleSkills
      .slice()
      .sort((a, b) => b.level - a.level || b.totalExp - a.totalExp)[0]?.label ??
    "-";

  return {
    ...profile,
    sortedAchievements,
    strongestBranchLabel,
  };
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<LevelUpPayload[]>([]);
  const [activeLevelUp, setActiveLevelUp] = useState<LevelUpPayload | null>(
    null,
  );
  
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [regenerateError, setRegenerateError] = useState("");
  const recoveryModalRef = useRef<HTMLDivElement | null>(null);

  const { mutate: regenerateCode, isPending: isRegenerating } = useMutation({
    mutationFn: (password: string) =>
      apiRequest<{ recoveryCode: string }>('/auth/regenerate-recovery-code', 'POST', { currentPassword: password }),
    onSuccess: (data) => {
      setNewRecoveryCode(data.recoveryCode);
      setCurrentPassword("");
      setRegenerateError("");
    },
    onError: (error) => {
      setRegenerateError((error as Error).message || "Failed to regenerate code");
    }
  });

  const handleCopyCode = async () => {
    if (newRecoveryCode) {
      await navigator.clipboard.writeText(newRecoveryCode);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: loadGamificationProfile,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    select: toProfileViewModel,
  });

  useEffect(() => {
    if (activeLevelUp || queue.length === 0) {
      return;
    }

    const [head, ...rest] = queue;

    if (!head) {
      return;
    }

    setActiveLevelUp(head);
    setQueue(rest);
  }, [activeLevelUp, queue]);

  useEffect(() => {
    if (!activeLevelUp) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setActiveLevelUp(null);
    }, LEVEL_UP_POPUP_DURATION_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activeLevelUp]);

  const handleProfileRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
  }, [queryClient]);

  const handleLevelUp = useCallback((event: Event) => {
    const payload = parseLevelUpEvent((event as CustomEvent<unknown>).detail);

    if (payload) {
      setQueue((current) => [...current, payload]);
    }
  }, []);

  useEffect(() => {
    window.addEventListener(
      "gamification:profile-refresh",
      handleProfileRefresh,
    );
    window.addEventListener("gamification:level-up", handleLevelUp);

    return () => {
      window.removeEventListener(
        "gamification:profile-refresh",
        handleProfileRefresh,
      );
      window.removeEventListener("gamification:level-up", handleLevelUp);
    };
  }, [handleLevelUp, handleProfileRefresh]);

  useEffect(() => {
    if (!showPasswordModal) {
      return;
    }

    const container = recoveryModalRef.current;
    if (!container) {
      return;
    }

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusFirst = () => {
      const first = container.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    };

    // Small delay so framer-motion animation renders the element
    const timerId = window.setTimeout(focusFirst, 80);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !newRecoveryCode) {
        setShowPasswordModal(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showPasswordModal, newRecoveryCode]);

  if (isLoading) {
    return <LoadingState message="Loading profile..." cardCount={3} />;
  }

  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to load muscle profile.";

    return <p className="ui-status ui-status-danger">{errorMessage}</p>;
  }

  if (!profile) {
    return <p className="ui-status">No profile data available.</p>;
  }

  return (
    <>
      <div className="grid gap-4">
        <Card
          title="Muscle Skill Trees"
          subtitle="Build each branch with consistent sessions, volume, and intensity"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="ui-tile p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-(--muted)">
                Achievements
              </p>
              <p className="mt-2 text-xl font-bold">
                {profile.summary.unlockedAchievements}/
                {profile.summary.totalAchievements}
              </p>
            </article>

            <article className="ui-tile p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-(--muted)">
                Unread Alerts
              </p>
              <p className="mt-2 text-xl font-bold">
                {profile.summary.unreadNotifications}
              </p>
            </article>

            <article className="ui-tile p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-(--muted)">
                Strongest Branch
              </p>
              <p className="mt-2 text-xl font-bold">
                {profile.strongestBranchLabel}
              </p>
            </article>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <Card
            title="Muscle Balance Radar"
            subtitle="Quickly detect weak branches before they become plateaus"
          >
            <ChartContainer className="h-80 w-full" minHeight={260}>
              <RadarChart data={profile.radar}>
                <PolarGrid stroke="rgba(148,163,184,0.3)" />
                <PolarAngleAxis dataKey="muscle" />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  dataKey="value"
                  name="Balance"
                  stroke="var(--accent)"
                  fill="var(--accent)"
                  fillOpacity={0.35}
                />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toFixed(1)} / 100`,
                    "Balance",
                  ]}
                />
              </RadarChart>
            </ChartContainer>
          </Card>

          <Card
            title="Branch Levels"
            subtitle="EXP from volume, RPE scaling, and weekly combo bonus"
          >
            <div className="space-y-2">
              {profile.muscleSkills.map((skill) => (
                <article key={skill.skill} className="ui-tile p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{skill.label}</p>
                    <span className="ui-chip">Lv {skill.level}</span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color-mix(in oklab,var(--surface) 86%,black)]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-alt))]"
                      style={{
                        width: `${Math.max(3, Math.min(100, skill.progressPct))}%`,
                      }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-(--muted)">
                    {skill.expIntoLevel.toFixed(0)} /{" "}
                    {skill.expToNextLevel.toFixed(0)} EXP to next level
                  </p>
                </article>
              ))}
            </div>
          </Card>
        </div>

        <Card
          title="Trophy Room"
          subtitle="Locked badges stay in silhouette with live progress tracking"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profile.sortedAchievements.map((item) => (
              <article
                key={item.code}
                className={`rounded-xl border p-3 transition-all ${achievementTheme(item)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-(--muted)">
                      {item.description}
                    </p>
                  </div>

                  <span className="ui-chip inline-flex items-center gap-1">
                    <AchievementIcon item={item} />
                    {item.isUnlocked ? "Unlocked" : "Locked"}
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in oklab,var(--surface) 80%,black)]">
                  <div
                    className={
                      item.isUnlocked
                        ? "h-full rounded-full bg-[linear-gradient(90deg,#f59e0b,#fde68a)]"
                        : "h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-alt))]"
                    }
                    style={{
                      width: `${Math.max(4, Math.min(100, item.progressPct))}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-(--muted)">
                  Progress: {item.progressValue.toFixed(0)} /{" "}
                  {item.targetValue.toFixed(0)} {item.progressUnit}
                </p>
              </article>
            ))}
          </div>
        </Card>

        <Card title="Account Security" subtitle="Manage your account backup options">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-xl border border-[var(--border)] p-4 bg-[var(--surface-solid)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <Key size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Recovery Code</h3>
                <p className="text-xs text-[var(--muted)]">Generate a new 6-digit recovery code if you lose your current one.</p>
              </div>
            </div>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="ui-btn ui-btn-primary whitespace-nowrap"
            >
              Regenerate Code
            </button>
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {activeLevelUp ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Level Up"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveLevelUp(null)}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-300/60 bg-[linear-gradient(145deg,rgba(250,204,21,0.28),rgba(251,146,60,0.12))] p-6 text-center shadow-[0_24px_70px_rgba(251,191,36,0.35)]"
              initial={{ y: 24, scale: 0.92, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 18, scale: 0.94, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 18 }}
              onClick={(event) => event.stopPropagation()}
            >
              <motion.div
                className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/80 bg-[color-mix(in oklab,#fbbf24 36%,white)] text-amber-950"
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
              >
                <Sparkles size={22} />
              </motion.div>

              <p className="text-xs uppercase tracking-[0.2em] text-amber-900/80">
                Level Up
              </p>
              <h2 className="mt-2 text-2xl font-bold text-amber-950">
                {toSkillLabel(activeLevelUp.skill)} reached Level{" "}
                {activeLevelUp.level}
              </h2>
              <p className="mt-2 text-sm text-amber-950/85">
                Keep the streak alive and push your next branch.
              </p>

              <button
                type="button"
                onClick={() => setActiveLevelUp(null)}
                className="mt-5 rounded-xl border border-amber-700/30 bg-amber-200/65 px-4 py-2 text-sm font-semibold text-amber-950"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-modal-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!newRecoveryCode) setShowPasswordModal(false);
            }}
          >
            <motion.div
              ref={recoveryModalRef}
              className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-6 shadow-2xl"
              initial={{ y: 20, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 20, scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {!newRecoveryCode ? (
                <>
                  <div className="mb-4 flex items-center gap-2 text-[var(--accent)]">
                    <Key size={24} />
                    <h3 id="recovery-modal-title" className="text-lg font-bold text-[var(--text)]">Security Check</h3>
                  </div>
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    Please enter your current password to regenerate your recovery code. The old code will be instantly invalidated.
                  </p>
                  
                  {regenerateError && (
                    <div className="mb-4 rounded-md bg-red-500/10 p-2 text-xs font-semibold text-red-500">
                      {regenerateError}
                    </div>
                  )}

                  <input
                    type="password"
                    placeholder="Current Password"
                    className="ui-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      onClick={() => {
                        setShowPasswordModal(false);
                        setCurrentPassword("");
                        setRegenerateError("");
                      }}
                      className="ui-btn ui-btn-ghost"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => regenerateCode(currentPassword)}
                      disabled={isRegenerating || currentPassword.length < 8}
                      className="ui-btn ui-btn-primary"
                    >
                      {isRegenerating ? "Verifying..." : "Regenerate"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                    <Code size={32} />
                  </div>
                  <h3 id="recovery-modal-title" className="text-lg font-bold text-[var(--text)]">New Recovery Code</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Save this 6-digit code in a secure place. It will only be shown once and your old code is no longer valid.
                  </p>

                  <div className="mt-6 rounded-xl bg-[var(--surface)] p-4 border border-[var(--border)]">
                    <div className="text-3xl font-mono tracking-[0.25em] text-[var(--accent)] text-center font-bold">
                      {newRecoveryCode}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyCode}
                    className="ui-btn ui-btn-primary mt-4 flex w-full items-center justify-center gap-2"
                  >
                    {isCopied ? <Check size={18} /> : <Code size={18} />}
                    {isCopied ? "Copied!" : "Copy to Clipboard"}
                  </button>
                  
                  <button
                    onClick={() => {
                      setNewRecoveryCode(null);
                      setShowPasswordModal(false);
                    }}
                    className="ui-btn ui-btn-ghost mt-3 w-full"
                  >
                    I have saved it
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
