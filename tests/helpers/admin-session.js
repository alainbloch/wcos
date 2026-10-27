export async function adminSession(app, authCookie) {
  const response = await app.inject({
    url: "/admin/schema-api/catalog",
    headers: { cookie: authCookie },
  });
  if (response.statusCode !== 200)
    throw new Error("Unable to initialize admin session");
  const session = response.cookies.find(
    (cookie) => cookie.name === "sessionId",
  );
  return {
    cookie: authCookie + (session ? `; sessionId=${session.value}` : ""),
    csrf: response.json().csrf,
  };
}
