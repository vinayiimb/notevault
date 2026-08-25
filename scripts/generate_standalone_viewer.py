import json
import os

with open("data/upsc-pyq/upsc_questions_master.json", "r", encoding="utf-8") as f:
    questions = json.load(f)

with open("data/upsc-pyq/upsc_topics_hierarchy.json", "r", encoding="utf-8") as f:
    hierarchy = json.load(f)

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UPSC CSE Prelims Past Year Papers</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body {{ font-family: 'Inter', sans-serif; }}
    .no-scrollbar::-webkit-scrollbar {{ display: none; }}
    .no-scrollbar {{ -ms-overflow-style: none; scrollbar-width: none; }}
  </style>
</head>
<body class="bg-[#f8fafc] text-slate-800 antialiased min-h-screen pb-20 selection:bg-indigo-500/20">

  <!-- 1. Topmost Navbar Header -->
  <header class="bg-white border-b border-slate-200/80 sticky top-0 z-40">
    <div class="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">🏛️</div>
        <div class="flex items-center gap-1.5 cursor-pointer font-semibold text-sm text-slate-900 hover:text-indigo-600 transition-colors">
          <span>UPSC CSE Prelims</span>
          <span class="text-xs text-slate-400 font-bold">⇅</span>
        </div>
      </div>
      <div class="flex items-center gap-4 text-slate-500 text-sm">
        <button class="p-1.5 hover:text-slate-800 transition-colors">🗓️</button>
        <button class="relative p-1.5 hover:text-slate-800 transition-colors">
          🔔
          <span class="absolute top-0.5 right-0.5 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">1</span>
        </button>
        <div class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
          <span>💧</span>
          <span id="streak-counter">0</span>
        </div>
      </div>
    </div>
  </header>

  <!-- 2. Notification Announcement Banner -->
  <div id="top-banner" class="bg-white border-b border-slate-200/60 text-xs text-slate-600 py-2 px-4 relative">
    <div class="max-w-[1440px] mx-auto flex items-center justify-center text-center">
      <span>Require Free Mentorship or UPSC GS Study Plan? <a href="https://wa.me/919376180015" target="_blank" class="font-bold text-slate-900 hover:underline">WhatsApp +91 9376180015 →</a></span>
      <button onclick="document.getElementById('top-banner').style.display='none'" class="absolute right-4 text-slate-400 hover:text-slate-600 text-sm">✕</button>
    </div>
  </div>

  <!-- Main Container -->
  <div class="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">

    <!-- 3. Hero Header Card -->
    <div class="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="space-y-1.5">
        <h1 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">UPSC CSE Prelims Past Year Papers</h1>
        <div class="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
          <span class="text-amber-500 font-bold">🔶</span>
          <span>Press</span>
          <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">Arrow Keys</kbd>
          <span>or</span>
          <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">A</kbd>
          <span>and</span>
          <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">D</kbd>
          <span>to navigate questions, press</span>
          <kbd class="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[11px] font-mono text-slate-700">S</kbd>
          <span>to show/hide solutions.</span>
        </div>
      </div>
      <div>
        <button onclick="resetAllFilters()" class="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm transition-all shadow-xs flex items-center gap-1.5 shrink-0">
          <span>View Past-Year Questions →</span>
        </button>
      </div>
    </div>

    <!-- 4. Two-Column Layout -->
    <div class="flex flex-col lg:flex-row gap-5 items-start">
      
      <!-- Left Sidebar (2 Separate White Cards) -->
      <aside class="w-full lg:w-[280px] shrink-0 space-y-4">
        
        <!-- Top Card: Exams -->
        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5">
          <h2 class="font-bold text-sm text-slate-900">Exams</h2>
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <span>⌄</span>
              <span>UPSC CSE Prelims</span>
            </div>
            <div class="pl-3.5 pt-1">
              <label class="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input type="checkbox" id="select-all-years" onchange="toggleSelectAllYears()" class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked>
                <span>Select All</span>
              </label>
            </div>
            <div id="years-grid" class="grid grid-cols-2 gap-y-2 gap-x-3 pl-3.5 pt-1 text-xs"></div>
          </div>
        </div>

        <!-- Bottom Card: Questions -->
        <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-sm text-slate-900">Questions</h2>
            <button onclick="resetAllFilters()" class="text-[11px] text-indigo-600 hover:underline font-medium">Clear</button>
          </div>

          <div class="divide-y divide-slate-100 text-xs">
            <div class="py-2.5">
              <button onclick="toggleSection('sections')" class="w-full flex items-center justify-between text-slate-700 font-medium hover:text-indigo-600 py-1">
                <span id="sec-arrow">› Sections</span>
                <span class="text-[10px] text-slate-400 font-mono">12 Subjects</span>
              </button>
              <div id="sections-content" class="hidden mt-2 space-y-1 pl-3 max-h-48 overflow-y-auto"></div>
            </div>

            <div class="py-2.5">
              <button onclick="toggleSection('topics')" class="w-full flex items-center justify-between text-slate-700 font-medium hover:text-indigo-600 py-1">
                <span id="top-arrow">⌄ Topics</span>
                <span class="text-[10px] text-slate-400 font-mono">92 Topics</span>
              </button>
              <div id="topics-content" class="mt-2 space-y-2 pl-2 max-h-64 overflow-y-auto pr-1"></div>
            </div>

            <div class="py-2.5">
              <button onclick="toggleSection('difficulty')" class="w-full flex items-center justify-between text-slate-700 font-medium hover:text-indigo-600 py-1">
                <span id="diff-arrow">› Difficulty</span>
              </button>
              <div id="difficulty-content" class="hidden mt-2 space-y-1 pl-3">
                <button onclick="setDiff('All')" class="w-full text-left py-1 px-2 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">All</button>
                <button onclick="setDiff('Easy')" class="w-full text-left py-1 px-2 rounded text-xs text-slate-600 hover:bg-slate-50">Easy</button>
                <button onclick="setDiff('Moderate')" class="w-full text-left py-1 px-2 rounded text-xs text-slate-600 hover:bg-slate-50">Moderate</button>
                <button onclick="setDiff('Hard')" class="w-full text-left py-1 px-2 rounded text-xs text-slate-600 hover:bg-slate-50">Hard</button>
              </div>
            </div>

            <div class="py-2.5">
              <button onclick="toggleBookmarksOnly()" class="w-full flex items-center justify-between text-slate-700 font-medium hover:text-indigo-600 py-1">
                <span>› Bookmarks</span>
                <span id="bm-badge" class="text-[10px] font-mono font-bold text-amber-600">0 Saved</span>
              </button>
            </div>

            <div class="py-2.5">
              <button onclick="toggleSection('attempt')" class="w-full flex items-center justify-between text-slate-700 font-medium hover:text-indigo-600 py-1">
                <span id="att-arrow">› Attempt</span>
              </button>
              <div id="attempt-content" class="hidden mt-2 space-y-1 pl-3">
                <button onclick="setAttFilter('all')" class="w-full text-left py-1 px-2 rounded text-xs text-slate-600 hover:bg-slate-50">All</button>
                <button onclick="setAttFilter('unattempted')" class="w-full text-left py-1 px-2 rounded text-xs text-slate-600 hover:bg-slate-50">Unattempted</button>
                <button onclick="setAttFilter('attempted')" class="w-full text-left py-1 px-2 rounded text-xs text-slate-600 hover:bg-slate-50">Attempted</button>
              </div>
            </div>

            <div class="py-2.5">
              <button class="w-full flex items-center justify-between text-slate-700 font-medium hover:text-indigo-600 py-1">
                <span>› Time Spent</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right Main Practice Panel -->
      <main class="flex-1 w-full space-y-4">
        
        <!-- Question Number Strip -->
        <div class="flex items-center justify-between gap-3 overflow-hidden">
          <div id="number-strip" class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 pr-4 max-w-full scroll-smooth"></div>
          <button onclick="toggleTopicDistModal()" class="text-xs font-semibold text-slate-700 hover:text-indigo-600 whitespace-nowrap flex items-center gap-1 shrink-0">
            <span>View Topic Distribution →</span>
          </button>
        </div>

        <!-- Topic Distribution Modal Container -->
        <div id="topic-dist-modal" class="hidden bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 class="font-bold text-sm text-slate-900">Topic Breakdown (977 Questions)</h3>
            <button onclick="toggleTopicDistModal()" class="text-xs text-slate-400 hover:text-slate-600 font-bold">✕ Close</button>
          </div>
          <div id="topic-dist-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs"></div>
        </div>

        <!-- Main Question Card Container -->
        <div id="main-question-card"></div>

        <!-- Bottom Prev / Next Navigation -->
        <div class="flex items-center justify-between text-xs font-semibold pt-1">
          <button id="btn-prev" onclick="prevQ()" class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs">
            <span>← Previous Question</span>
            <kbd class="px-1 text-[10px] font-mono text-slate-400">[A / ←]</kbd>
          </button>
          <div id="footer-counter" class="text-slate-500 font-mono">1 / 977 Questions</div>
          <button id="btn-next" onclick="nextQ()" class="px-5 py-2 rounded-xl bg-black text-white hover:opacity-90 transition-all flex items-center gap-1.5 shadow-2xs">
            <span>Next Question →</span>
            <kbd class="px-1 text-[10px] font-mono opacity-60">[D / →]</kbd>
          </button>
        </div>
      </main>
    </div>
  </div>

  <script>
    const RAW_QUESTIONS = {json.dumps(questions)};
    const HIERARCHY = {json.dumps(hierarchy)};
    const ALL_YEARS = ['2025','2024','2023','2022','2021','2020','2019','2018','2017','2016','2015','2014','2013'];

    let selectedYears = new Set(ALL_YEARS);
    let selectedSubject = null;
    let selectedTopic = null;
    let selectedDiff = 'All';
    let attemptFilter = 'all';
    let onlyBookmarks = false;
    let currentIndex = 0;
    let showSolution = false;

    let bookmarks = new Set(JSON.parse(localStorage.getItem('upsc_bm') || '[]'));
    let attempts = JSON.parse(localStorage.getItem('upsc_att') || '{{}}');

    function saveStorage() {{
      localStorage.setItem('upsc_bm', JSON.stringify(Array.from(bookmarks)));
      localStorage.setItem('upsc_att', JSON.stringify(attempts));
      document.getElementById('bm-badge').innerText = bookmarks.size + ' Saved';
      document.getElementById('streak-counter').innerText = Object.keys(attempts).length;
    }}

    function getFilteredQuestions() {{
      return RAW_QUESTIONS.filter(q => {{
        if (onlyBookmarks && !bookmarks.has(q.question_id)) return false;
        if (selectedYears.size > 0 && !selectedYears.has(q.year)) return false;
        if (selectedSubject && q.subject !== selectedSubject) return false;
        if (selectedTopic && q.topic !== selectedTopic) return false;
        if (selectedDiff !== 'All' && q.difficulty !== selectedDiff) return false;
        if (attemptFilter === 'attempted' && !attempts[q.question_id]) return false;
        if (attemptFilter === 'unattempted' && attempts[q.question_id]) return false;
        return true;
      }});
    }}

    function renderQuestionBody(q) {{
      const text = q.formatted_question || q.original_question;
      const tableData = q.table_data;
      const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);

      const leadLines = [];
      const statements = [];
      const closingLines = [];

      let inStatements = false;
      let inClosing = false;

      const closingPrompts = [
        'select the correct',
        'which of the statements',
        'which of the above',
        'how many of the above',
        'which one of the following',
        'in which of the above rows',
        'which of the pairs'
      ];

      for (let i = 0; i < lines.length; i++) {{
        const line = lines[i];
        const lower = line.toLowerCase();

        if (closingPrompts.some(p => lower.includes(p)) && i > 0) {{
          inClosing = true;
          closingLines.push(line);
          continue;
        }}

        if (inClosing) {{
          closingLines.push(line);
          continue;
        }}

        const stmtMatch = line.match(/^(\\d+|[I|V|X]+)\\.\\s*(.*)/) || line.match(/^(\\([1-9]\\))\\s*(.*)/);
        if (stmtMatch) {{
          inStatements = true;
          statements.push({{ num: stmtMatch[1], text: stmtMatch[2] }});
          continue;
        }}

        if (inStatements) {{
          if (statements.length > 0) {{
            statements[statements.length - 1].text += ' ' + line;
          }} else {{
            leadLines.push(line);
          }}
        }} else {{
          leadLines.push(line);
        }}
      }}

      let html = '<div class="space-y-4 text-slate-900 font-sans">';

      if (leadLines.length > 0) {{
        html += '<div class="text-[15px] sm:text-[16px] leading-[1.7] text-slate-900 font-normal">' + leadLines.join(' ') + '</div>';
      }}

      if (tableData && tableData.rows && tableData.rows.length > 0) {{
        html += '<div class="overflow-x-auto my-3 rounded-lg border border-slate-200"><table class="w-full text-left text-sm border-collapse">';
        html += '<thead><tr class="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">';
        tableData.headers.forEach(h => {{
          html += '<th class="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider first:w-12">' + h + '</th>';
        }});
        html += '</tr></thead><tbody class="divide-y divide-slate-100">';
        tableData.rows.forEach(r => {{
          html += '<tr class="hover:bg-slate-50/50">';
          html += '<td class="py-2.5 px-4 font-mono font-bold text-slate-400 text-xs">' + r.num + '.</td>';
          r.cells.forEach(c => {{
            html += '<td class="py-2.5 px-4">' + c + '</td>';
          }});
          html += '</tr>';
        }});
        html += '</tbody></table></div>';
      }} else if (statements.length > 0) {{
        html += '<div class="space-y-2.5 my-3 pl-1 sm:pl-2">';
        statements.forEach(s => {{
          html += '<div class="flex items-baseline gap-3 text-[15px] sm:text-[16px] leading-[1.65]">';
          html += '<span class="font-semibold text-slate-900 font-mono text-sm w-5 shrink-0 text-right">' + s.num + '.</span>';
          html += '<span class="text-slate-800 font-normal">' + s.text + '</span></div>';
        }});
        html += '</div>';
      }}

      if (closingLines.length > 0) {{
        html += '<div class="text-[15px] sm:text-[16px] font-medium text-slate-900 pt-1 leading-relaxed">' + closingLines.join(' ') + '</div>';
      }}

      html += '</div>';
      return html;
    }}

    function renderUI() {{
      const filtered = getFilteredQuestions();
      if (currentIndex >= filtered.length) currentIndex = Math.max(0, filtered.length - 1);
      const q = filtered[currentIndex];
      const card = document.getElementById('main-question-card');
      const counter = document.getElementById('footer-counter');

      counter.innerText = (currentIndex + 1) + ' / ' + filtered.length + ' Questions';
      document.getElementById('btn-prev').disabled = currentIndex === 0;
      document.getElementById('btn-next').disabled = currentIndex >= filtered.length - 1;

      renderNumberStrip(filtered);

      if (!q) {{
        card.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
          <div class="text-4xl mb-3">🔍</div>
          <h3 class="font-bold text-base text-slate-900">No Questions Match Filter</h3>
          <p class="text-xs mt-1">Try resetting your filters in the left sidebar.</p>
        </div>`;
        return;
      }}

      const isBm = bookmarks.has(q.question_id);
      const att = attempts[q.question_id];

      let diffColor = 'bg-amber-100 text-amber-800';
      if (q.difficulty === 'Easy') diffColor = 'bg-emerald-100 text-emerald-700';
      if (q.difficulty === 'Hard') diffColor = 'bg-rose-100 text-rose-700';

      let optsHtml = '';
      if (q.options && q.options.length > 0) {{
        optsHtml = '<div class="space-y-2.5 pt-2">' + q.options.map(opt => {{
          const isCorrect = q.correct_answer.toLowerCase().includes(opt.label.toLowerCase());
          const isSelected = att?.opt === opt.label;
          let btnStyle = "bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-800";

          if (showSolution || att) {{
            if (isCorrect) btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500/40";
            else if (isSelected && !isCorrect) btnStyle = "bg-rose-50 border-rose-500 text-rose-950 ring-1 ring-rose-500/40";
          }}

          return `<button onclick="handleOptionSelect('${{opt.label}}')" class="w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition-all ${{btnStyle}}">
            <span class="w-6 h-6 rounded font-mono font-bold text-xs flex items-center justify-center shrink-0 border bg-white border-slate-300 text-slate-700">${{opt.label.replace(/[()]/g,'').toUpperCase()}}</span>
            <span class="text-sm leading-relaxed pt-0.5">${{opt.text}}</span>
          </button>`;
        }}).join('') + '</div>';
      }}

      let solHtml = '';
      if (showSolution) {{
        solHtml = `<div class="w-full mt-2 pt-4 border-t border-dashed border-slate-200 space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-500">Official / Verified Answer</span>
            <span class="px-3.5 py-1 bg-emerald-500 text-white font-mono font-bold text-sm rounded-lg shadow-xs">${{q.correct_answer || 'Verified'}}</span>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 whitespace-pre-line leading-relaxed">${{q.detailed_solution}}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs">
              <strong class="text-blue-900 block mb-1">💡 Core Concept:</strong>
              <span class="text-blue-800">${{q.core_concept}}</span>
            </div>
            <div class="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs">
              <strong class="text-purple-900 block mb-1">🎯 Exam Takeaway:</strong>
              <span class="text-purple-800">${{q.exam_takeaway}}</span>
            </div>
          </div>
          <div class="flex justify-between items-center text-[11px] text-slate-400 font-mono pt-2">
            <span>PDF Reference: ${{q.source_pdf}} (p. ${{q.source_page}})</span>
            <span>Marks: 2.00 | Penalty: -0.66</span>
          </div>
        </div>`;
      }}

      const bodyFormatted = renderQuestionBody(q);

      card.innerHTML = `<div class="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-3.5 py-1 rounded-full bg-[#f3e8ff] text-[#7e22ce] font-semibold text-xs tracking-tight">UPSC CSE ${{q.year}}</span>
            <span class="px-3.5 py-1 rounded-full bg-[#e0f2fe] text-[#0369a1] font-semibold text-xs tracking-tight">${{q.subject}} &gt; ${{q.topic}}</span>
            <span class="px-3 py-1 rounded-full font-semibold text-xs tracking-tight ${{diffColor}}">${{q.difficulty}}</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <button onclick="toggleBookmark('${{q.question_id}}')" class="hover:text-amber-500 transition-colors flex items-center gap-1 ${{isBm ? 'text-amber-500 font-semibold' : ''}}">
              <span>🔖</span>
              <span>${{isBm ? 'Bookmarked' : 'Bookmark'}}</span>
            </button>
            <button class="hover:text-slate-600 flex items-center gap-1">
              <span>ⓘ</span>
              <span>Report</span>
            </button>
          </div>
        </div>

        <div class="border border-slate-200/90 rounded-xl p-5 sm:p-6 bg-white space-y-4">
          ${{bodyFormatted}}
          ${{optsHtml}}
        </div>

        <div class="border border-slate-200/90 rounded-xl p-5 flex flex-col items-center justify-center gap-3">
          <button onclick="toggleSolution()" class="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 shadow-2xs transition-all">
            ${{showSolution ? 'Hide Solution' : 'Show Solution'}}
          </button>
          ${{solHtml}}
        </div>
      </div>`;
    }}

    function renderNumberStrip(filtered) {{
      const strip = document.getElementById('number-strip');
      strip.innerHTML = filtered.map((q, idx) => {{
        const isActive = idx === currentIndex;
        const att = attempts[q.question_id];
        const isBm = bookmarks.has(q.question_id);

        let cls = "bg-slate-200/70 hover:bg-slate-300/80 text-slate-700";
        if (isActive) cls = "bg-black text-white font-bold shadow-xs";
        else if (att?.isCorrect) cls = "bg-emerald-100 text-emerald-800";
        else if (att && !att.isCorrect) cls = "bg-rose-100 text-rose-800";

        return `<button onclick="jumpToQ(${{idx}})" class="w-8 h-8 rounded-lg text-xs font-medium flex items-center justify-center shrink-0 transition-all relative ${{cls}}">
          ${{idx + 1}}
          ${{isBm ? '<span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500"></span>' : ''}}
        </button>`;
      }}).join('');
    }}

    function jumpToQ(idx) {{
      currentIndex = idx;
      showSolution = false;
      renderUI();
    }}

    function nextQ() {{
      const filtered = getFilteredQuestions();
      if (currentIndex < filtered.length - 1) {{
        currentIndex++;
        showSolution = false;
        renderUI();
      }}
    }}

    function prevQ() {{
      if (currentIndex > 0) {{
        currentIndex--;
        showSolution = false;
        renderUI();
      }}
    }}

    function toggleSolution() {{
      showSolution = !showSolution;
      renderUI();
    }}

    function toggleBookmark(qId) {{
      if (bookmarks.has(qId)) bookmarks.delete(qId);
      else bookmarks.add(qId);
      saveStorage();
      renderUI();
    }}

    function handleOptionSelect(opt) {{
      const filtered = getFilteredQuestions();
      const q = filtered[currentIndex];
      if (!q) return;
      const isCorrect = q.correct_answer.toLowerCase().includes(opt.label.toLowerCase());
      attempts[q.question_id] = {{ opt, isCorrect }};
      showSolution = true;
      saveStorage();
      renderUI();
    }}

    function toggleSection(sec) {{
      const el = document.getElementById(sec + '-content');
      const arrow = document.getElementById(sec === 'sections' ? 'sec-arrow' : sec === 'topics' ? 'top-arrow' : sec === 'difficulty' ? 'diff-arrow' : 'att-arrow');
      if (el) {{
        el.classList.toggle('hidden');
        if (arrow) arrow.innerText = el.classList.contains('hidden') ? '› ' + sec.charAt(0).toUpperCase() + sec.slice(1) : '⌄ ' + sec.charAt(0).toUpperCase() + sec.slice(1);
      }}
    }}

    function toggleTopicDistModal() {{
      const modal = document.getElementById('topic-dist-modal');
      modal.classList.toggle('hidden');
    }}

    function initPage() {{
      const yg = document.getElementById('years-grid');
      yg.innerHTML = ALL_YEARS.map(y => `
        <label class="flex items-center gap-2 text-slate-700 cursor-pointer select-none hover:text-slate-900">
          <input type="checkbox" value="${{y}}" onchange="toggleYearCheckbox('${{y}}')" checked class="yr-check w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
          <span>${{y}}</span>
        </label>
      `).join('');

      const tc = document.getElementById('topics-content');
      tc.innerHTML = HIERARCHY.map(s => `
        <div class="space-y-1">
          <div onclick="selectSubject('${{s.subject}}')" class="font-semibold text-[11px] text-slate-800 cursor-pointer flex justify-between hover:text-indigo-600">
            <span>${{s.subject}}</span>
            <span class="font-mono text-slate-400">${{s.total_questions}}</span>
          </div>
          <div class="pl-2 border-l border-slate-200 space-y-0.5">
            ${{s.topics.map(t => `
              <button onclick="selectTopic('${{t.name}}', '${{s.subject}}')" class="w-full text-left py-0.5 px-1.5 rounded text-[11px] flex justify-between items-center text-slate-500 hover:text-slate-800">
                <span class="truncate pr-1">${{t.name}}</span>
                <span class="font-mono text-[10px] opacity-80">${{t.total_questions}}</span>
              </button>
            `).join('')}}
          </div>
        </div>
      `).join('');

      const sc = document.getElementById('sections-content');
      sc.innerHTML = HIERARCHY.map(s => `
        <button onclick="selectSubject('${{s.subject}}')" class="w-full text-left py-1 px-2 rounded flex justify-between items-center text-slate-600 hover:bg-slate-50">
          <span class="truncate">${{s.subject}}</span>
          <span class="text-[10px] text-slate-400 font-mono">${{s.total_questions}}</span>
        </button>
      `).join('');

      const tdg = document.getElementById('topic-dist-grid');
      tdg.innerHTML = HIERARCHY.map(s => `
        <div onclick="selectSubject('${{s.subject}}'); toggleTopicDistModal();" class="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:border-indigo-300 cursor-pointer">
          <div class="font-semibold text-slate-800 truncate">${{s.subject}}</div>
          <div class="text-[11px] text-slate-500 font-mono mt-0.5">${{s.total_questions}} Questions</div>
        </div>
      `).join('');

      window.addEventListener('keydown', (e) => {{
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') nextQ();
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') prevQ();
        if (e.key === 's' || e.key === 'S') toggleSolution();
        if (e.key === 'b' || e.key === 'B') {{
          const filtered = getFilteredQuestions();
          if (filtered[currentIndex]) toggleBookmark(filtered[currentIndex].question_id);
        }}
        if (['1','2','3','4'].includes(e.key)) {{
          const filtered = getFilteredQuestions();
          const q = filtered[currentIndex];
          const idx = parseInt(e.key) - 1;
          if (q && q.options && q.options[idx]) handleOptionSelect(q.options[idx].label);
        }}
      }});

      saveStorage();
      renderUI();
    }}

    function toggleYearCheckbox(yr) {{
      if (selectedYears.has(yr)) selectedYears.delete(yr);
      else selectedYears.add(yr);
      currentIndex = 0;
      renderUI();
    }}

    function toggleSelectAllYears() {{
      const cb = document.getElementById('select-all-years');
      if (cb.checked) {{
        selectedYears = new Set(ALL_YEARS);
        document.querySelectorAll('.yr-check').forEach(c => c.checked = true);
      }} else {{
        selectedYears = new Set();
        document.querySelectorAll('.yr-check').forEach(c => c.checked = false);
      }}
      currentIndex = 0;
      renderUI();
    }}

    function selectSubject(s) {{
      selectedSubject = s;
      selectedTopic = null;
      currentIndex = 0;
      renderUI();
    }}

    function selectTopic(t, s) {{
      selectedSubject = s;
      selectedTopic = t;
      currentIndex = 0;
      renderUI();
    }}

    function setDiff(d) {{
      selectedDiff = d;
      currentIndex = 0;
      renderUI();
    }}

    function setAttFilter(f) {{
      attemptFilter = f;
      currentIndex = 0;
      renderUI();
    }}

    function toggleBookmarksOnly() {{
      onlyBookmarks = !onlyBookmarks;
      currentIndex = 0;
      renderUI();
    }}

    function resetAllFilters() {{
      selectedYears = new Set(ALL_YEARS);
      selectedSubject = null;
      selectedTopic = null;
      selectedDiff = 'All';
      attemptFilter = 'all';
      onlyBookmarks = false;
      document.querySelectorAll('.yr-check').forEach(c => c.checked = true);
      document.getElementById('select-all-years').checked = true;
      currentIndex = 0;
      renderUI();
    }}

    initPage();
  </script>
</body>
</html>"""

os.makedirs("public", exist_ok=True)
with open("public/upsc-viewer.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("Generated clean layout standalone viewer: public/upsc-viewer.html")
