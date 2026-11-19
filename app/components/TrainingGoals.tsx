"use client";
import Metric from "./Metric";
import { formatMetricNumber } from "../lib/activityMetrics";
import { activityAmount, activityUnit, isStrengthActivity } from "../lib/activity";
import { useEffect, useState } from "react";
import { CalendarDays, Save, Target } from "lucide-react";
import { getUserProfile, mergeUserProfile } from "../lib/services/users";
import { parseActivityDate } from "../lib/runData";
import type { ActivityType, RunData } from "../types";
type GoalRun = Pick<RunData, "km" | "type" | "timestamp" | "repetitions">;
export default function TrainingGoals({
  uid,
  type,
  runs,
  onSaved,
}: {
  uid: string;
  type: ActivityType;
  runs: GoalRun[];
  onSaved?: (monthly: number) => void;
}) {
  const strength = isStrengthActivity(type), unit = activityUnit(type);
  const [weekly, setWeekly] = useState("25"),
    [monthly, setMonthly] = useState("100"),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState({ weekly: 25, monthly: 100 });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setMessage("");
    getUserProfile(uid)
      .then((profile) => {
        if (!active) return;
        const legacy =
          profile?.progressGoals?.type === type
            ? profile.progressGoals
            : undefined;
        const goals = {
          weekly:
            Number(
              profile?.progressGoalsByType?.[type]?.weekly ?? legacy?.weekly,
            ) || 25,
          monthly:
            Number(
              profile?.progressGoalsByType?.[type]?.monthly ?? legacy?.monthly,
            ) || 100,
        };
        setWeekly(String(goals.weekly));
        setMonthly(String(goals.monthly));
        setSaved(goals);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setMessage("Cíle se nepodařilo načíst. Obnov stránku.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uid, type]);
  const now = new Date(),
    monthStart = new Date(now.getFullYear(), now.getMonth(), 1),
    weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  let weekKm = 0,
    monthKm = 0;
  for (const run of runs) {
    if ((run.type || "běh") !== type) continue;
    const date = parseActivityDate(run.timestamp),
      km = activityAmount(run);
    if (!date || date > now || !Number.isFinite(km) || km <= 0) continue;
    if (date >= weekStart) weekKm += km;
    if (date >= monthStart) monthKm += km;
  }
  const save = async () => {
    const w = Number(weekly),
      m = Number(monthly);
    if (!Number.isFinite(w) || !Number.isFinite(m) || w <= 0 || m <= 0 || (strength && (!Number.isInteger(w) || !Number.isInteger(m)))) {
      setMessage("Zadej kladný týdenní a měsíční cíl.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await mergeUserProfile(uid, {
        progressGoalsByType: { [type]: { weekly: w, monthly: m } },
        progressGoals: { weekly: w, monthly: m, type },
      });
      setSaved({ weekly: w, monthly: m });
      onSaved?.(m);
      setMessage("Cíle uloženy.");
    } catch {
      setMessage("Cíle se nepodařilo uložit. Zkus to znovu.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      className="progress-goal-settings tile"
      aria-labelledby="training-goals-title"
    >
      <div className="progress-section-title">
        <Target className="training-goals-icon" aria-hidden="true"/>
        <div>
          <h2 id="training-goals-title">Cíle a plnění</h2>
          <p>
            Všechny aktivity pro {type}. Aktuální týden a měsíc.
          </p>
        </div>
      </div>
      <details className="training-goals-editor">
        <summary>Upravit cíle</summary>
        <div className="progress-goal-inputs">
          <label>
            Týdenní cíl ({unit})
            <input
              type="number" step={strength ? "1" : "0.1"}
              min="0.1"
              value={weekly}
              disabled={loading || saving || failed}
              onChange={(e) => setWeekly(e.target.value)}
            />
          </label>
          <label>
            Měsíční cíl ({unit})
            <input
              type="number" step={strength ? "1" : "0.1"}
              min="0.1"
              value={monthly}
              disabled={loading || saving || failed}
              onChange={(e) => setMonthly(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="progress-save"
            onClick={() => void save()}
            disabled={loading || saving || failed}
          >
            <Save size={17} />
            {saving ? "Ukládám…" : "Uložit cíle"}
          </button>
        </div>
      </details>
      <div className="progress-goal-bars app-metric-grid metric-group-ruled">
        {[
          { name: "Tento týden", km: weekKm, goal: saved.weekly },
          { name: "Tento měsíc", km: monthKm, goal: saved.monthly },
        ].map((item) => (
          <div key={item.name}>
            <Metric icon={<CalendarDays/>} tone="target" label={item.name}
              value={`${formatMetricNumber(item.km, strength ? 0 : 2)} / ${formatMetricNumber(item.goal)}`}
              unit={unit} detail={`${Math.round((item.km / item.goal) * 100)} %`}/>
            <div className="progress-track">
              <i
                style={{
                  width: `${Math.min(100, (item.km / item.goal) * 100)}%`,
                }}
              />
            </div>
            <small className="training-goal-remaining">
              {item.km >= item.goal
                ? "Cíl splněn"
                : `Zbývá ${formatMetricNumber(item.goal - item.km, strength ? 0 : 2)} ${unit}`}
            </small>
          </div>
        ))}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
