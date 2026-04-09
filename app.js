/* ============================================
   Navigation Data & App Logic
   ============================================ */

const NAV_DATA = [
  {
    label: 'Fundamentals',
    icon: '📚',
    items: [
      { icon: '⚙️', label: 'Core Concepts', file: '01-Core-Concepts.md' },
      { icon: '🌐', label: 'Networking', file: '02-Networking-Fundamentals.md' },
      { icon: '🔌', label: 'API Fundamentals', file: '03-API-Fundamentals.md' },
      { icon: '🗄️', label: 'Database Fundamentals', file: '04-Database-Fundamentals.md' },
      { icon: '⚡', label: 'Caching', file: '05-Caching-Fundamentals.md' },
      { icon: '🔄', label: 'Async Communication', file: '06-Async-Communication.md' },
      { icon: '🧩', label: 'Distributed Systems', file: '07-Distributed-Systems-Microservices.md' },
      { icon: '🖇️', label: 'Architectural Patterns', file: '08-Architectural-Patterns.md' },
      { icon: '⚖️', label: 'Tradeoffs', file: '09-System-Design-Tradeoffs.md' },
    ]
  },
  {
    label: 'Core Concepts Deep Dive',
    icon: '🔬',
    items: [
      { icon: '🚀', label: 'Scalability', file: 'core-concepts/01-Scalability.md' },
      { icon: '🟢', label: 'Availability', file: 'core-concepts/02-Availability.md' },
      { icon: '🛡️', label: 'Reliability', file: 'core-concepts/03-Reliability.md' },
      { icon: '💀', label: 'SPOF', file: 'core-concepts/04-SPOF.md' },
      { icon: '⏱️', label: 'Latency / Throughput / Bandwidth', file: 'core-concepts/05-Latency-Throughput-Bandwidth.md' },
      { icon: '🔵', label: 'Consistent Hashing', file: 'core-concepts/06-Consistent-Hashing.md' },
      { icon: '⚖️', label: 'CAP Theorem', file: 'core-concepts/07-CAP-Theorem.md' },
      { icon: '🔄', label: 'Failover', file: 'core-concepts/08-Failover.md' },
      { icon: '🛡️', label: 'Fault Tolerance', file: 'core-concepts/09-Fault-Tolerance.md' },
    ]
  },
  {
    label: 'Networking Deep Dive',
    icon: '🌍',
    items: [
      { icon: '🧅', label: 'OSI Model & TCP/IP', file: 'networking-fundamentals/01-OSI-Model-TCP-IP.md' },
      { icon: '🌍', label: 'DNS', file: 'networking-fundamentals/02-DNS.md' },
      { icon: '🔐', label: 'HTTP / HTTPS', file: 'networking-fundamentals/03-HTTP-HTTPS.md' },
      { icon: '⚡', label: 'TCP vs UDP', file: 'networking-fundamentals/04-TCP-vs-UDP.md' },
      { icon: '🔀', label: 'Proxies & Load Balancing', file: 'networking-fundamentals/05-Proxies-LoadBalancing.md' },
    ]
  },
  {
    label: 'API Deep Dive',
    icon: '🔌',
    items: [
      { icon: '🏗️', label: 'REST API Design', file: 'api-fundamentals/01-REST-API-Design.md' },
      { icon: '🔷', label: 'GraphQL & gRPC', file: 'api-fundamentals/02-GraphQL-gRPC.md' },
      { icon: '📡', label: 'WebSockets & Real-Time', file: 'api-fundamentals/04-WebSockets-Realtime.md' },
      { icon: '🚪', label: 'API Gateway', file: 'api-fundamentals/05-API-Gateway.md' },
      { icon: '🛡️', label: 'Idempotency & Rate Limiting', file: 'api-fundamentals/06-Idempotency-RateLimiting-Webhooks.md' },
    ]
  },
  {
    label: 'Database Deep Dive',
    icon: '🗃️',
    items: [
      { icon: '🔒', label: 'ACID & Isolation', file: 'database-fundamentals/01-ACID-Transactions.md' },
      { icon: '📊', label: 'SQL vs NoSQL & Sharding', file: 'database-fundamentals/02-SQL-vs-NoSQL.md' },
    ]
  },
  {
    label: 'Distributed Systems Deep Dive',
    icon: '🧩',
    items: [
      { icon: '🤝', label: 'Consensus & Service Discovery', file: 'distributed-systems/01-Consensus-Discovery-Heartbeats.md' },
      { icon: '🔐', label: 'Locking, Gossip & Circuit Breaker', file: 'distributed-systems/02-Locking-Gossip-CircuitBreaker.md' },
      { icon: '🌐', label: 'DR, Tracing & Async', file: 'distributed-systems/03-DR-Tracing-Async.md' },
    ]
  },
  {
    label: 'Caching Deep Dive',
    icon: '⚡',
    items: [
      { icon: '📋', label: 'Caching Strategies', file: 'caching-fundamentals/01-Caching-Strategies.md' },
      { icon: '🌍', label: 'Distributed Cache & CDN', file: 'caching-fundamentals/02-Distributed-Cache-CDN.md' },
    ]
  },
  {
    label: 'Interview Strategy',
    icon: '🎯',
    items: [
      { icon: '✅', label: 'How to Answer SD Questions', file: '10-How-To-Answer-SD-Interview.md' },
    ]
  },
  {
    label: 'Interview Problems',
    icon: '💻',
    items: [
      { icon: '🟢', label: 'Easy Problems', file: '11-Interview-Problems-Easy.md' },
      { icon: '🟡', label: 'Medium Problems', file: '12-Interview-Problems-Medium.md' },
      { icon: '🔴', label: 'Hard Problems', file: '13-Interview-Problems-Hard.md' },
    ]
  },
];

