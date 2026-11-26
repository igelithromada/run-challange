"use client";
import { isStrengthActivity } from "../lib/activity";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import ResultsSummary from "../components/ResultsSummary";
import ResultsPersonRow from "../components/ResultsPersonRow";
import { auth } from "../lib/firebase";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ActivityTypeSelector from "../components/ActivityTypeSelector";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useSharedFirestoreQuery } from "../lib/useSharedFirestoreQuery";
import { filteredRunsQuery } from "../lib/services/runs";
import { getPublicProfiles } from "../lib/services/publicProfiles";
import {
  RESULT_ALPHABET,
  resultLetter,
  resultPeople,
  resultRuns,
  visiblePeople,
  type ResultPerson,
} from "../lib/results";
import type { ActivityType, PublicProfileData, RunData } from "../types";
export default function StatisticsPage() {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false),
    [uid, setUid] = useState(""),
    [selectedType, setSelectedType] = useState<ActivityType>("běh"),
    [view, setView] = useState<"já" | "jednotlivci">("jednotlivci"),
    [metric, setMetric] = useState<"km" | "tempo" | "repetitions">("km"),
    [sort, setSort] = useState<"rank" | "alpha">("rank"),
    [startDate, setStartDate] = useState(""),
    [endDate, setEndDate] = useState(""),
    [search, setSearch] = useState(""),
    [profiles, setProfiles] = useState<Record<string, PublicProfileData>>({}),
    [activeLetter, setActiveLetter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const listRef = useRef<HTMLElement>(null),
    alphabetRef = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const value = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (value === "běh" || value === "chůze" || value === "dřepy" || value === "kliky") setSelectedType(value);
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
    !invalidDates,
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
  const strength = isStrengthActivity(selectedType);
  const effectiveMetric = strength ? "repetitions" : metric === "repetitions" ? "km" : metric;
  const people = useMemo(
    () => resultPeople(filtered, profiles, effectiveMetric),
    [filtered, profiles, effectiveMetric],
  );
  const scope =
    view === "já" ? filtered.filter((run) => run.uid === uid) : filtered;
  const filterCount =
    Number(!!(startDate || endDate)) +
    Number(view === "já") +
    Number(sort === "alpha");
  const periodLabel =
    startDate || endDate
      ? `${startDate ? new Date(startDate + "T12:00:00").toLocaleDateString("cs-CZ") : "Od začátku"} – ${endDate ? new Date(endDate + "T12:00:00").toLocaleDateString("cs-CZ") : "dnes"}`
      : "Celé období";
  const visible = visiblePeople(
    view === "já" ? people.filter((p) => p.uid === uid) : people,
    search,
    sort === "alpha",
  );
  const letters = new Set(visible.map((p) => resultLetter(p.name)));
  const showPodium =
    view === "jednotlivci" && sort === "rank" && !search.trim();
  const ranked = people.filter((p) =>
    effectiveMetric === "km"
        ? p.km > 0
        : effectiveMetric === "repetitions" ? p.repetitions > 0 : p.pace > 0,
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
  const personRow = (person: ResultPerson, winner = false) => (
    <ResultsPersonRow type={selectedType}
      key={person.uid}
      person={person}
      metric={effectiveMetric}
      alpha={sort === "alpha"}
      mine={person.uid === uid}
      winner={winner}
      onOpen={() => router.push("/user/" + encodeURIComponent(person.uid))}
    />
  );
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
      />
      <main
        className={`container statistics-page unified-results${sort === "alpha" && view === "jednotlivci" ? " has-alphabet" : ""}`}
      >
        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} />
        <div
          className="results-main-tabs"
          role="group"
          aria-label="Hodnocené podle"
        >
          {(
            [
              ...(strength ? [{ id: "repetitions", label: "Opakování" }] as const : [{ id: "km", label: "Kilometry" }, { id: "tempo", label: "Tempo" }] as const),
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={effectiveMetric === item.id}
              onClick={() => setMetric(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="results-tools">
          <label className="results-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              placeholder="Najít člověka…"
              aria-label="Hledat uživatele podle přezdívky"
              onChange={(event) => {
                setSearch(event.target.value);
                if (event.target.value) setView("jednotlivci");
              }}
            />
          </label>
          <button
            type="button"
            className="results-filter-toggle"
            aria-expanded={!!filtersOpen}
            aria-controls="results-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={18} />
            Filtry{filterCount > 0 && <span>{filterCount}</span>}
          </button>
        </div>
        <section
          id="results-filters"
          className="results-filter-panel"
          hidden={!filtersOpen}
          aria-label="Filtry výsledků"
        >
          <label>
            Zobrazit výsledky
            <select
              value={view}
              onChange={(event) => {
                setView(event.target.value as "já" | "jednotlivci");
                setSearch("");
              }}
            >
              <option value="jednotlivci">Jednotlivci</option>
              <option value="já">Já</option>
            </select>
          </label>
          <label>
            Řazení
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "rank" | "alpha")
              }
            >
              <option value="rank">
                {effectiveMetric === "tempo"
                    ? "Podle tempa"
                    : effectiveMetric === "repetitions" ? "Podle opakování" : "Podle kilometrů"}
              </option>
              <option value="alpha">Podle abecedy</option>
            </select>
          </label>
          <label>
            Od data
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            Do data
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <div className="results-filter-actions">
            <button
              type="button"
              onClick={() => {
                setView("jednotlivci");
                setSort("rank");
                setStartDate("");
                setEndDate("");
                setSearch("");
              }}
            >
              Zrušit filtry
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)}>
              Hotovo
            </button>
          </div>
        </section>
        <p className="results-context">
          {view === "já" ? "Moje výsledky" : "Všichni účastníci"} ·{" "}
          {periodLabel}
          {sort === "alpha" && view !== "já" ? " · Abecedně" : ""}
        </p>
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
        {!invalidDates && (state.loading && !state.data.length ? (
          <LoadingSkeleton count={3} />
        ) : (
          <>
            <ResultsSummary
              runs={scope}
              metric={effectiveMetric}
              type={selectedType}
              mine={view === "já"}
            />
            {search.trim() && (
              <p className="chart-hint">
                Nalezeno: {visible.length}. Souhrn nahoře platí pro celé zvolené
                období.
              </p>
            )}
            {!!podium.length && (
              <section className="results-section results-leaders">
                <h2>Stupně vítězů</h2>
                <div className="unified-results-list results-compact-list">
                  {podium.map((p) => personRow(p, true))}
                </div>
              </section>
            )}
            <section
              ref={listRef}
              className="unified-results-list results-compact-list"
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
        ))}
        {!invalidDates && sort === "alpha" && view === "jednotlivci" && visible.length > 0 && (
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
