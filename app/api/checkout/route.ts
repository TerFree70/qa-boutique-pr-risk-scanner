export async function POST() {
  const plan = 'startup';

  return Response.json({
    ok: true,
    checkoutUrl: `/checkout?plan=${plan}`,
  });
}
