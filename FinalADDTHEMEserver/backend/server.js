import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());


const TMDB_KEY = '2b71653ad417d0dcdbf037c626bb8e99';
const GEMINI_KEY = 'AIzaSyDlHtPmI6HB5vQe9qWBkHgkf_IQRbuKbBY';
const TMDB_LANG = "en-US";
const IMG_BASE  = "https://image.tmdb.org/t/p";

// test route
app.get("/", (req, res) => {
  res.send("Backend running on port 3222 🚀");
});

// ====== TMDb proxy ======
app.get("/api/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false&language=${TMDB_LANG}`;
  const r = await fetch(url);
  const j = await r.json();
  res.json(j);
});

app.get("/api/movie/:id", async (req, res) => {
  const url = `https://api.themoviedb.org/3/movie/${req.params.id}?api_key=${TMDB_KEY}&language=${TMDB_LANG}`;
  const r = await fetch(url);
  const j = await r.json();
  res.json(j);
});

// ====== Gemini LLM ======
app.post("/api/recommend", async (req, res) => {
  const movieList = req.body.list;
  const compact = movieList.map(m => ({
    title: m.title,
    year: m.year || "",
    genres: m.genre,
    rating: m.rating,
    overview: (m.review||"").slice(0, 300)
  }));

  const prompt = `
You are a movie expert. Given a user's movie list, recommend exactly 3 other movies that the user is likely to enjoy.
Return only valid JSON like:
{"recommendations":[{"title":"", "year":2000, "reason":""}, {...}, {...}]}

User's list:
${JSON.stringify(compact, null, 2)}
`;

  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await r.json();
  res.json(data);
});


const PORT = 3222;
app.listen(PORT, () => console.log(`Backend running at http://localhost:${PORT}`));
