import { Users } from "lucide-react";
import { cloudinaryImageUrl } from "../lib/imageUrl";
import type { TeamData } from "../types";
import { RecordCardHeading } from "./ActivityCardContent";

export default function TeamCardContent({ team, joined, detail = false }: {
  team: TeamData;
  joined?: boolean;
  detail?: boolean;
}) {
  const Heading = detail ? "h1" : "h3";
  const count = team.memberCount || 0;
  const members = count === 1 ? "člen" : count >= 2 && count <= 4 ? "členové" : "členů";
  return <>
    <RecordCardHeading title={<Heading>{team.name}</Heading>}
      avatar={<span className="activity-avatar" aria-hidden="true">
        {team.avatarUrl ? <img src={cloudinaryImageUrl(team.avatarUrl, 96)} alt="" loading="lazy" decoding="async"/> : <Users size={22}/>}
      </span>}
      meta={joined && <span className="team-member-label">Jsi členem</span>}
    >
      <small className="activity-kind-label">{count} {members}</small>
    </RecordCardHeading>
    {team.description?.trim() && <div className="activity-description">{team.description.trim()}</div>}
  </>;
}
