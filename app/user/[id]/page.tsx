"use client";
import ActivityLevelButton from "../../components/ActivityLevelButton";
import { useScoringDay } from "../../lib/useScoringDay";
import { useRunningPointsRules } from "../../lib/useRunningPointsRules";
import { activityPoints } from "../../lib/activityPoints";
import UserAvatar from "../../components/UserAvatar";
import PhotoViewer from "../../components/PhotoViewer";
import { activityAmount, activityUnit, isStrengthActivity } from "../../lib/activity";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "../../components/Navbar";
import Sidebar from "../../components/Sidebar";
import ActivityCard from "../../components/ActivityCard";
import ActivityTypeSelector, { ActivityType } from "../../components/ActivityTypeSelector";
import { getPublicProfile } from "../../lib/services/publicProfiles";
import { userRunsQuery } from "../../lib/services/runs";
import { allTeamsQuery } from "../../lib/services/teams";
import { useSharedFirestoreQuery } from "../../lib/useSharedFirestoreQuery";

type RunData = {
  id: string; uid?: string; email?: string; nickname?: string; avatarUrl?: string;
  repetitions?:number; km: number; minuty: number; tempo: number | string; type?: string; teamId?: string;
  imageUrls?: string[]; imageUrl?: string; timestamp?: { seconds: number }; likedBy?: string[]; likeCount?: number; commentCount?: number;
};

export default function UserPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType>("běh");
  useEffect(() => {
    try {
      const cached = localStorage.getItem("dolni-lhota-default-activity-v1");
      if (cached === "běh" || cached === "chůze" || cached === "dřepy" || cached === "kliky") setSelectedType(cached);
    } catch {}
  }, []);
  const [authUid, setAuthUid] = useState("");
  useEffect(() => onAuthStateChanged(auth, user => { setAuthUid(user?.uid || ""); if(!user)router.replace("/login"); }), [router]);
  const [userInfo, setUserInfo] = useState({ nickname: "", avatarUrl: "" });
  const [showImages, setShowImages] = useState<string[] | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const runsQuery = useMemo(() => userRunsQuery(id || "__none__"), [id]);
  const runsState = useSharedFirestoreQuery<RunData>(`user-runs:${id || "none"}`, runsQuery);
  const teamsQuery = useMemo(() => allTeamsQuery(1000), []);
  const teamsState = useSharedFirestoreQuery<{ id: string; name?: string }>("teams:all:1000", teamsQuery);

  const runs = useMemo(() => {
    const items = runsState.data.map(item => ({
      ...item,
      km: Number(item.km) || 0,
      minuty: Number(item.minuty) || 0,
      tempo: Number(item.tempo) || 0,
    })) as RunData[];
    return items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  }, [runsState.data]);

  const teams = teamsState.data;
  const scoringDay = useScoringDay();
  const { rules } = useRunningPointsRules();
  const score = useMemo(() => rules ? activityPoints(runsState.data, scoringDay ? undefined : 0, rules) : undefined, [runsState.data, scoringDay, rules]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const profile = await getPublicProfile(id);
        if (profile) setUserInfo({ nickname: profile.nickname || "", avatarUrl: profile.avatarUrl || "" });
      } catch (error) { console.error("Nepodařilo se načíst profil uživatele", error); }
    };
    if (id && authUid) void fetchUser();
  }, [id, authUid]);

  const runNickname = runs.find(run => typeof run.nickname === "string" && run.nickname.trim())?.nickname?.trim() || "";
  const runEmailName = runs.find(run => typeof run.email === "string" && run.email.trim())?.email?.split("@")[0]?.trim() || "";
  const profileName = userInfo.nickname || runNickname || runEmailName || "Uživatel";
  const filteredRuns = runs.filter(run => (run.type || "běh") === selectedType);

  const showRunImages = (images: string[], fallback: string, startIndex = 0) => {
    const urls = images.length ? images : fallback ? [fallback] : [];
    if (!urls.length) return;
    setShowImages(urls);
    setCurrentImageIndex(Math.max(0, Math.min(startIndex, urls.length - 1)));
  };

  return (
    <>
      <Navbar title={profileName} onMenuClick={() => setMenuVisible(true)} onHomeClick={() => router.push("/")} />
      <Sidebar visible={menuVisible} onClose={() => setMenuVisible(false)} />
      <main className="container user-page-modern">
        <header className="user-page-header">
          <UserAvatar name={profileName} url={userInfo.avatarUrl}/>
          <div><span className="user-page-eyebrow">AKTIVITY UŽIVATELE</span><h1>{profileName}{id && score && !runsState.loading && (!runsState.error || runsState.data.length > 0) && <ActivityLevelButton key={id} nickname={profileName} score={score}/>}</h1><p>{filteredRuns.length} {filteredRuns.length === 1 ? "aktivita" : filteredRuns.length < 5 ? "aktivity" : "aktivit"} · {filteredRuns.reduce((sum, run) => sum + activityAmount(run), 0).toLocaleString("cs-CZ",{maximumFractionDigits:isStrengthActivity(selectedType)?0:1})} {activityUnit(selectedType)}</p></div>
        </header>

        <ActivityTypeSelector value={selectedType} onChange={setSelectedType} ariaLabel="Typ aktivity" />

        <div className="list-container user-activity-list">
          {filteredRuns.map(run => {
            const teamName = run.teamId ? teams.find(team => team.id === run.teamId)?.name || null : null;

            return (
              <ActivityCard
                key={run.id}
                run={run}
                levelScore={score}
                teamName={teamName}
                activityType={selectedType}
                onPhotosClick={showRunImages}
              />
            );
          })}
        </div>

        {!filteredRuns.length && <div className="tile activity-empty-state"><strong>Žádné záznamy</strong><p>Tento uživatel zatím nemá pro zvolený typ aktivity žádný záznam.</p></div>}
      </main>

      {showImages && showImages.length>0 && <PhotoViewer url={showImages[currentImageIndex]} onClose={()=>setShowImages(null)} onMove={direction=>setCurrentImageIndex(index=>(index+direction+showImages.length)%showImages.length)}/>}

    </>
  );
}
