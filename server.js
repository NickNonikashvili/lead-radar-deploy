require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "leads.json");
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.warn(
    "WARNING: ANTHROPIC_API_KEY is not set. Create a .env file (see .env.example) before using the agents."
  );
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- leads storage (simple JSON file — swap for a real DB later if you outgrow this) ----------
function readLeads() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeLeads(leads) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

app.get("/api/leads", (req, res) => {
  res.json({ leads: readLeads() });
});

app.put("/api/leads", (req, res) => {
  const { leads } = req.body || {};
  if (!Array.isArray(leads)) {
    return res.status(400).json({ error: "Body must include a 'leads' array." });
  }
  try {
    writeLeads(leads);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not save leads to disk." });
  }
});

// ---------- Claude proxy — this is the piece that keeps your API key off the client ----------
app.post("/api/claude", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY. Add it to .env and restart." });
  }
  const { prompt, useWebSearch, model, maxTokens } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Body must include a 'prompt' string." });
  }

  const body = {
    model: model || "claude-sonnet-4-6",
    max_tokens: maxTokens || 1000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.error?.message || "Anthropic API error" });
    }
    const text = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
    res.json({ text, usage: data.usage || null });
  } catch (e) {
    res.status(500).json({ error: "Failed to reach Anthropic API: " + e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Lead Radar running at http://localhost:${PORT}`);
});
