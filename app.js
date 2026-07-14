const { useState, useEffect } = React;

// ---------- design tokens ----------
const T = {
  paper: "#F5F5F1",
  ink: "#141A2A",
  cobalt: "#2E4BE8",
  line: "#E3E3DC",
};
const DISPLAY = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";

const STATUSES = ["new", "researched", "contacted", "replied", "won", "lost"];
const STATUS_STYLE = {
  new: "bg-stone-100 text-stone-600",
  researched: "bg-indigo-50 text-indigo-700",
  contacted: "bg-amber-50 text-amber-700",
  replied: "bg-violet-50 text-violet-700",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-stone-200 text-stone-500",
};

// ---------- tiny inline icon set (no external icon package needed) ----------
function Icon({ path, size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {path}
    </svg>
  );
}
const IPlus = (p) => <Icon {...p} path={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>} />;
const ISparkles = (p) => <Icon {...p} path={<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z"/>} />;
const IMail = (p) => <Icon {...p} path={<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></>} />;
const ICopy = (p) => <Icon {...p} path={<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>} />;
const ICheck = (p) => <Icon {...p} path={<polyline points="20 6 9 17 4 12"/>} />;
const ITrash = (p) => <Icon {...p} path={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></>} />;
const ILoader = (p) => <Icon {...p} path={<path d="M21 12a9 9 0 11-6.219-8.56"/>} />;
const IMapPin = (p) => <Icon {...p} path={<><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>} />;
const IArrowLeft = (p) => <Icon {...p} path={<><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>} />;
const ICompass = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>} />;
const IGlobe = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 010 20 15 15 0 010-20z"/></>} />;
const IList = (p) => <Icon {...p} path={<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>} />;

// ---------- API helpers — talk to OUR server, which holds the real API key ----------
async function callClaude(prompt, useWebSearch = false) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, useWebSearch }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data.text;
}

function extractJSON(text) {
  const cleaned = text.replace(/```(json)?/gi, "").trim();
  const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i !== -1);
  if (!starts.length) throw new Error("The agent returned an unexpected format. Try again.");
  const start = Math.min(...starts);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function loadLeadsFromServer() {
  const res = await fetch("/api/leads");
  const data = await res.json();
  return data.leads || [];
}

async function saveLeadsToServer(leads) {
  await fetch("/api/leads", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leads }),
  });
}

// ---------- small pieces ----------
function StatusPill({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[status] || STATUS_STYLE.new}`}>
      {status}
    </span>
  );
}

function ScoreChip({ score }) {
  if (score == null) return null;
  const ring = score >= 8 ? "#059669" : score >= 5 ? "#D97706" : "#78716C";
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold bg-white"
      style={{ border: `2px solid ${ring}`, color: ring, fontFamily: DISPLAY }}
      title={`Fit score ${score}/10`}
    >
      {score}
    </span>
  );
}

function Eyebrow({ children }) {
  return (
    <div className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#8A8A80" }}>
      {children}
    </div>
  );
}

