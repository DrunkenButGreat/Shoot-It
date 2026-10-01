// A participant's own profile takes precedence over the project-specific fallback.
export function getParticipantPortrait(participant: {
  user?: { image: string | null } | null;
  images: { path: string; thumbnail?: string | null }[];
}) {
  return participant.user?.image || participant.images[0]?.thumbnail || participant.images[0]?.path;
}
