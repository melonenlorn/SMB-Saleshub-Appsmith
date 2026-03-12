export default {

  formatEUR(val) {
    if (!val || val === 0) return '\u20ac0';
    if (val >= 1000000) return '\u20ac' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '\u20ac' + Math.round(val / 1000) + 'k';
    return '\u20ac' + Math.round(val);
  },

  ownerName(r) {
    return (r.Owner && r.Owner.Name) ? r.Owner.Name : (r.OwnerId || 'Unknown');
  },

  bookingsByOwner() {
    const recs = (qry_Q1Bookings.data && qry_Q1Bookings.data.records)
      ? qry_Q1Bookings.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name: name, arr: 0, deals: 0 };
      map[id].arr += Number(r.Amount) || 0;
      map[id].deals += 1;
    });
    return map;
  },

  pipelineByOwner() {
    const recs = (qry_OpenPipeline.data && qry_OpenPipeline.data.records)
      ? qry_OpenPipeline.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name: name, arr: 0, opps: 0 };
      map[id].arr += Number(r.Amount) || 0;
      map[id].opps += 1;
    });
    return map;
  },

  meetingsByOwner() {
    const recs = (qry_MeetingsQ1.data && qry_MeetingsQ1.data.records)
      ? qry_MeetingsQ1.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name: name, count: 0 };
      map[id].count += 1;
    });
    return map;
  },

  pilotsByOwner() {
    const recs = (qry_PilotsQ1.data && qry_PilotsQ1.data.records)
      ? qry_PilotsQ1.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      const name = (r.Owner && r.Owner.Name) ? r.Owner.Name : id;
      if (!map[id]) map[id] = { name: name, count: 0, arr: 0 };
      map[id].count += 1;
      map[id].arr += Number(r.Amount) || 0;
    });
    return map;
  },

  repTable() {
    const users = (GetAllUsers.data && GetAllUsers.data.records)
      ? GetAllUsers.data.records : [];
    const bookings = jsRepMetrics.bookingsByOwner();
    const pipeline = jsRepMetrics.pipelineByOwner();
    const meetings = jsRepMetrics.meetingsByOwner();
    const pilots   = jsRepMetrics.pilotsByOwner();

    const rows = users.map(u => {
      const uid = u.Id;
      const bk = bookings[uid] || { arr: 0, deals: 0 };
      const pp = pipeline[uid] || { arr: 0, opps: 0 };
      const mt = meetings[uid] || { count: 0 };
      const pi = pilots[uid]   || { count: 0, arr: 0 };
      return {
        repName:          u.Name,
        manager:          u.Manager_Reports__c || '-',
        bookingsARR:      Math.round(bk.arr),
        bookingsDisplay:  jsRepMetrics.formatEUR(bk.arr),
        closedWonDeals:   bk.deals,
        pipelineARR:      Math.round(pp.arr),
        pipelineDisplay:  jsRepMetrics.formatEUR(pp.arr),
        openOpps:         pp.opps,
        meetingsQ1:       mt.count,
        activePilots:     pi.count,
        pilotARR:         Math.round(pi.arr),
        pilotDisplay:     jsRepMetrics.formatEUR(pi.arr),
        coverage:         bk.deals > 0 ? (pp.arr / (bk.arr || 1)).toFixed(1) + 'x' : '-',
      };
    });

    return rows.sort((x, y) => y.bookingsARR - x.bookingsARR);
  },

  totalBookings() {
    const rows = jsRepMetrics.repTable();
    return rows.reduce((s, r) => s + r.bookingsARR, 0);
  },

  totalPipeline() {
    const rows = jsRepMetrics.repTable();
    return rows.reduce((s, r) => s + r.pipelineARR, 0);
  },

  totalMeetings() {
    const rows = jsRepMetrics.repTable();
    return rows.reduce((s, r) => s + r.meetingsQ1, 0);
  },

  totalPilots() {
    const rows = jsRepMetrics.repTable();
    return rows.reduce((s, r) => s + r.activePilots, 0);
  },

  totalDeals() {
    const rows = jsRepMetrics.repTable();
    return rows.reduce((s, r) => s + r.closedWonDeals, 0);
  },

  debug() {
    return {
      usersLoaded:    (GetAllUsers.data && GetAllUsers.data.records) ? GetAllUsers.data.records.length : 'NO DATA',
      bookingsLoaded: (qry_Q1Bookings.data && qry_Q1Bookings.data.records) ? qry_Q1Bookings.data.records.length : 'NO DATA',
      pipelineLoaded: (qry_OpenPipeline.data && qry_OpenPipeline.data.records) ? qry_OpenPipeline.data.records.length : 'NO DATA',
      meetingsLoaded: (qry_MeetingsQ1.data && qry_MeetingsQ1.data.records) ? qry_MeetingsQ1.data.records.length : 'NO DATA',
      pilotsLoaded:   (qry_PilotsQ1.data && qry_PilotsQ1.data.records) ? qry_PilotsQ1.data.records.length : 'NO DATA',
      agedLoaded:     (qry_AgedPipeline.data && qry_AgedPipeline.data.records) ? qry_AgedPipeline.data.records.length : 'NO DATA',
      firstUser:      (GetAllUsers.data && GetAllUsers.data.records && GetAllUsers.data.records[0]) ? GetAllUsers.data.records[0].Name : 'none',
    };
  },

  agedPipelineTable() {
    const recs = (qry_AgedPipeline.data && qry_AgedPipeline.data.records)
      ? qry_AgedPipeline.data.records : [];
    const today = new Date();
    return recs.map(r => {
      const created = new Date(r.CreatedDate);
      const daysOpen = Math.floor((today - created) / (1000 * 60 * 60 * 24));
      const acctName = (r.Account && r.Account.Name) ? r.Account.Name : '-';
      return {
        repName:     (r.Owner && r.Owner.Name) ? r.Owner.Name : r.OwnerId,
        oppName:     r.Name,
        account:     acctName,
        amount:      Math.round(Number(r.Amount) || 0),
        amountDisplay: jsRepMetrics.formatEUR(Number(r.Amount) || 0),
        stage:       r.StageName,
        daysOpen:    daysOpen,
        closeDate:   r.CloseDate || '-',
        createdDate: r.CreatedDate ? r.CreatedDate.substring(0, 10) : '-',
      };
    }).sort((x, y) => y.daysOpen - x.daysOpen);
  },

}