// ============================================
//  Init
// ============================================
let currentFile = null;
const cache = {};

document.addEventListener('DOMContentLoaded', () => {
  initMermaid();
  buildNav();
  bindEvents();
  handleHash();
});

function initMermaid() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  mermaid.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark ? {
      primaryColor: '#6366f1',
      primaryTextColor: '#e4e7f1',
      primaryBorderColor: '#4f46e5',
      lineColor: '#6b7294',
      secondaryColor: '#1a1d2e',
      tertiaryColor: '#222640',
      background: '#161822',
      mainBkg: '#1a1d2e',
      nodeBorder: '#363a50',
      fontFamily: 'Inter, sans-serif',
    } : {}
  });
}

// ============================================
//  Build Navigation
// ============================================
function buildNav() {
  const nav = document.getElementById('nav-tree');
  nav.innerHTML = '';

  NAV_DATA.forEach((section, sIdx) => {
    const sec = document.createElement('div');
    sec.className = 'nav-section';

    const header = document.createElement('div');
    header.className = 'nav-section-header';
    header.innerHTML = `<span class="chevron">▼</span> ${section.icon} ${section.label}`;
    header.addEventListener('click', () => sec.classList.toggle('collapsed'));
    sec.appendChild(header);

    const items = document.createElement('div');
    items.className = 'nav-items';

    section.items.forEach(item => {
      const a = document.createElement('div');
      a.className = 'nav-item';
      a.dataset.file = item.file;
      a.innerHTML = `<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>`;
      a.addEventListener('click', () => loadFile(item.file));
      items.appendChild(a);
    });

    sec.appendChild(items);
    nav.appendChild(sec);
  });
}

// ============================================
//  Load & Render Markdown
// ============================================
async function loadFile(file) {
  // Update URL hash
  window.location.hash = encodeURIComponent(file);

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.nav-item[data-file="${file}"]`);
  if (active) {
    active.classList.add('active');
    // Expand parent section
    const section = active.closest('.nav-section');
    if (section) section.classList.remove('collapsed');
  }

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');

  // Fetch markdown
  let md;
  if (cache[file]) {
    md = cache[file];
  } else {
    try {
      const resp = await fetch(file);
      if (!resp.ok) throw new Error(`File not found: ${file}`);
      md = await resp.text();
      cache[file] = md;
    } catch (err) {
      document.getElementById('article').innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <h2>📄 File not found</h2>
          <p style="color:var(--text-muted);margin-top:8px;">${file}</p>
        </div>`;
      document.getElementById('article').classList.remove('hidden');
      document.getElementById('welcome').style.display = 'none';
      return;
    }
  }

  // Render
  const html = marked.parse(md, {
    gfm: true,
    breaks: false,
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });

  const article = document.getElementById('article');
  article.innerHTML = html;
  article.classList.remove('hidden');
  document.getElementById('welcome').style.display = 'none';

  // Syntax highlight any un-highlighted blocks
  article.querySelectorAll('pre code').forEach(block => {
    if (!block.classList.contains('hljs')) {
      hljs.highlightElement(block);
    }
  });

  // Render mermaid diagrams
  renderMermaid(article);

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentFile = file;
}

async function renderMermaid(container) {
  const els = container.querySelectorAll('code.language-mermaid');
  for (const el of els) {
    const pre = el.parentElement;
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = el.textContent;
    pre.replaceWith(div);
  }
  // Also handle ```mermaid blocks that marked might render as <pre><code>
  try {
    await mermaid.run({ querySelector: '.mermaid' });
  } catch (e) {
    // Mermaid may fail on some blocks — ignore
  }
}

// ============================================
//  Events
// ============================================
function bindEvents() {
  // Mobile menu
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('open');
  });
  document.getElementById('overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
  });

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Search
  document.getElementById('search-input').addEventListener('input', handleSearch);

  // Scroll events
  window.addEventListener('scroll', () => {
    updateProgressBar();
    updateScrollTopButton();
  });

  // Scroll to top
  document.getElementById('scroll-top').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Quick-start cards
  document.querySelectorAll('.start-card').forEach(card => {
    card.addEventListener('click', () => {
      const file = card.dataset.file;
      if (file) loadFile(file);
    });
  });

  // Hash change
  window.addEventListener('hashchange', handleHash);
}

function handleHash() {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (hash) {
    loadFile(hash);
  } else {
    // Render welcome page mermaid
    setTimeout(() => {
      try { mermaid.run({ querySelector: '.mermaid' }); } catch(e) {}
    }, 100);
  }
}

// ============================================
//  Theme
// ============================================
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  document.querySelector('.theme-icon').textContent = next === 'dark' ? '🌙' : '☀️';

  // Re-init mermaid for new theme
  initMermaid();
  // Re-render current mermaid diagrams
  document.querySelectorAll('.mermaid[data-processed]').forEach(el => {
    el.removeAttribute('data-processed');
  });
  try { mermaid.run({ querySelector: '.mermaid' }); } catch(e) {}
}

// ============================================
//  Search
// ============================================
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  document.querySelectorAll('.nav-item').forEach(item => {
    const label = item.querySelector('.nav-label').textContent.toLowerCase();
    const match = !query || label.includes(query);
    item.style.display = match ? '' : 'none';
  });

  // Expand all sections when searching, collapse when cleared
  document.querySelectorAll('.nav-section').forEach(sec => {
    if (query) {
      sec.classList.remove('collapsed');
    }
  });
}

// ============================================
//  Progress & Scroll
// ============================================
function updateProgressBar() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
}

function updateScrollTopButton() {
  const btn = document.getElementById('scroll-top');
  if (window.scrollY > 400) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}
