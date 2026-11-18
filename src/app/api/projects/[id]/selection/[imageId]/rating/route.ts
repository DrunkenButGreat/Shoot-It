// Old clients wrote a shared row. Require a reload rather than accepting an unauthenticated guest identifier.
export async function PUT() {
  return Response.json({ error: 'Reload the gallery to use personal ratings.' }, { status: 410 })
}
