module.exports = async function handler(req, res) {
  const target = req.query && req.query.url ? String(req.query.url) : "";

  if (!target) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Missing ?url=" }));
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid URL" }));
    return;
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Only http/https are allowed" }));
    return;
  }

  const fetchHTML = async (url) =>
    fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
        Referer: new URL(url).origin + "/",
      },
    });

  try {
    let upstream = await fetchHTML(parsed.href);
    let body = await upstream.text();
    let statusCode = upstream.status;

    // Demotywatory often blocks server-side page fetches (403) from cloud hosts.
    // In that case, serve RSS feed so frontend can still extract image URLs.
    if (statusCode === 403 && parsed.hostname.includes("demotywatory.pl")) {
      const rssURL = "https://demotywatory.pl/rss";
      const rssResponse = await fetchHTML(rssURL);
      const rssBody = await rssResponse.text();

      if (rssResponse.ok && rssBody) {
        body = rssBody;
        statusCode = 200;
      }
    }

    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.end(body);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: "Proxy fetch failed",
        details: err && err.message ? err.message : String(err),
      })
    );
  }
};
