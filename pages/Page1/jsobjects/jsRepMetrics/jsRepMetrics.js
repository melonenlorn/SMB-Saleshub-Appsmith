export default {

  formatEUR(val) {
    if (!val || val === 0) return '\u20ac0';
    if (val >= 1000000) return '\u20ac' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '\u20ac' + Math.round(val / 1000) + 'k';
    return '\u20ac' + Math.round(val);
  },

  // ── Raw aggregators ────────────────────────────────────────────────────────

  bookingsByOwner() {
    const recs = (qry_Q1Bookings.data && qry_Q1Bookings.data.output && qry_Q1Bookings.data.output.records)
      ? qry_Q1Bookings.data.output.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name, arr: 0, deals: 0 };
      map[id].arr   += Number(r.Amount) || 0;
      map[id].deals += 1;
    });
    return map;
  },

  pipelineByOwner() {
    const recs = (qry_OpenPipeline.data && qry_OpenPipeline.data.output && qry_OpenPipeline.data.output.records)
      ? qry_OpenPipeline.data.output.records : [];
    const map = {};
    recs.forEach(r => {
      const id   = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name, arr: 0, opps: 0, commit: 0, bestCase: 0 };
      const amt = Number(r.Amount) || 0;
      const fc  = r.ForecastCategory || '';
      map[id].arr    += amt;
      map[id].opps   += 1;
      if (fc === 'Forecast' || fc === 'MostLikely') map[id].commit   += amt;
      else if (fc === 'BestCase')                   map[id].bestCase += amt;
    });
    return map;
  },

  meetingsByOwner() {
    const recs = (qry_MeetingsQ1.data && qry_MeetingsQ1.data.output && qry_MeetingsQ1.data.output.records)
      ? qry_MeetingsQ1.data.output.records : [];
    const allowedIds = jsRepMetrics._insideSalesIds();
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      if (!allowedIds.has(id)) return;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name, count: 0 };
      map[id].count += 1;
    });
    return map;
  },

  pilotsByOwner() {
    const recs = (qry_PilotsQ1.data && qry_PilotsQ1.data.output && qry_PilotsQ1.data.output.records)
      ? qry_PilotsQ1.data.output.records : [];
    const map = {};
    recs.forEach(r => {
      const id   = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name, count: 0, arr: 0 };
      map[id].count += 1;
      map[id].arr   += Number(r.Amount) || 0;
    });
    return map;
  },

  callsByOwner() {
    const recs = (qry_CallsQ1.data && qry_CallsQ1.data.output && qry_CallsQ1.data.output.records)
      ? qry_CallsQ1.data.output.records : [];
    const allowedIds = jsRepMetrics._insideSalesIds();
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      if (!allowedIds.has(id)) return;
      // Aggregate query returns Owner.Name as flat 'Name', count as expr0
      const name = r.Name || id;
      if (!map[id]) map[id] = { name, count: 0 };
      map[id].count += Number(r.expr0) || 0;
    });
    return map;
  },

  // ── Helpers ────────────────────────────────────────────────────────────────

  _insideSalesIds() {
    const users = (GetAllUsers.data && GetAllUsers.data.output && GetAllUsers.data.output.records)
      ? GetAllUsers.data.output.records : [];
    const set = new Set();
    users.forEach(u => set.add(u.Id));
    return set;
  },

  _percentile(sortedAsc, val) {
    if (!sortedAsc.length) return 0;
    return sortedAsc.filter(x => x <= val).length / sortedAsc.length;
  },

  // ── Health score (0-100, percentile-based vs team peers) ──────────────────
  // Bookings 40% · Coverage 25% · Demos 20% · Calls 15%

  _addHealthScores(rows) {
    const bkArr = rows.map(r => r.bookingsARR).sort((a, b) => a - b);
    const ppArr = rows.map(r => r.pipelineARR).sort((a, b) => a - b);
    const mtArr = rows.map(r => r.meetingsQ1).sort((a, b) => a - b);
    const clArr = rows.map(r => r.callsQ1).sort((a, b) => a - b);
    return rows.map(r => {
      const score = Math.round(
        jsRepMetrics._percentile(bkArr, r.bookingsARR) * 40 +
        jsRepMetrics._percentile(ppArr, r.pipelineARR) * 25 +
        jsRepMetrics._percentile(mtArr, r.meetingsQ1)  * 20 +
        jsRepMetrics._percentile(clArr, r.callsQ1)     * 15
      );
      return { ...r, healthScore: score };
    });
  },

  // ── Main rep table ─────────────────────────────────────────────────────────

  repTable() {
    const users    = (GetAllUsers.data && GetAllUsers.data.output && GetAllUsers.data.output.records)
      ? GetAllUsers.data.output.records : [];
    const bookings = jsRepMetrics.bookingsByOwner();
    const pipeline = jsRepMetrics.pipelineByOwner();
    const meetings = jsRepMetrics.meetingsByOwner();
    const pilots   = jsRepMetrics.pilotsByOwner();
    const calls    = jsRepMetrics.callsByOwner();

    const rows = users.map(u => {
      const uid = u.Id;
      const bk  = bookings[uid] || { arr: 0, deals: 0 };
      const pp  = pipeline[uid] || { arr: 0, opps: 0, commit: 0, bestCase: 0 };
      const mt  = meetings[uid] || { count: 0 };
      const pi  = pilots[uid]   || { count: 0, arr: 0 };
      const cl  = calls[uid]    || { count: 0 };

      const coverageRaw = bk.arr > 0 ? pp.arr / bk.arr : (pp.arr > 0 ? 10 : 0);

      return {
        repName:         u.Name,
        manager:         u.Manager_Reports__c || '-',
        healthScore:     0,
        bookingsARR:     Math.round(bk.arr),
        bookingsDisplay: jsRepMetrics.formatEUR(bk.arr),
        closedWonDeals:  bk.deals,
        commitARR:       Math.round(pp.commit),
        commitDisplay:   jsRepMetrics.formatEUR(pp.commit),
        bestCaseARR:     Math.round(pp.bestCase),
        bestCaseDisplay: jsRepMetrics.formatEUR(pp.bestCase),
        pipelineARR:     Math.round(pp.arr),
        pipelineDisplay: jsRepMetrics.formatEUR(pp.arr),
        openOpps:        pp.opps,
        meetingsQ1:      mt.count,
        callsQ1:         cl.count,
        activePilots:    pi.count,
        pilotARR:        Math.round(pi.arr),
        pilotDisplay:    jsRepMetrics.formatEUR(pi.arr),
        coverageRaw:     coverageRaw,
        coverage:        coverageRaw > 0 ? coverageRaw.toFixed(1) + 'x' : '-',
      };
    });

    const sorted = rows.sort((x, y) => y.bookingsARR - x.bookingsARR);
    return jsRepMetrics._addHealthScores(sorted);
  },

  // ── Stage funnel breakdown ─────────────────────────────────────────────────

  stageBreakdownTable() {
    const recs = (qry_OpenPipeline.data && qry_OpenPipeline.data.output && qry_OpenPipeline.data.output.records)
      ? qry_OpenPipeline.data.output.records : [];

    const stageOrder = [
      'Ready for Sales', 'In Qualification', 'Currently in Contact',
      'Qualified Prospect', 'In Discussion', 'Demo Confirmed',
      'Demo Held', 'Offer', 'Pitch & Negotiation', 'Pilot Definition'
    ];

    const map = {};
    let totalARR = 0;
    recs.forEach(r => {
      const s   = r.StageName || 'Unknown';
      const amt = Number(r.Amount) || 0;
      if (!map[s]) map[s] = { opps: 0, arr: 0 };
      map[s].opps += 1;
      map[s].arr  += amt;
      totalARR    += amt;
    });

    return stageOrder
      .filter(s => map[s])
      .map(s => ({
        stage:      s,
        opps:       map[s].opps,
        arr:        Math.round(map[s].arr),
        arrDisplay: jsRepMetrics.formatEUR(map[s].arr),
        pct:        totalARR > 0 ? Math.round(map[s].arr / totalARR * 100) + '%' : '-',
      }));
  },

  // ── Aged pipeline table ────────────────────────────────────────────────────

  agedPipelineTable() {
    const recs = (qry_AgedPipeline.data && qry_AgedPipeline.data.output && qry_AgedPipeline.data.output.records)
      ? qry_AgedPipeline.data.output.records : [];
    const today = new Date();
    return recs.map(r => {
      const created  = new Date(r.CreatedDate);
      const daysOpen = Math.floor((today - created) / (1000 * 60 * 60 * 24));
      return {
        repName:       (r.Owner && r.Owner.Name) ? r.Owner.Name : r.OwnerId,
        oppName:       r.Name,
        account:       (r.Account && r.Account.Name) ? r.Account.Name : '-',
        amount:        Math.round(Number(r.Amount) || 0),
        amountDisplay: jsRepMetrics.formatEUR(Number(r.Amount) || 0),
        stage:         r.StageName,
        daysOpen:      daysOpen,
        closeDate:     r.CloseDate || '-',
        createdDate:   r.CreatedDate ? r.CreatedDate.substring(0, 10) : '-',
        nextStep:      r.NextStep ? r.NextStep.substring(0, 100) : '-',
      };
    }).sort((x, y) => y.daysOpen - x.daysOpen);
  },

  // ── Team totals ────────────────────────────────────────────────────────────

  totalBookings()  { return jsRepMetrics.repTable().reduce((s, r) => s + r.bookingsARR, 0); },
  totalPipeline()  { return jsRepMetrics.repTable().reduce((s, r) => s + r.pipelineARR, 0); },
  totalCommit()    { return jsRepMetrics.repTable().reduce((s, r) => s + r.commitARR, 0); },
  totalMeetings()  { return jsRepMetrics.repTable().reduce((s, r) => s + r.meetingsQ1, 0); },
  totalPilots()    { return jsRepMetrics.repTable().reduce((s, r) => s + r.activePilots, 0); },
  totalDeals()     { return jsRepMetrics.repTable().reduce((s, r) => s + r.closedWonDeals, 0); },
  totalCalls()     { return jsRepMetrics.repTable().reduce((s, r) => s + r.callsQ1, 0); },

  // ── Debug ──────────────────────────────────────────────────────────────────

  debug() {
    return {
      usersLoaded:    (GetAllUsers.data && GetAllUsers.data.output) ? GetAllUsers.data.output.totalSize : 'NO DATA',
      bookingsLoaded: (qry_Q1Bookings.data && qry_Q1Bookings.data.output) ? qry_Q1Bookings.data.output.totalSize : 'NO DATA',
      pipelineLoaded: (qry_OpenPipeline.data && qry_OpenPipeline.data.output) ? qry_OpenPipeline.data.output.totalSize : 'NO DATA',
      meetingsLoaded: (qry_MeetingsQ1.data && qry_MeetingsQ1.data.output) ? qry_MeetingsQ1.data.output.totalSize : 'NO DATA',
      pilotsLoaded:   (qry_PilotsQ1.data && qry_PilotsQ1.data.output) ? qry_PilotsQ1.data.output.totalSize : 'NO DATA',
      agedLoaded:     (qry_AgedPipeline.data && qry_AgedPipeline.data.output) ? qry_AgedPipeline.data.output.totalSize : 'NO DATA',
      callsLoaded:    (qry_CallsQ1.data && qry_CallsQ1.data.output) ? qry_CallsQ1.data.output.totalSize : 'NO DATA',
      firstUser:      (GetAllUsers.data && GetAllUsers.data.output && GetAllUsers.data.output.records && GetAllUsers.data.output.records[0]) ? GetAllUsers.data.output.records[0].Name : 'none',
      repCount:       jsRepMetrics.repTable().length,
    };
  },

}
