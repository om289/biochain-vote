const fs = require('fs');
let code = fs.readFileSync('src/services/dbService.ts', 'utf-8');

// electionDB.getAll
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(mapElection\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map(mapElection);
        records.forEach(r => dbPut('elections', r).catch(()=>{}));
        return records;
      }`
);

// electionDB.getById
code = code.replace(
  /if \(!error && data\) return mapElection\(data\);/g,
  `if (!error && data) {
        const r = mapElection(data);
        dbPut('elections', r).catch(()=>{});
        return r;
      }`
);

// electionDB.getByStatus
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(mapElection\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map(mapElection);
        records.forEach(r => dbPut('elections', r).catch(()=>{}));
        return records;
      }`
);

// candidateDB.getAll
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(mapCandidate\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map(mapCandidate);
        records.forEach(r => dbPut('candidates', r).catch(()=>{}));
        return records;
      }`
);

// candidateDB.getByElection
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(mapCandidate\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map(mapCandidate);
        records.forEach(r => dbPut('candidates', r).catch(()=>{}));
        return records;
      }`
);

// blockDB.getAll
code = code.replace(
  /if \(!error && data && data\.length > 0\) \{\n\s*return data\.map\(\(b: any\) => \(\{[\s\S]*?\}\)\);\n\s*\}/m,
  `if (!error && data && data.length > 0) {
        const records = data.map((b: any) => ({
          index: b.index,
          timestamp: new Date(b.timestamp).toISOString().replace(/\\.\\d{3}Z$/, 'Z'),
          data: b.data,
          previousHash: b.previous_hash,
          hash: b.hash,
          nonce: b.nonce
        }));
        records.forEach((r: any) => dbPut('blocks', r).catch(()=>{}));
        return records;
      }`
);

// boothDB.getAll
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(\(b: any\) => \(\{ id: b\.id, name: b\.name, constituency: b\.constituency \}\)\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map((b: any) => ({ id: b.id, name: b.name, constituency: b.constituency }));
        records.forEach((r: any) => dbPut('booths', r).catch(()=>{}));
        return records;
      }`
);

// boothVoterDB.getByVoter
code = code.replace(
  /if \(!error && data\) return \{ voterId: data\.voter_id, boothId: data\.booth_id \};/g,
  `if (!error && data) {
        const r = { voterId: data.voter_id, boothId: data.booth_id };
        dbPut('boothVoters', r).catch(()=>{});
        return r;
      }`
);

// boothVoterDB.getByBooth
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(\(r: any\) => \(\{ voterId: r\.voter_id, boothId: r\.booth_id \}\)\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ voterId: r.voter_id, boothId: r.booth_id }));
        records.forEach((r: any) => dbPut('boothVoters', r).catch(()=>{}));
        return records;
      }`
);

// boothElectionDB.getAll
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(\(r: any\) => \(\{ id: r\.id, boothId: r\.booth_id, electionId: r\.election_id \}\)\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ id: r.id, boothId: r.booth_id, electionId: r.election_id }));
        records.forEach((r: any) => dbPut('boothElections', r).catch(()=>{}));
        return records;
      }`
);

// boothElectionDB.getByBooth
code = code.replace(
  /if \(!error && data && data\.length > 0\) return data\.map\(\(r: any\) => \(\{ id: r\.id, boothId: r\.booth_id, electionId: r\.election_id \}\)\);/g,
  `if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ id: r.id, boothId: r.booth_id, electionId: r.election_id }));
        records.forEach((r: any) => dbPut('boothElections', r).catch(()=>{}));
        return records;
      }`
);

fs.writeFileSync('src/services/dbService.ts', code);
console.log('Fixed sync in dbService.ts');
