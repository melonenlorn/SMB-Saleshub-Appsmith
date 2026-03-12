export default {

  // ─── helpers ───────────────────────────────────────────────────
  ownerName(r) {
    return (r.Owner && r.Owner.Name) ? r.Owner.Name : (r.OwnerId || 'Unknown');
  },

  formatEUR(val) {
    if (!val || val === 0) return '€0';
    if (val >= 1000000) return '€' + (val / 1000000).toFixed(1) + 'M';
    if (val >= 1000) return '€' + Math.round(val / 1000) + 'k';
    return '€' + Math.round(val);
  },

  // ─── per-owner aggregates ───────────────────────────────────────
  bookingsByOwner() {
    const recs = (qry_Q1Bookings.data && qry_Q1Bookings.data.records) ? qry_Q1Bookings.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      if (!map[id]) map[id] = { name: this.ownerName(r), arr: 0, deals: 0 };
      map[id].arr += Number(r.Amount) || 0;
      map[id].deals += 1;
    });
    return map;
  },

  pipelineByOwner() {
    const recs = (qry_OpenPipeline.data && qry_OpenPipeline.data.records) ? qry_OpenPipeline.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      if (!map[id]) map[id] = { name: this.ownerName(r), arr: 0, opps: 0 };
      map[id].arr += Number(r.Amount) || 0;
      map[id].opps += 1;
    });
    return map;
  },

  meetingsByOwner() {
    const recs = (qry_MeetingsQ1.data && qry_MeetingsQ1.data.records) ? qry_MeetingsQ1.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      if (!map[id]) map[id] = { name: this.ownerName(r), count: 0 };
      map[id].count += 1;
    });
    return map;
  },

  pilotsByOwner() {
    const recs = (qry_PilotsQ1.data && qry_PilotsQ1.data.records) ? qry_PilotsQ1.data.records : [];
    const map = {};
    recs.forEach(r => {
      const id = r.OwnerId;
      if (!map[id]) map[id] = { name: this.ownerName(r), count: 0, arr: 0 };
      map[id].count += 1;
      map[id].arr += Number(r.Amount) || 0;
    });
    return map;
  },

  // ─── rep table ─────────────────────────────────────────────────
  repTable() {
    const users = (GetAllUsers.data && GetAllUsers.data.records) ? GetAllUsers.data.records : [];
    const bookings = this.bookingsByOwner();
    const pipeline = this.pipelineByOwner();
    const meetings = this.meetingsByOwner();
    const pilots = this.pilotsByOwner();

    const rows = users.map(u => {
      const id = u.User_ID_18__c;
      const b = bookings[id] || { arr: 0, deals: 0 };
      const p = pipeline[id] || { arr: 0, opps: 0 };
      const m = meetings[id] || { count: 0 };
      const pi = pilots[id] || { count: 0, arr: 0 };

      return {
        repName: u.Name,
        gtmMotion: u.GTM_Motion_User__c,
        bookingsARR: Math.round(b.arr),
        bookingsARRDisplay: this.formatEUR(b.arr),
        closedWonDeals: b.deals,
        pipelineARR: Math.round(p.arr),
        pipelineARRDisplay: this.formatEUR(p.arr),
        openOpps: p.opps,
        meetingsQ1: m.count,
        activePilots: pi.count,
        pilotARR: Math.round(pi.arr),
        pilotARRDisplay: this.formatEUR(pi.arr),
        pipelineCoverage: b.deals > 0
          ? (p.arr / (b.arr || 1)).toFixed(1) + 'x'
          : '–',
      };
    });

    return rows.sort((a, b) => b.bookingsARR - a.bookingsARR);
  },

  // ─── KPI totals ─────────────────────────────────────────────────
  totalBookings() {
    return this.repTable().reduce((s, r) => s + r.bookingsARR, 0);
  },

  totalPipeline() {
    return this.repTable().reduce((s, r) => s + r.pipelineARR, 0);
  },

  totalMeetings() {
    return this.repTable().reduce((s, r) => s + r.meetingsQ1, 0);
  },

  totalPilots() {
    return this.repTable().reduce((s, r) => s + r.activePilots, 0);
  },

  totalDeals() {
    return this.repTable().reduce((s, r) => s + r.closedWonDeals, 0);
  },

  // ─── aged pipeline table ────────────────────────────────────────
  agedPipelineTable() {
    const recs = (qry_AgedPipeline.data && qry_AgedPipeline.data.records) ? qry_AgedPipeline.data.records : [];
    const today = new Date();

    return recs.map(r => {
      const created = new Date(r.CreatedDate);
      const daysOpen = Math.floor((today - created) / (1000 * 60 * 60 * 24));
      const acctName = (r.Account && r.Account.Name) ? r.Account.Name : '–';

      return {
        repName: this.ownerName(r),
        oppName: r.Name,
        account: acctName,
        amount: Math.round(Number(r.Amount) || 0),
        amountDisplay: this.formatEUR(Number(r.Amount) || 0),
        stage: r.StageName,
        daysOpen: daysOpen,
        closeDate: r.CloseDate || '–',
        createdDate: r.CreatedDate ? r.CreatedDate.substring(0, 10) : '–',
      };
    }).sort((a, b) => b.daysOpen - a.daysOpen);
  },

}
