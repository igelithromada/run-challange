"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Gauge,
  ListChecks,
  MapPin,
  Search,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { filteredRunsQuery } from "../lib/services/runs";
import { getPublicProfiles } from "../lib/services/publicProfiles";
import { activityMetrics, formatPace } from "../lib/activityMetrics";
import {
  RESULT_ALPHABET,
  formatResultDuration,
  resultLetter,
  resultPeople,
  resultRuns,
  visiblePeople,
  type ResultPerson,
} from "../lib/results";
import { activityAwards } from "../lib/awards";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import type { ActivityType, PublicProfileData, RunData } from "../types";
export default function StatisticsPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false),
    [uid, setUid] = useState(""),
    [selectedType, setSelectedType] = useState<ActivityType>("běh"),
    [view, setView] = useState<"já" | "jednotlivci">("jednotlivci"),
    [metric, setMetric] = useState<"km" | "tempo" | "badges">("km"),
    [sort, setSort] = useState<"rank" | "alpha">("rank"),
    [startDate, setStartDate] = useState(""),
    [endDate, setEndDate] = useState(""),
    [search, setSearch] = useState(""),
    [profiles, setProfiles] = useState<Record<string, PublicProfileData>>({}),
    [activeLetter, setActiveLetter] = useState("");
  const listRef = useRef<HTMLElement>(null),
    alphabetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const value = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (value === "běh" || value === "chůze") setSelectedType(value);
    } catch {}
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUid("");
        setProfiles({});
        router.push("/login");
      } else setUid(user.uid);
    });
  }, [router]);
  const invalidDates = !!startDate && !!endDate && startDate > endDate;
  const query = useMemo(
    () =>
      filteredRunsQuery(
        invalidDates ? undefined : startDate || undefined,
        invalidDates ? undefined : endDate || undefined,
      ),
    [startDate, endDate, invalidDates],
  );
  const state = useSharedFirestoreQuery<RunData>(
    `runs:statistics:${invalidDates ? "invalid" : startDate || "all"}:${endDate || "all"}`,
    query,
  );
  const filtered = useMemo(
    () => resultRuns(state.data, selectedType, startDate, endDate),
    [state.data, selectedType, startDate, endDate],
  );
  useEffect(() => {
    let active = true;
    const ids = [...new Set(filtered.map((run) => run.uid))];
    if (!ids.length) {
      setProfiles({});
      return;
    }
    void getPublicProfiles(ids).then((next) => {
      if (active) setProfiles(next);
    });
    return () => {
      active = false;
    };
  }, [filtered]);
  const people = useMemo(
    () => resultPeople(filtered, profiles, metric),
    [filtered, profiles, metric],
  );
  const scope =
    view === "já" ? filtered.filter((run) => run.uid === uid) : filtered;
  const totals = activityMetrics(scope),
    participantCount = new Set(scope.map((run) => run.uid)).size;
  const visible = visiblePeople(
    view === "já" ? people.filter((p) => p.uid === uid) : people,
    search,
    sort === "alpha",
  );
  const letters = new Set(visible.map((p) => resultLetter(p.name)));
  const showPodium =
    view === "jednotlivci" && sort === "rank" && !search.trim();
  const ranked = people.filter((p) =>
    metric === "badges"
      ? p.awardCount > 0
      : metric === "km"
        ? p.km > 0
        : p.pace > 0,
  );
  const podium = showPodium ? ranked.slice(0, 3) : [];
  const podiumIds = new Set(podium.map((p) => p.uid));
  const rows = visible.filter((p) => !podiumIds.has(p.uid));
  const jump = (letter: string) => {
    if (!letters.has(letter)) return;
    setActiveLetter(letter);
    const element = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-letter]") || [],
    ).find((node) => node.dataset.letter === letter);
    element?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const personRow = (person: ResultPerson, podiumRow = false) => (
    <div key={person.uid}>
      <button
        type="button"
        className={`unified-person-row${podiumRow ? ` is-podium rank-${person.rank}` : ""}${person.uid === uid ? " is-mine" : ""}`}
        onClick={() => router.push("/user/" + encodeURIComponent(person.uid))}
        aria-label={`Profil ${person.name}`}
      >
        <span className="unified-rank">
          {sort === "alpha" ? null : podiumRow ? (
            <Trophy size={19} />
          ) : (
            person.rank
          )}
        </span>
        <span className="activity-avatar">
          {person.avatarUrl ? (
            <img
              src={cloudinaryImageUrl(person.avatarUrl, 96)}
              alt=""
              loading="lazy"
            />
          ) : (
            person.name.charAt(0).toUpperCase()
          )}
        </span>
        <span className="unified-person-main">
          <strong>
            {person.name}
            {person.uid === uid ? " · ty" : ""}
          </strong>
          <small>
            {person.count} aktivit · {formatResultDuration(person.minutes)}
          </small>
          <small>Průměrné tempo {formatPace(person.pace)}</small>
        </span>
        <span className="unified-person-value">
          <strong>
            {metric === "badges"
              ? `${person.awardCount} odznaků`
              : metric === "tempo"
                ? formatPace(person.pace)
                : `${person.km.toFixed(2)} km`}
          </strong>
          {metric === "tempo" && <small>{person.km.toFixed(2)} km</small>}
          {podiumRow && <small>{person.rank}. místo</small>}
        </span>
      </button>
      {metric === "badges" && (
        <details className="result-award-details">
          <summary>Počty jednotlivých odznaků</summary>
          <div>
            {person.awards.map((award) => (
              <span key={award.id}>
                {award.title}
                <b>{award.count}×</b>
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
  const handleSelect = async (item: string) => {
    setMenuVisible(false);
    if (item === "logout") {
      await signOut(auth);
      router.push("/login");
    } else
      router.push(
        item === "home" ? "/" : item === "myrun" ? "/myruns" : "/" + item,
      );
  };
  return (
    <>
      <Navbar
        title="Výsledky"
        onMenuClick={() => setMenuVisible(true)}
        onHomeClick={() => router.push("/")}
      />
      <Sidebar
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onSelect={handleSelect}
      />
      <main
        className={`container statistics-page unified-results${sort === "alpha" && view === "jednotlivci" ? " has-alphabet" : ""}`}
      >
        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} />
        <label className="results-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            placeholder="Hledat přezdívku…"
            aria-label="Hledat uživatele podle přezdívky"
            onChange={(e) => {
              setSearch(e.target.value);
              if (e.target.value) setView("jednotlivci");
            }}
          />
        </label>
        <div className="control-caption">Zobrazit výsledky</div>
        <div className="tile-group">
          <button
            type="button"
            className={`tile-button ${view === "já" ? "active" : ""}`}
            aria-pressed={view === "já"}
            onClick={() => {
              setView("já");
              setSearch("");
            }}
          >
            <User size={20} />
            Já
          </button>
          <button
            type="button"
            className={`tile-button ${view === "jednotlivci" ? "active" : ""}`}
            aria-pressed={view === "jednotlivci"}
            onClick={() => setView("jednotlivci")}
          >
            <Users size={20} />
            Jednotlivci
          </button>
        </div>
        <div className="control-caption">Hodnocené podle</div>
        <div className="tile-group">
          <button
            type="button"
            className={`tile-button ${metric === "km" ? "active" : ""}`}
            aria-pressed={metric === "km"}
            onClick={() => setMetric("km")}
          >
            Km
          </button>
          <button
            type="button"
            className={`tile-button ${metric === "tempo" ? "active" : ""}`}
            aria-pressed={metric === "tempo"}
            onClick={() => setMetric("tempo")}
          >
            Tempo
          </button>
          <button
            type="button"
            className={`tile-button ${metric === "badges" ? "active" : ""}`}
            aria-pressed={metric === "badges"}
            onClick={() => setMetric("badges")}
          >
            Odznaky
          </button>
        </div>
        <div className="tile date-filter">
          <label className="date-field">
            <span>Od data</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="date-field">
            <span>Do data</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          {(startDate || endDate) && (
            <button
              type="button"
              className="date-clear"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Zrušit filtr
            </button>
          )}
        </div>
        {invalidDates && (
          <p role="alert">Datum od nesmí být později než datum do.</p>
        )}
        {state.error && (
          <p role="status">
            Výsledky se nepodařilo obnovit.
            {state.data.length
              ? " Zobrazuji poslední načtené údaje."
              : " Zkus stránku obnovit."}
          </p>
        )}
        {state.loading && !state.data.length ? (
          <LoadingSkeleton count={3} />
        ) : (
          <>
            <section
              className="unified-results-summary"
              aria-label={
                view === "já" ? "Souhrn mých výsledků" : "Souhrn všech výsledků"
              }
            >
              {[
                {
                  label: "Celkem km",
                  value: `${totals.km.toFixed(2)} km`,
                  Icon: MapPin,
                },
                {
                  label: "Čas",
                  value: formatResultDuration(totals.minutes),
                  Icon: Clock3,
                },
                {
                  label: "Průměrné tempo",
                  value: formatPace(totals.pace),
                  Icon: Gauge,
                },
                {
                  label: "Aktivity",
                  value: String(totals.count),
                  Icon: ListChecks,
                },
                {
                  label: "Účastníci",
                  value: String(participantCount),
                  Icon: Users,
                },
              ].map((item) => (
                <div className="tile" key={item.label}>
                  <item.Icon size={20} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </section>

            {view === "jednotlivci" && (
              <div
                className="participant-sort"
                role="group"
                aria-label="Řazení výsledků"
              >
                <button
                  type="button"
                  className={`participant-sort-button${sort === "rank" ? " active" : ""}`}
                  aria-pressed={sort === "rank"}
                  onClick={() => setSort("rank")}
                >
                  {metric === "badges"
                    ? "Podle odznaků"
                    : metric === "tempo"
                      ? "Podle tempa"
                      : "Podle kilometrů"}
                </button>
                <button
                  type="button"
                  className={`participant-sort-button${sort === "alpha" ? " active" : ""}`}
                  aria-pressed={sort === "alpha"}
                  onClick={() => setSort("alpha")}
                >
                  Podle abecedy
                </button>
              </div>
            )}
            {search.trim() && (
              <p className="chart-hint">
                Nalezeno: {visible.length}. Souhrn nahoře platí pro celé zvolené
                období.
              </p>
            )}
            {metric === "badges" && (
              <section
                className="community-awards"
                aria-label="Celkové vyhodnocení odznaků"
              >
                <h2>Odznaky a úspěchy</h2>
                <p className="chart-hint">
                  Vyhodnocení za zvolené období a kategorii. Jednorázové odznaky
                  se počítají nejvýše 1×, ranní a noční za každou odpovídající
                  aktivitu.
                </p>
                <strong>
                  Celkem{" "}
                  {(view === "já"
                    ? people.filter((p) => p.uid === uid)
                    : people
                  ).reduce((sum, p) => sum + p.awardCount, 0)}{" "}
                  odznaků
                </strong>
                <div
                  className="progress-badges-scroll"
                  role="group"
                  tabIndex={0}
                  aria-label="Počty odznaků v komunitě"
                >
                  {(people[0]?.awards || activityAwards([], selectedType)).map(
                    (award) => (
                      <article className="progress-badge" key={award.id}>
                        <span aria-hidden="true">{award.icon}</span>
                        <div>
                          <strong>{award.title}</strong>
                          <p>
                            {(view === "já"
                              ? people.filter((p) => p.uid === uid)
                              : people
                            ).reduce(
                              (sum, p) =>
                                sum +
                                (p.awards.find((a) => a.id === award.id)
                                  ?.count || 0),
                              0,
                            )}
                            ×
                          </p>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </section>
            )}
            {!!podium.length && (
              <section className="results-section">
                <h2>Stupně vítězů</h2>
                <div className="unified-results-list">
                  {podium.map((p) => personRow(p, true))}
                </div>
              </section>
            )}
            <section
              ref={listRef}
              className="unified-results-list"
              aria-label="Seznam účastníků a výsledků"
            >
              {!visible.length ? (
                <p>Pro tento výběr nebyl nalezen žádný uživatel.</p>
              ) : (
                rows.map((person, index) => (
                  <React.Fragment key={person.uid}>
                    {view === "jednotlivci" &&
                      sort === "alpha" &&
                      (index === 0 ||
                        resultLetter(rows[index - 1].name) !==
                          resultLetter(person.name)) && (
                        <h3
                          className="results-letter-heading"
                          data-letter={resultLetter(person.name)}
                        >
                          {resultLetter(person.name)}
                        </h3>
                      )}
                    {personRow(person)}
                  </React.Fragment>
                ))
              )}
            </section>
          </>
        )}
        {sort === "alpha" && view === "jednotlivci" && visible.length > 0 && (
          <nav
            ref={alphabetRef}
            className="results-alphabet"
            aria-label="Abecední navigace"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const rect = event.currentTarget.getBoundingClientRect();
              jump(
                RESULT_ALPHABET[
                  Math.max(
                    0,
                    Math.min(
                      RESULT_ALPHABET.length - 1,
                      Math.floor(
                        ((event.clientY - rect.top) / rect.height) *
                          RESULT_ALPHABET.length,
                      ),
                    ),
                  )
                ],
              );
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              const rect = event.currentTarget.getBoundingClientRect();
              jump(
                RESULT_ALPHABET[
                  Math.max(
                    0,
                    Math.min(
                      RESULT_ALPHABET.length - 1,
                      Math.floor(
                        ((event.clientY - rect.top) / rect.height) *
                          RESULT_ALPHABET.length,
                      ),
                    ),
                  )
                ],
              );
            }}
          >
            {RESULT_ALPHABET.map((letter) => (
              <button
                type="button"
                key={letter}
                disabled={!letters.has(letter)}
                aria-label={`Přejít na ${letter}`}
                aria-current={activeLetter === letter ? "location" : undefined}
                onClick={() => jump(letter)}
              >
                {letter}
              </button>
            ))}
          </nav>
        )}
      </main>
    </>
  );
}
