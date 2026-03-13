export default {

  // ── IC Level mapping (by rep name — matches Owner.Name from Salesforce) ───
  // Level determines pilot target. David Beck is promoted to L3 but keeps L2
  // pilot target this quarter (PILOT_OVERRIDES handles this).
  IC_LEVELS_BY_NAME: {
    'Alina Kühne':         '2',
    'David Beck':          '3',
    'Ebru Kizilkaya':      '3',
    'Florian Dalis':       '2',
    'Friederike Wilsenack':'2',
    'Hikmet Canbolat':     '3',
    'Jan-Thore Kaulbach':  'rampup',
    'Jane Siewert':        '3',
    'Marius Buga':         '3',
    'Marlies Konrad':      '3',
    'Michael Wahl':        '1',
    'Nina Hoffmann':       '2',
    'Philipp Schmidt':     '2',
    'Pierre Byer':         '2',
    'Raven Schulz':        '3',
    'Robert Eismann':      '2',
    'Tamina Stange':       '3',
  },

  // ── Pilot targets per quarter by IC level ─────────────────────────────────
  PILOT_TARGETS_BY_LEVEL: {
    '1':      18,
    '2':      16,
    '3':      12,
    'rampup': 18,
  },

  // ── Team assignments (by Manager_Reports__c field value from SF) ──────────
  TEAM_MEMBERS: {
    'ferdinand': ['Alina Kühne', 'Friederike Wilsenack', 'Jan-Thore Kaulbach', 'Pierre Byer'],
    'jan':       ['Florian Dalis', 'Hikmet Canbolat', 'Jane Siewert', 'Michael Wahl', 'Robert Eismann', 'Tamina Stange'],
    'philipp':   ['David Beck', 'Ebru Kizilkaya', 'Marius Buga', 'Marlies Konrad', 'Nina Hoffmann', 'Philipp Schmidt', 'Raven Schulz'],
  },

  // ── Manager display name map (Manager_Reports__c value → display name) ────
  MANAGER_DISPLAY: {
    'Ferdinand Bärenfänger': 'Ferdinand',
    'Ferdinand Barenfanger': 'Ferdinand',
    'Jan Hinrichsen':        'Jan',
    'Philipp Bahls':         'Philipp',
    'Raven Schulz':          'Philipp', // Q2 → Raven, Q1 still Philipp's team
  },

  // ── Pilot target overrides (rep name → pilot target, bypasses level rule) ─
  // David Beck promoted to L3 but keeps L2 pilot target (16) for Q1 2026
  PILOT_OVERRIDES_BY_NAME: {
    'David Beck': 16,
  },

  // ── Live quota data from ForecastingQuota ─────────────────────────────────
  quotasByOwner() {
    const recs = (qry_Quotas.data && qry_Quotas.data.output && qry_Quotas.data.output.records)
      ? qry_Quotas.data.output.records : [];
    const map = {};
    recs.forEach(r => {
      const id  = r.QuotaOwnerId;
      const amt = Number(r.QuotaAmount) || 0;
      // If multiple rows per owner (different forecast types), take the MAX
      if (!map[id] || amt > map[id]) map[id] = amt;
    });
    return map;
  },

  // Build a name→quotaAmount map by joining with GetAllUsers
  quotasByName() {
    const quotaMap = jsTargets.quotasByOwner();
    const users = (GetAllUsers.data && GetAllUsers.data.output && GetAllUsers.data.output.records)
      ? GetAllUsers.data.output.records : [];
    const nameMap = {};
    users.forEach(u => {
      if (quotaMap[u.Id] !== undefined) nameMap[u.Name] = quotaMap[u.Id];
    });
    return nameMap;
  },

  // ── ARR target for a rep (live from SF ForecastingQuota) ─────────────────
  arrTarget(repNameOrId) {
    // Try by userId first, then by name
    const byOwner = jsTargets.quotasByOwner();
    if (byOwner[repNameOrId] !== undefined) return byOwner[repNameOrId];
    const byName = jsTargets.quotasByName();
    return byName[repNameOrId] || 0;
  },

  // ── Pilot target for a rep (by name, with override support) ──────────────
  pilotTarget(repName) {
    if (jsTargets.PILOT_OVERRIDES_BY_NAME[repName] !== undefined) {
      return jsTargets.PILOT_OVERRIDES_BY_NAME[repName];
    }
    const level = jsTargets.IC_LEVELS_BY_NAME[repName] || '2';
    return jsTargets.PILOT_TARGETS_BY_LEVEL[level] || 16;
  },

  // ── IC level label for display ────────────────────────────────────────────
  levelLabel(repName) {
    const level = jsTargets.IC_LEVELS_BY_NAME[repName] || '2';
    const labels = { '1': 'L1', '2': 'L2', '3': 'L3', 'rampup': 'Rampup' };
    return labels[level] || 'L2';
  },

  // ── Attainment % (0–100+) ─────────────────────────────────────────────────
  attainment(bookingsArr, repName) {
    const target = jsTargets.arrTarget(repName);
    if (!target || target === 0) return null; // Friederike on leave → null
    return Math.round((bookingsArr / target) * 100);
  },

  // ── Pilot attainment % ────────────────────────────────────────────────────
  pilotAttainment(activePilots, repName) {
    const target = jsTargets.pilotTarget(repName);
    if (!target) return 0;
    return Math.round((activePilots / target) * 100);
  },

  // ── Team total ARR target (sum of team members' live quotas) ─────────────
  teamTarget(teamKey) {
    const members = jsTargets.TEAM_MEMBERS[teamKey] || [];
    const quotaMap = jsTargets.quotasByName();
    return members.reduce((sum, name) => sum + (quotaMap[name] || 0), 0);
  },

  // ── All-team total ARR target ─────────────────────────────────────────────
  totalTarget() {
    return ['ferdinand', 'jan', 'philipp'].reduce((s, t) => s + jsTargets.teamTarget(t), 0);
  },

  // ── Team key for a rep (by Manager_Reports__c value) ─────────────────────
  teamForRep(managerField) {
    const v = (managerField || '').toLowerCase();
    if (v.includes('ferdinand') || v.includes('barenfanger') || v.includes('bärenfänger')) return 'ferdinand';
    if (v.includes('jan')) return 'jan';
    if (v.includes('philipp') || v.includes('raven')) return 'philipp';
    return 'unknown';
  },

  // ── Steering hints for a rep row ─────────────────────────────────────────
  // repRow must have: repName, bookingsARR, pipelineARR, meetingsQ1, callsQ1,
  //                   activePilots, closedWonDeals, teamAvgCalls (injected externally)
  steeringHints(repRow) {
    const hints = [];
    const {
      repName, bookingsARR, pipelineARR, meetingsQ1,
      callsQ1, activePilots, teamAvgCalls = 0,
    } = repRow;

    // 1. Coverage alarm
    const targetARR = jsTargets.arrTarget(repName);
    const monthlyTarget = targetARR > 0 ? targetARR / 3 : 0;
    if (pipelineARR < bookingsARR * 2 && pipelineARR < monthlyTarget * 2) {
      hints.push('Pipeline creation urgently needed — coverage below 2x remaining target');
    }

    // 2. Activity drop
    if (teamAvgCalls > 0 && callsQ1 < teamAvgCalls * 0.7) {
      hints.push('Activity below team average — check daily outreach cadence');
    }

    // 3. Demo gap (Q half over = past Jan 31, 2026 since Q1 2026)
    const today = new Date();
    const qMidpoint = new Date('2026-02-14');
    if (today > qMidpoint && meetingsQ1 < 5) {
      hints.push('Demo volume low for this stage of quarter — push outbound for meetings');
    }

    // 4. Pilot lag
    const pilotTgt = jsTargets.pilotTarget(repName);
    if (activePilots < pilotTgt * 0.5) {
      hints.push('Pilot target at risk — focus on pilot conversion and activation');
    }

    // 5. Win rate low (requires winRate field if available)
    if (repRow.winRate !== undefined && repRow.winRate < 25) {
      hints.push('Win rate below 25% — review demo quality and deal qualification');
    }

    // 6. Aged deals
    if ((repRow.agedDeals || 0) >= 3) {
      hints.push('3+ aged deals in pipeline — review and close or disqualify');
    }

    // 7. Ghosting risk (handled in dealTable, surfaced via repRow.ghostingRisk flag)
    if (repRow.ghostingRisk) {
      hints.push('Deals without next steps approaching close date — risk of ghosting');
    }

    return hints.length ? hints : ['Performance on track — keep up the momentum!'];
  },

  // ── Debug helper ─────────────────────────────────────────────────────────
  debug() {
    return {
      quotasLoaded: (qry_Quotas.data && qry_Quotas.data.output) ? qry_Quotas.data.output.totalSize : 'NO DATA',
      quotaMap:     jsTargets.quotasByName(),
      totalTarget:  jsTargets.totalTarget(),
      sampleLevels: {
        'Marius Buga':    jsTargets.levelLabel('Marius Buga'),
        'Michael Wahl':   jsTargets.levelLabel('Michael Wahl'),
        'David Beck':     jsTargets.levelLabel('David Beck'),
        'Jan-Thore Kaulbach': jsTargets.levelLabel('Jan-Thore Kaulbach'),
      },
      samplePilotTargets: {
        'David Beck':     jsTargets.pilotTarget('David Beck'),     // should be 16 (override)
        'Marius Buga':    jsTargets.pilotTarget('Marius Buga'),    // should be 12
        'Michael Wahl':   jsTargets.pilotTarget('Michael Wahl'),   // should be 18
      },
    };
  },

}
