"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Copy, Save, Target, TrendingUp } from "lucide-react";
import { db, auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector, { ActivityType } from "../components/ActivityTypeSelector";

type Activity = { id: string; uid?: string; km?: number | string; type?: string; timestamp?: any };
type Plan = {
  weekKey: string;
  type: ActivityType;
  days: number[];
  dayKm: Record<string, number>;
  weeklyKm: number;
  createdAt?: string;
};
type HistoryItem = Plan & {
  completedKm: number;
  percent: number;
  status: "done" | "partial" | "missed";
  completedSessions: number;
  closedAt: string;
};

const DAY_NAMES = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const mondayOf = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const weekKey = (d: Date) => dateKey(mondayOf(d));
const activityDate = (r: Activity) => {
  const v = r.timestamp?.seconds
    ? r.timestamp.seconds * 1000
    : r.timestamp?.toDate
      ? r.timestamp.toDate().getTime()
      : Number(r.timestamp) || 0;
  return new Date(v);
};
const sameWeek = (d: Date, key: string) => weekKey(d) === key;
const weekRange = (key: string) => {
  const d = new Date(key + "T00:00:00");
  const e = new Date(d);
  e.setDate(e.getDate() + 6);
  return `${d.getDate()}.${d.getMonth() + 1}. – ${e.getDate()}.${e.getMonth() + 1}.${e.getFullYear()}`;
};

export default function TrainerPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [uid, setUid] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [days, setDays] = useState<number[]>([0, 2, 4]);
  const [dayKm, setDayKm] = useState<Record<number, string>>({ 0: "5", 2: "5", 4: "5" });
  const [type, setType] = useState<ActivityType>("běh");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<Activity[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState(100);
  const currentWeek = weekKey(new Date());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUid(user.uid);
      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        const data = profile.exists() ? profile.data() : {};
        const stored = data.personalTrainerPlan as Plan | undefined;
        const storedHistory = Array.isArray(data.personalTrainerHistory) ? data.personalTrainerHistory : [];

        const runSnap = await getDocs(query(collection(db, "runs"), where("uid", "==", user.uid)));
        const loadedRuns = runSnap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
        setRuns(loadedRuns);

        const goals = data.progressGoalsByType || {};
        const goalType = stored?.type || (data.progressGoals?.type === "chůze" ? "chůze" : "běh");
        setMonthlyGoal(num(goals[goalType]?.monthly ?? data.progressGoals?.monthly ?? 100) || 100);
        setHistory(storedHistory);

        if (stored?.weekKey === currentWeek) {
          setPlan(stored);
          setType(stored.type || "běh");
          setDays(Array.isArray(stored.days) ? stored.days : []);
          setDayKm(Object.fromEntries((stored.days || []).map(d => [d, String(stored.dayKm?.[String(d)] ?? 5)])));
        } else if (stored?.weekKey && stored.weekKey !== currentWeek) {
          const oldRuns = loadedRuns.filter(r => (r.type || "běh") === stored.type && sameWeek(activityDate(r), stored.weekKey));
          const completed = oldRuns.reduce((s, r) => s + num(r.km), 0);
          const pct = stored.weeklyKm ? Math.min(100, completed / stored.weeklyKm * 100) : 0;
          const sessions = stored.days.filter(d =>
            oldRuns.some(r => {
              const monday = new Date(stored.weekKey + "T00:00:00");
              monday.setDate(monday.getDate() + d);
              return dateKey(activityDate(r)) === dateKey(monday);
            })
          ).length;
          const item: HistoryItem = {
            ...stored,
            completedKm: completed,
            percent: pct,
            status: pct >= 100 ? "done" : pct > 0 ? "partial" : "missed",
            completedSessions: sessions,
            closedAt: new Date().toISOString()
          };
          const nextHistory = [item, ...storedHistory.filter((h: HistoryItem) => h.weekKey !== stored.weekKey)].slice(0, 52);
          await setDoc(doc(db, "users", user.uid), { personalTrainerHistory: nextHistory, personalTrainerPlan: null }, { merge: true });
          setHistory(nextHistory);
          setPlan(null);
          setDays([]);
          setDayKm({});
        } else {
          setPlan(null);
          setDays([]);
          setDayKm({});
        }
      } catch (error) {
        console.error("Nepodařilo se načíst osobního trenéra", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router, currentWeek]);

  const currentPlanDays = useMemo(
    () => days.map(d => {
      const date = mondayOf(new Date());
      date.setDate(date.getDate() + d);
      return date;
    }),
    [days]
  );

  const actualFor = (date: Date) =>
    runs
      .filter(r => (r.type || "běh") === type && dateKey(activityDate(r)) === dateKey(date))
      .reduce((s, r) => s + num(r.km), 0);

  const plannedTotal = useMemo(
    () => days.reduce((s, d) => s + Math.max(0, num(dayKm[d])), 0),
    [days, dayKm]
  );

  const statuses = DAY_NAMES.map((_, day) => {
    const date = new Date(mondayOf(new Date()));
    date.setDate(date.getDate() + day);
    const target = Math.max(0, num(dayKm[day]));
    const actual = actualFor(date);
    const today = new Date();
    const isPast = dateKey(date) < dateKey(today);
    const selected = days.includes(day);
    const status = !selected
      ? "off"
      : !isPast
        ? "waiting"
        : actual >= target && target > 0
          ? "done"
          : actual > 0
            ? "partial"
            : "missed";
    return { day, date, target, actual, selected, status };
  });

  const completedKm = statuses
    .filter(s => s.selected)
    .reduce((s, x) => s + Math.min(x.actual, x.target), 0);
  const percent = plannedTotal ? Math.min(100, completedKm / plannedTotal * 100) : 0;

  const toggleDay = (day: number) => {
    setDays(current =>
      current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day].sort((a, b) => a - b)
    );
    setDayKm(current => current[day] ? current : { ...current, [day]: "5" });
    setDirty(true);
  };

  const setKm = (day: number, value: string) => {
    setDayKm(current => ({ ...current, [day]: value }));
    setDirty(true);
  };

  const save = async () => {
    if (!uid || !days.length || plannedTotal <= 0) return;
    const next: Plan = {
      weekKey: currentWeek,
      type,
      days,
      dayKm: Object.fromEntries(days.map(d => [String(d), Math.max(0, num(dayKm[d]))])),
      weeklyKm: plannedTotal,
      createdAt: plan?.createdAt || new Date().toISOString()
    };
    await setDoc(doc(db, "users", uid), { personalTrainerPlan: next }, { merge: true });
    setPlan(next);
    setDirty(false);
  };

  const usePrevious = () => {
    const previous = history[0];
    if (!previous) return;
    setType(previous.type);
    setDays(previous.days);
    setDayKm(Object.fromEntries(previous.days.map(d => [d, String(previous.dayKm[String(d)] ?? 5)])));
    setPlan(null);
    setDirty(true);
  };

  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else if (item === "home") {
      router.push("/");
    } else if (item === "myrun") {
      router.push("/myruns");
    } else {
      router.push("/" + item);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar title="Osobní trenér" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
        <main className="container"><div className="tile"><p>Načítám osobního trenéra…</p></div></main>
      </>
    );
  }

  return (
    <>
      <Navbar title="Osobní trenér" onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} onSelect={handleSelect} />

      <main className="container progress-page trainer-page">
        <header className="progress-header">
          <span className="progress-eyebrow">PLÁN. POHYB. POSUN.</span>
          <h1>Osobní trenér</h1>
          <p>Nastav si dny a objem. Barva každého dne ukazuje, jak se ti plán daří plnit.</p>
        </header>

        <section className="tile trainer-plan-card">
          <div className="progress-section-title">
            <TrendingUp />
            <div>
              <h2>{plan ? "Tento týden" : "Nový týdenní plán"}</h2>
              <p>{weekRange(currentWeek)} · {type}</p>
            </div>
          </div>

          <ActivityTypeSelector
            value={type}
            onChange={value => { setType(value); setDirty(true); }}
            ariaLabel="Typ tréninku"
          />

          <div className="trainer-week-editor">
            {statuses.map(s => (
              <div className={`trainer-day-editor ${s.selected ? "selected" : "not-selected"} ${s.status}`} key={s.day}>
                <button
                  type="button"
                  className="trainer-day-toggle"
                  aria-pressed={s.selected}
                  onClick={() => toggleDay(s.day)}
                >
                  <span className="trainer-day-toggle-name">{DAY_NAMES[s.day]}</span>
                  <span className="trainer-day-toggle-date">{s.date.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}</span>
                  {s.selected && s.status !== "waiting" && <Check size={16} />}
                </button>

                <div className="trainer-day-description">
                  <strong>
                    {!s.selected ? "Volný den" : s.status === "done" ? "Splněno" : s.status === "partial" ? "Částečně" : s.status === "missed" ? "Nesplněno" : "Naplánováno"}
                  </strong>
                  <span>
                    {s.selected
                      ? s.status === "waiting"
                        ? "Trénink je před tebou"
                        : `${s.actual.toFixed(1)} / ${s.target.toFixed(1)} km`
                      : "Kliknutím zařadíš trénink"}
                  </span>
                </div>

                <label className="trainer-km-input">
                  <span>km</span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={dayKm[s.day] ?? ""}
                    disabled={!s.selected}
                    onChange={event => setKm(s.day, event.target.value)}
                    aria-label={`Plán na ${DAY_NAMES[s.day]} v kilometrech`}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="trainer-plan-footer">
            <div><span>Objem týdne</span><strong>{plannedTotal.toFixed(1)} km</strong></div>
            <div><span>Měsíční cíl</span><strong>{monthlyGoal.toFixed(0)} km</strong></div>
            {dirty && (
              <button type="button" className="progress-save" onClick={() => void save()}>
                <Save size={17} /> Uložit plán
              </button>
            )}
            {!plan && history.length > 0 && (
              <button type="button" className="trainer-secondary-button" onClick={usePrevious}>
                <Copy size={17} /> Použít minulý plán
              </button>
            )}
          </div>
        </section>

        <section className="tile trainer-summary-card">
          <div className="progress-section-title">
            <Target />
            <div>
              <h2>Plnění týdne</h2>
              <p>Počítají se pouze aktivity stejného typu jako aktuální plán.</p>
            </div>
          </div>
          <div className="trainer-score">
            <div><span>{completedKm.toFixed(1)} / {plannedTotal.toFixed(1)} km</span><strong>{percent.toFixed(0)} %</strong></div>
            <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
          </div>
          <div className="trainer-stats">
            <div><span>Splněné dny</span><strong>{statuses.filter(s => s.status === "done").length} / {days.length}</strong></div>
            <div><span>Plán vs. měsíční cíl</span><strong>{monthlyGoal ? Math.min(100, plannedTotal / monthlyGoal * 100).toFixed(0) : 0} %</strong></div>
          </div>
          <p className="trainer-goal-note">Měsíční cíl zůstává hlavní meta. Trenér ti jen rozloží část cesty do konkrétních dnů; co v plánu není, můžeš kdykoli doplnit volnou aktivitou.</p>
        </section>

        <section className="tile trainer-history-card">
          <div className="progress-section-title">
            <CalendarDays />
            <div><h2>Historie trenéra</h2><p>Uzavřené týdny zůstávají uložené pro přehled.</p></div>
          </div>
          {history.length ? (
            <div className="trainer-history-list">
              {history.slice(0, 12).map(h => (
                <details key={h.weekKey} className="trainer-history-item">
                  <summary>
                    <span>{weekRange(h.weekKey)}</span>
                    <b>{h.status === "done" ? "Splněn" : h.status === "partial" ? "Částečně" : "Nesplněn"}</b>
                    <strong>{h.percent.toFixed(0)} %</strong>
                  </summary>
                  <div>{h.type} · plán {h.weeklyKm.toFixed(1)} km · skutečnost {h.completedKm.toFixed(1)} km · {h.completedSessions}/{h.days.length} dnů</div>
                </details>
              ))}
            </div>
          ) : (
            <p className="trainer-empty">Zatím nemáš uzavřený žádný týden.</p>
          )}
        </section>
      </main>
    </>
  );
}