// ---------- main ----------
function LeadRadar() {
  const [leads, setLeads] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("pipeline");
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addLoc, setAddLoc] = useState("");
  const [addInd, setAddInd] = useState("");

  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [found, setFound] = useState([]);
  const [addedNames, setAddedNames] = useState([]);

  const [researchingId, setResearchingId] = useState(null);
  const [draftingId, setDraftingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const serverLeads = await loadLeadsFromServer();
        setLeads(serverLeads);
      } catch (e) {
        setError("Couldn't reach the server to load leads.");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function persist(next) {
    saveLeadsToServer(next).catch(() => setError("Couldn't save to the server. Your latest change may not persist."));
  }

  function saveLeads(next) {
    setLeads(next);
    persist(next);
  }

  function updateLead(id, patch, opts) {
    const persistNow = !opts || opts.persistNow !== false;
    const next = leads.map((l) => (l.id === id ? { ...l, ...patch } : l));
    setLeads(next);
    if (persistNow) persist(next);
  }

  function addLead({ name, location, industry, websiteStatus, signal }) {
    const lead = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: (name || "").trim(),
      location: (location || "").trim(),
      industry: (industry || "").trim(),
      websiteStatus: websiteStatus || "unknown",
      signal: signal || "",
      status: "new",
      research: null,
      outreach: null,
      notes: "",
      createdAt: new Date().toISOString(),
    };
    saveLeads([lead, ...leads]);
    return lead;
  }

  async function runResearch(lead) {
    setResearchingId(lead.id);
    setError("");
    try {
      const prompt =
        `You are a research agent for a freelance web designer. Use web search to research the business "${lead.name}"` +
        `${lead.industry ? ` (${lead.industry})` : ""}${lead.location ? ` in ${lead.location}` : ""}.` +
        `${lead.signal ? ` Earlier signal: ${lead.signal}.` : ""}\n` +
        `Assess: (1) do they have a website, and how modern/complete does it look, (2) their wider online presence (social pages, reviews, directory listings).\n` +
        `Then rate them 1-10 as a prospect for a website design project (10 = clearly needs a new or redesigned site AND looks like a real, reachable small business). Do not invent facts; if you can't verify something, say so.\n` +
        `Respond with ONLY this JSON, no markdown, no commentary:\n` +
        `{"summary":"2-3 factual sentences","websiteStatus":"none|outdated|weak|decent|good|unknown","opportunities":["up to 3 short, specific pitch angles"],"score":7,"scoreReason":"one sentence"}`;
      const text = await callClaude(prompt, true);
      const r = extractJSON(text);
      updateLead(lead.id, {
        research: {
          summary: r.summary || "",
          websiteStatus: r.websiteStatus || "unknown",
          opportunities: Array.isArray(r.opportunities) ? r.opportunities.slice(0, 3) : [],
          score: typeof r.score === "number" ? Math.max(1, Math.min(10, Math.round(r.score))) : null,
          scoreReason: r.scoreReason || "",
        },
        websiteStatus: r.websiteStatus || lead.websiteStatus,
        status: lead.status === "new" ? "researched" : lead.status,
      });
    } catch (e) {
      setError("Research agent failed: " + e.message);
    } finally {
      setResearchingId(null);
    }
  }

  async function runOutreach(lead) {
    setDraftingId(lead.id);
    setError("");
    try {
      const context = lead.research
        ? `What we verified: ${lead.research.summary} Pitch angles: ${(lead.research.opportunities || []).join("; ")}.`
        : `No research yet — keep the email general but relevant to a ${lead.industry || "local"} business.`;
      const prompt =
        `Draft a short cold outreach email (max 120 words) from a freelance web designer to "${lead.name}"` +
        `${lead.industry ? `, a ${lead.industry}` : ""}${lead.location ? ` in ${lead.location}` : ""}.\n` +
        `${context}\n` +
        `Tone: friendly, specific, zero hype, no exclamation marks. Reference something real about them. One low-pressure CTA (a quick call OR a free homepage mockup). Do not invent facts.\n` +
        `Respond with ONLY JSON: {"subject":"...","body":"..."}`;
      const text = await callClaude(prompt, false);
      const d = extractJSON(text);
      updateLead(lead.id, { outreach: { subject: d.subject || "", body: d.body || "" } });
    } catch (e) {
      setError("Outreach agent failed: " + e.message);
    } finally {
      setDraftingId(null);
    }
  }

  async function runDiscover() {
    if (!niche.trim() || !city.trim()) return;
    setDiscovering(true);
    setError("");
    setFound([]);
    try {
      const prompt =
        `You are a lead-sourcing agent for a freelance web designer. Use web search to find real, currently-operating small ${niche.trim()} businesses in ${city.trim()} that are good prospects for a new or redesigned website — meaning they appear to have no website, an outdated one, or only a social/directory presence.\n` +
        `Find up to 5. Only include businesses you actually found in search results — NEVER invent names. If you can't verify website status, use "unknown".\n` +
        `Respond with ONLY a JSON array, no markdown:\n` +
        `[{"name":"","location":"","industry":"","websiteStatus":"none|outdated|weak|unknown","signal":"one short sentence on why they're a good lead"}]`;
      const text = await callClaude(prompt, true);
      const results = extractJSON(text);
      setFound(Array.isArray(results) ? results.filter((r) => r && r.name) : []);
    } catch (e) {
      setError("Discovery agent failed: " + e.message);
    } finally {
      setDiscovering(false);
    }
  }

  const selected = leads.find((l) => l.id === selectedId) || null;
  const scored = leads.filter((l) => l.research && l.research.score != null);
  const avgScore = scored.length
    ? (scored.reduce((s, l) => s + l.research.score, 0) / scored.length).toFixed(1)
    : "—";
  const contactedCount = leads.filter((l) => ["contacted", "replied", "won"].includes(l.status)).length;

  async function copyEmail(lead) {
    const txt = `Subject: ${lead.outreach.subject}\n\n${lead.outreach.body}`;
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError("Couldn't copy — select the text manually.");
    }
  }

  return (
    <div className="min-h-screen" style={{ background: T.paper, color: T.ink }}>
      <div style={{ background: T.ink }} className="text-white">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: T.cobalt, boxShadow: "0 0 0 4px rgba(46,75,232,0.25)" }} />
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: DISPLAY }}>Lead Radar</h1>
          </div>
          <p className="text-sm mt-1 text-stone-300">
            Client prospecting for your web design studio — sourced, scored, and drafted by AI agents. You review and send.
          </p>
          <div className="flex gap-1 mt-4">
            {[{ id: "pipeline", label: "Pipeline", Icon: IList }, { id: "discover", label: "Discover", Icon: ICompass }].map((t) => (
              <button key={t.id} onClick={() => { setView(t.id); setSelectedId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors"
                style={view === t.id && !selected ? { background: T.paper, color: T.ink } : { background: "transparent", color: "#B9BDC9" }}>
                <t.Icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 pb-16">
        {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}

        {!loaded ? (
          <div className="flex items-center gap-2 text-stone-500 text-sm py-10 justify-center">
            <ILoader size={16} className="animate-spin" /> Loading your pipeline…
          </div>
        ) : selected ? (
          <div>
            <button onClick={() => { setSelectedId(null); setConfirmDelete(false); }} className="flex items-center gap-1 text-sm font-medium mb-4" style={{ color: T.cobalt }}>
              <IArrowLeft size={15} /> Back to pipeline
            </button>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: DISPLAY }}>{selected.name}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-stone-500">
                  {selected.location && <span className="flex items-center gap-1"><IMapPin size={13} /> {selected.location}</span>}
                  {selected.industry && <span>{selected.industry}</span>}
                  <span className="flex items-center gap-1 capitalize"><IGlobe size={13} /> site: {selected.websiteStatus}</span>
                </div>
              </div>
              <ScoreChip score={selected.research && selected.research.score} />
            </div>

            {selected.signal && <p className="mt-2 text-sm italic text-stone-500">“{selected.signal}”</p>}

            <div className="mt-4">
              <Eyebrow>Status</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => updateLead(selected.id, { status: s })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border transition-colors ${selected.status === s ? "" : "bg-white border-stone-200 text-stone-500"}`}
                    style={selected.status === s ? { background: T.ink, color: "white", borderColor: T.ink } : {}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 bg-white rounded-xl p-4 border" style={{ borderColor: T.line }}>
              <div className="flex items-center justify-between">
                <Eyebrow>Agent · Research + fit score</Eyebrow>
                <button onClick={() => runResearch(selected)} disabled={researchingId === selected.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: T.cobalt }}>
                  {researchingId === selected.id ? (<><ILoader size={14} className="animate-spin" /> Researching…</>) : (<><ISparkles size={14} /> {selected.research ? "Re-run" : "Run research"}</>)}
                </button>
              </div>
              {selected.research ? (
                <div className="mt-2 text-sm space-y-2">
                  <p>{selected.research.summary}</p>
                  {selected.research.opportunities && selected.research.opportunities.length > 0 && (
                    <div>
                      <div className="font-semibold text-xs uppercase tracking-wide text-stone-400 mb-1">Pitch angles</div>
                      <ul className="space-y-1">
                        {selected.research.opportunities.map((o, i) => (<li key={i} className="flex gap-2"><span style={{ color: T.cobalt }}>→</span> {o}</li>))}
                      </ul>
                    </div>
                  )}
                  {selected.research.scoreReason && <p className="text-stone-500">Score {selected.research.score}/10 — {selected.research.scoreReason}</p>}
                </div>
              ) : (
                <p className="mt-1 text-sm text-stone-500">One combined call researches the business via web search and scores its fit — combining steps keeps token costs down.</p>
              )}
            </div>

            <div className="mt-4 bg-white rounded-xl p-4 border" style={{ borderColor: T.line }}>
              <div className="flex items-center justify-between">
                <Eyebrow>Agent · Outreach draft</Eyebrow>
                <button onClick={() => runOutreach(selected)} disabled={draftingId === selected.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ background: T.ink }}>
                  {draftingId === selected.id ? (<><ILoader size={14} className="animate-spin" /> Drafting…</>) : (<><IMail size={14} /> {selected.outreach ? "Re-draft" : "Draft email"}</>)}
                </button>
              </div>
              {selected.outreach ? (
                <div className="mt-2 text-sm">
                  <div className="font-semibold">Subject: {selected.outreach.subject}</div>
                  <p className="mt-2 whitespace-pre-wrap">{selected.outreach.body}</p>
                  <button onClick={() => copyEmail(selected)} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: T.cobalt, color: T.cobalt }}>
                    {copied ? (<><ICheck size={13} /> Copied</>) : (<><ICopy size={13} /> Copy email</>)}
                  </button>
                  <p className="mt-2 text-xs text-stone-400">You send it — the human checkpoint. Verify details first; AI research can be imperfect.</p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-stone-500">Drafts a short, personalized first-touch email from the research summary only (not the full history) — leaner input, cheaper call.</p>
              )}
            </div>

            <div className="mt-4">
              <Eyebrow>Notes</Eyebrow>
              <textarea value={selected.notes} onChange={(e) => updateLead(selected.id, { notes: e.target.value }, { persistNow: false })}
                onBlur={() => persist(leads)} placeholder="Calls, replies, next steps…"
                className="w-full rounded-xl border bg-white p-3 text-sm min-h-20" style={{ borderColor: T.line }} />
            </div>

            <div className="mt-4">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => { saveLeads(leads.filter((l) => l.id !== selected.id)); setSelectedId(null); setConfirmDelete(false); }}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-600 text-white">Confirm delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="text-sm text-stone-500">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-sm text-stone-400"><ITrash size={14} /> Delete lead</button>
              )}
            </div>
          </div>
        ) : view === "pipeline" ? (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[{ label: "Leads", value: leads.length }, { label: "Avg fit", value: avgScore }, { label: "Contacted", value: contactedCount }].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border px-3 py-3 text-center" style={{ borderColor: T.line }}>
                  <div className="text-2xl font-bold" style={{ fontFamily: DISPLAY }}>{s.value}</div>
                  <div className="text-xs uppercase tracking-wide text-stone-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3">
              <Eyebrow>Pipeline</Eyebrow>
              <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 text-sm font-semibold" style={{ color: T.cobalt }}>
                <IPlus size={15} /> Add lead
              </button>
            </div>

            {showAdd && (
              <div className="bg-white rounded-xl border p-3 mb-3 space-y-2" style={{ borderColor: T.line }}>
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Business name *" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.line }} />
                <div className="flex gap-2">
                  <input value={addLoc} onChange={(e) => setAddLoc(e.target.value)} placeholder="City / area" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.line }} />
                  <input value={addInd} onChange={(e) => setAddInd(e.target.value)} placeholder="Industry" className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.line }} />
                </div>
                <button onClick={() => { if (!addName.trim()) return; addLead({ name: addName, location: addLoc, industry: addInd }); setAddName(""); setAddLoc(""); setAddInd(""); setShowAdd(false); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: T.ink }}>Save lead</button>
              </div>
            )}

            {leads.length === 0 ? (
              <div className="bg-white rounded-xl border p-6 text-center" style={{ borderColor: T.line }}>
                <p className="text-sm text-stone-500">No leads yet.</p>
                <button onClick={() => setView("discover")} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: T.cobalt }}>
                  <ICompass size={15} /> Discover your first prospects
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {leads.map((l) => (
                  <button key={l.id} onClick={() => { setSelectedId(l.id); setConfirmDelete(false); }}
                    className="w-full text-left bg-white rounded-xl border p-3 flex items-center gap-3 hover:shadow-sm transition-shadow" style={{ borderColor: T.line }}>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{l.name}</div>
                      <div className="text-xs text-stone-500 truncate">{[l.industry, l.location].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <StatusPill status={l.status} />
                    <ScoreChip score={l.research && l.research.score} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <Eyebrow>Agent · Lead discovery</Eyebrow>
            <p className="text-sm text-stone-500 mb-3">The sourcing agent searches the web for local businesses that likely need a new or better website, then hands them to your pipeline.</p>
            <div className="bg-white rounded-xl border p-3 space-y-2" style={{ borderColor: T.line }}>
              <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Niche — e.g. plumbers, dentists, cafes" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.line }} />
              <input value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runDiscover(); }} placeholder="City — e.g. Austin, TX" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: T.line }} />
              <button onClick={runDiscover} disabled={discovering || !niche.trim() || !city.trim()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: T.cobalt }}>
                {discovering ? (<><ILoader size={15} className="animate-spin" /> Searching the web…</>) : (<><ICompass size={15} /> Find leads</>)}
              </button>
            </div>

            {found.length > 0 && (
              <div className="mt-4 space-y-2">
                <Eyebrow>Found {found.length} candidate{found.length > 1 ? "s" : ""}</Eyebrow>
                {found.map((f, i) => {
                  const added = addedNames.includes(f.name);
                  return (
                    <div key={i} className="bg-white rounded-xl border p-3" style={{ borderColor: T.line }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold">{f.name}</div>
                          <div className="text-xs text-stone-500">
                            {[f.industry, f.location].filter(Boolean).join(" · ")}{f.websiteStatus ? ` · site: ${f.websiteStatus}` : ""}
                          </div>
                          {f.signal && <p className="text-sm mt-1 text-stone-600">{f.signal}</p>}
                        </div>
                        <button onClick={() => { if (added) return; addLead(f); setAddedNames([...addedNames, f.name]); }} disabled={added}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border"
                          style={added ? { borderColor: T.line, color: "#9CA3AF" } : { borderColor: T.cobalt, color: T.cobalt }}>
                          {added ? (<><ICheck size={13} /> Added</>) : (<><IPlus size={13} /> Add</>)}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-stone-400">Verify each business before outreach — search-sourced leads can be wrong or stale.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<LeadRadar />);
