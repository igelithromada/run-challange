import type { ReactNode } from "react";
import Link from "next/link";
import { Crown, Users } from "lucide-react";
import type { PublicProfileData } from "../types";
import UserAvatar from "./UserAvatar";

export default function PeopleList({ id, title, people, managerId, description, empty, children }: {
  id: string;
  title: string;
  people: PublicProfileData[];
  managerId?: string;
  description?: string;
  empty?: string;
  children?: ReactNode;
}) {
  return <section id={id} className="tile team-members-card" aria-labelledby={id + "-title"} tabIndex={-1}>
    <div className="progress-section-title">
      <Users aria-hidden="true"/>
      <div>
        <h2 id={id + "-title"}>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
    {people.length > 0 ? <ul className="team-members-list">
      {people.map(person => {
        const name = person.nickname || "Uživatel";
        return <li key={person.id}>
          <Link href={"/user/" + encodeURIComponent(person.id)} className="team-member-row" prefetch={false}>
            <UserAvatar name={name} url={person.avatarUrl} className="team-member-avatar"/>
            <span><strong>{name}</strong></span>
            {person.id === managerId && <Crown size={16} aria-label="Správce týmu" />}
          </Link>
        </li>;
      })}
    </ul> : empty && <p>{empty}</p>}
    {children}
  </section>;
}
