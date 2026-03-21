const DISPLAY_TO_DB_OPENING = {
  "Alekhine's Defence": 'Alekhine',
  'Amar Opening': 'Amar',
  'Amazon Attack': 'Amazon',
  "Anderssen's Opening": 'Anderssens',
  'Australian Opening': 'Australian',
  "Barnes Opening": 'Barnes',
  'Benko Gambit': 'Benko',
  'Benoni Defence': 'Benoni',
  "Bird's Opening": 'Bird',
  'Bishops Opening': 'Bishops',
  'Blackmar-Diemer Gambit': 'Blackmar-Diemer',
  'Blumenfeld Gambit': 'Blumenfeld',
  'Bogo-Indian Defence': 'Bogo-Indian',
  'Borg Opening': 'Borg',
  'Canard Opening': 'Canard',
  'Caro-Kann Defence': 'Caro-Kann',
  'Carr Opening': 'Carr',
  'Catalan Opening': 'Catalan',
  'Center Game': 'Center',
  'Clemenz Opening': 'Clemenz',
  'Crab Opening': 'Crab',
  'Creepy Opening': 'Creepy',
  'Czech Defence': 'Czech',
  'Danish Gambit': 'Danish',
  'Duras Opening': 'Duras',
  'Dutch Defence': 'Dutch',
  'East Indian Defence': 'East',
  'Elephant Gambit': 'Elephant',
  'English Opening': 'English',
  'Englund Gambit': 'Englund',
  'Four Knights Game': 'Four',
  'French Defence': 'French',
  'Fried Liver Attack': 'Fried',
  'Gedults Opening': 'Gedults',
  'Giuoco Piano': 'Giuoco',
  'Goldsmith Game': 'Goldsmith',
  "Grob's Attack": 'Grob',
  'Grunfeld Defence': 'Grunfeld',
  'Guatemala Opening': 'Guatemala',
  'Gunderam Opening': 'Gunderam',
  'Hippopotamus Defence': 'Hippopotamus',
  'Horwitz Defence': 'Horwitz',
  'Hungarian Opening': 'Hungarian',
  'Indian Defence': 'Indian',
  'Italian Game': 'Italian',
  'Kadas Opening': 'Kadas',
  'Kangaroo Opening': 'Kangaroo',
  "King's Indian Defence": 'Kings',
  "Lasker's Opening": 'Lasker',
  'Latvian Gambit': 'Latvian',
  'Lemming Defence': 'Lemming',
  'Lion Opening': 'Lion',
  'London System': 'London',
  'Mexican Opening': 'Mexican',
  "Mieses' Opening": 'Mieses',
  "Mikenas' Opening": 'Mikenas',
  'Modern Defence': 'Modern',
  'Neo-Grunfeld Defence': 'Neo-Grunfeld',
  'Nimzo-Indian Defence': 'Nimzo-Indian',
  'Nimzo-Larsen Attack': 'Nimzo-Larsen',
  'Nimzowitsch Defence': 'Nimzowitsch',
  'Old Indian Defence': 'Old',
  "Owen's Defence": 'Owen',
  'Paleface Opening': 'Paleface',
  "Petrov's Defence": 'Petrovs',
  "Philidor's Defence": 'Philidor',
  "Pirc's Defence": 'Pirc',
  'Polish Opening': 'Polish',
  'Ponziani Opening': 'Ponziani',
  'Portuguese Opening': 'Portuguese',
  'Pseudo-Benoni': 'Pseudo',
  'Pterodactyl Defence': 'Pterodactyl',
  "Queen's Gambit": 'Queens',
  'Rapport-Jobava System': 'Rapport-Jobava',
  'Rat Defence': 'Rat',
  'Reti Opening': 'Reti',
  'Richter-Veresov Attack': 'Richter-Veresov',
  'Robatsch Defence': 'Robatsch',
  "Rubinstein's Opening": 'Rubinstein',
  'Russian Game': 'Russian',
  'Ruy López': 'Ruy',
  'Saragossa Opening': 'Saragossa',
  'Scandinavian Defence': 'Scandinavian',
  'Scotch Game': 'Scotch',
  'Semi-Slav Defence': 'Semi-Slav',
  'Sicilian Defence': 'Sicilian',
  'Slav Defence': 'Slav',
  'Sodium Attack': 'Sodium',
  'St. George Defence': 'St',
  'Tarrasch Defence': 'Tarrasch',
  'Three Knights Game': 'Three',
  'Torre Attack': 'Torre',
  'Trompowsky Attack': 'Trompowsky',
  'Unclassified': 'Unclassified',
  'Valencia Opening': 'Valencia',
  "Van't Kruijs Opening": 'Van',
  'Vienna Game': 'Vienna',
  'Wade Defence': 'Wade',
  'Ware Opening': 'Ware',
  'Yusupov-Rubinstein System': 'Yusupov-Rubinstein',
  "Zukertort's Opening": 'Zukertort',
};

const dbOpenings = [
  "Unclassified", "Sicilian", "Queens", "French", "Italian", "Caro-Kann", "Kings",
  "Scandinavian", "English", "Ruy", "Scotch", "Indian", "Philidor", "Russian",
  "Four", "Modern", "Zukertort", "Vienna", "Pirc", "Slav"
];

console.log("Checking for mismatches...\n");

const dbToDisplay = {};
for (const [display, db] of Object.entries(DISPLAY_TO_DB_OPENING)) {
  dbToDisplay[db] = display;
}

let missingMappings = [];
for (const dbName of dbOpenings) {
  if (!dbToDisplay[dbName]) {
    missingMappings.push(dbName);
  }
}

if (missingMappings.length > 0) {
  console.log("❌ Database openings WITHOUT display name mappings:");
  missingMappings.forEach(name => console.log(`   - "${name}"`));
} else {
  console.log("✓ All database openings have display name mappings");
}

console.log("\n✓ All openings checked successfully");
