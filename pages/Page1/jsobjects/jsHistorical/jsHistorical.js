export default {

  // ── Raw monthly history records from qry_MonthlyHistory ──────────────────
  // Returns [{ownerId, ownerName, year, month, arr, deals}]
  monthlyTeamData() {
    const recs = (qry_MonthlyHistory.data && qry_MonthlyHistory.data.output && qry_MonthlyHistory.data.output.records)
      ? qry_MonthlyHistory.data.output.records : [];

    // Aggregate by year+month across all reps
    const map = {};
    recs.forEach(r => {
      const d   = new Date(r.CloseDate);
      const yr  = d.getFullYear();
      const mo  = d.getMonth() + 1; // 1-12
      const key = yr + '-' + String(mo).padStart(2, '0');
      if (!map[key]) map[key] = { year: yr, month: mo, key, arr: 0, deals: 0 };
      map[key].arr   += Number(r.Amount) || 0;
      map[key].deals += 1;
    });

    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  },

  // ── Per-rep monthly data ──────────────────────────────────────────────────
  repMonthlyData(repId) {
    const recs = (qry_MonthlyHistory.data && qry_MonthlyHistory.data.output && qry_MonthlyHistory.data.output.records)
      ? qry_MonthlyHistory.data.output.records : [];

    const map = {};
    recs.forEach(r => {
      if (r.OwnerId !== repId) return;
      const d   = new Date(r.CloseDate);
      const yr  = d.getFullYear();
      const mo  = d.getMonth() + 1;
      const key = yr + '-' + String(mo).padStart(2, '0');
      if (!map[key]) map[key] = { year: yr, month: mo, key, arr: 0, deals: 0 };
      map[key].arr   += Number(r.Amount) || 0;
      map[key].deals += 1;
    });

    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  },

  // ── Month label helper ────────────────────────────────────────────────────
  _monthLabel(year, month) {
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[month - 1] + ' ' + String(year).slice(2);
  },

  // ── 3-month rolling average ───────────────────────────────────────────────
  _rollingAvg(values, window) {
    return values.map((_, i) => {
      const slice = values.slice(Math.max(0, i - window + 1), i + 1);
      return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length);
    });
  },

  // ── Chart.js config: Team monthly trend (bar + rolling avg line) ──────────
  // Used by cwMonthlyTrend custom widget
  monthlyTeamChart() {
    const data       = jsHistorical.monthlyTeamData();
    const labels     = data.map(d => jsHistorical._monthLabel(d.year, d.month));
    const arrValues  = data.map(d => Math.round(d.arr));
    const rollingAvg = jsHistorical._rollingAvg(arrValues, 3);

    // Monthly target = total Q target / 3
    const monthlyTarget = Math.round(jsTargets.totalTarget() / 3);
    const targetLine    = data.map(() => monthlyTarget);

    // Highlight Q1 2026 bars (Jan-Mar 2026)
    const bgColors = data.map(d =>
      (d.year === 2026 && d.month <= 3) ? '#3b82f6' : '#334155'
    );

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type:            'bar',
            label:           'ARR Booked',
            data:            arrValues,
            backgroundColor: bgColors,
            borderRadius:    4,
            order:           2,
          },
          {
            type:        'line',
            label:       '3-Month Avg',
            data:        rollingAvg,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension:     0.4,
            order:       1,
          },
          {
            type:        'line',
            label:       'Monthly Target',
            data:        targetLine,
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            borderWidth:  2,
            borderDash:   [6, 3],
            pointRadius:  0,
            order:        0,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.raw;
                if (v >= 1000) return ctx.dataset.label + ': €' + Math.round(v / 1000) + 'k';
                return ctx.dataset.label + ': €' + v;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 10 } },
            grid:  { color: '#1e293b' },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              font:  { size: 10 },
              callback: v => v >= 1000 ? '€' + Math.round(v / 1000) + 'k' : '€' + v,
            },
            grid: { color: '#1e293b' },
          },
        },
      },
    };
  },

  // ── Chart.js config: Rep monthly trend ───────────────────────────────────
  repMonthlyChart(repId) {
    const data       = jsHistorical.repMonthlyData(repId);
    const labels     = data.map(d => jsHistorical._monthLabel(d.year, d.month));
    const arrValues  = data.map(d => Math.round(d.arr));

    // Find rep name from GetAllUsers
    const users = (GetAllUsers.data && GetAllUsers.data.output && GetAllUsers.data.output.records)
      ? GetAllUsers.data.output.records : [];
    const repUser = users.find(u => u.Id === repId);
    const repName = repUser ? repUser.Name : repId;

    const monthlyTarget = Math.round(jsTargets.arrTarget(repName) / 3);
    const targetLine    = data.map(() => monthlyTarget);
    const rollingAvg    = jsHistorical._rollingAvg(arrValues, 3);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type:            'bar',
            label:           'ARR Booked',
            data:            arrValues,
            backgroundColor: '#3b82f6',
            borderRadius:    4,
            order:           2,
          },
          {
            type:        'line',
            label:       '3-Month Avg',
            data:        rollingAvg,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            tension:     0.4,
            order:       1,
          },
          {
            type:        'line',
            label:       'Monthly Target',
            data:        targetLine,
            borderColor: '#22c55e',
            backgroundColor: 'transparent',
            borderWidth:  2,
            borderDash:   [6, 3],
            pointRadius:  0,
            order:        0,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
          title: {
            display: true,
            text:    repName + ' — Monthly Bookings',
            color:   '#f8fafc',
            font:    { size: 13, weight: 'bold' },
          },
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } },
          y: {
            ticks: {
              color: '#94a3b8',
              font:  { size: 10 },
              callback: v => v >= 1000 ? '€' + Math.round(v / 1000) + 'k' : '€' + v,
            },
            grid: { color: '#1e293b' },
          },
        },
      },
    };
  },

  // ── Win/loss data aggregated by rep ───────────────────────────────────────
  winLossMap() {
    const recs = (qry_WinLoss.data && qry_WinLoss.data.output && qry_WinLoss.data.output.records)
      ? qry_WinLoss.data.output.records : [];
    const map = {};
    recs.forEach(r => {
      const id   = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name, won: 0, lost: 0, wonArr: 0, lostArr: 0 };
      const isWon = r.StageName === 'Closed Won';
      const amt   = Number(r.Amount) || 0;
      if (isWon) { map[id].won += 1; map[id].wonArr += amt; }
      else       { map[id].lost += 1; map[id].lostArr += amt; }
    });
    return map;
  },

  // ── Win rate by rep (returns {repId: winRatePct}) ─────────────────────────
  winRateByRep() {
    const wl = jsHistorical.winLossMap();
    const result = {};
    Object.entries(wl).forEach(([id, d]) => {
      const total = d.won + d.lost;
      result[id] = total > 0 ? Math.round((d.won / total) * 100) : 0;
    });
    return result;
  },

  // ── Loss reason Chart.js donut config ─────────────────────────────────────
  lossReasonChart() {
    const recs = (qry_LossReasons.data && qry_LossReasons.data.output && qry_LossReasons.data.output.records)
      ? qry_LossReasons.data.output.records : [];

    // Admin/cleanup reasons to exclude
    const EXCLUDE = ['Test', 'Duplicate', 'Admin', 'Data Quality', null, undefined, ''];

    const filtered = recs.filter(r => !EXCLUDE.includes(r.plLossReason__c));
    const top6     = filtered.slice(0, 6);

    const labels = top6.map(r => r.plLossReason__c || 'Unknown');
    const counts = top6.map(r => Number(r.expr0) || 0);
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16'];

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data:            counts,
          backgroundColor: colors,
          borderColor:     '#0f172a',
          borderWidth:     2,
          hoverOffset:     6,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color:    '#94a3b8',
              font:     { size: 11 },
              padding:  12,
              boxWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: ctx => ' ' + ctx.label + ': ' + ctx.raw + ' deals',
            },
          },
        },
        cutout: '65%',
      },
    };
  },

  // ── Team-average win rate (all reps combined) ─────────────────────────────
  teamWinRate() {
    const wl = jsHistorical.winLossMap();
    let won = 0, total = 0;
    Object.values(wl).forEach(d => { won += d.won; total += d.won + d.lost; });
    return total > 0 ? Math.round((won / total) * 100) : 0;
  },

  // ── Debug ─────────────────────────────────────────────────────────────────
  debug() {
    return {
      monthlyHistoryLoaded: (qry_MonthlyHistory.data && qry_MonthlyHistory.data.output)
        ? qry_MonthlyHistory.data.output.totalSize : 'NO DATA',
      winLossLoaded: (qry_WinLoss.data && qry_WinLoss.data.output)
        ? qry_WinLoss.data.output.totalSize : 'NO DATA',
      lossReasonsLoaded: (qry_LossReasons.data && qry_LossReasons.data.output)
        ? qry_LossReasons.data.output.totalSize : 'NO DATA',
      monthlyDataPoints: jsHistorical.monthlyTeamData().length,
      teamWinRate:       jsHistorical.teamWinRate() + '%',
    };
  },

}
