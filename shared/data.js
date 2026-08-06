// =======================================================================
// SHARED DATA — every page includes this. Pure constant tables + a few
// tiny pure-function helpers. No DOM, no localStorage, no canvas here.
// =======================================================================
const MAX_SLOTS_CLIENT=5;
const SLOT_COSTS_CLIENT={3:150,4:300,5:500};

const AREA_TOWER_DROP_RATE=0.35;
const AREA_TOWER_UNLOCKS=["hacktower","magmacannon","frostlance","sandreaper","voidray","swampmaw","neonblade","phantomtrap","krakenharpoon","hivespike"];

const TOWER_STATS={
  acid:{ name:"Acid Repeater", desc:"Fast attack. Medium damage. Long range.", unlockCost:0, cost:200, range:225, damage:15, fireRate:20, color:"#39ff14" },
  super:{ name:"Plasma Super", desc:"Super plasma beam attack. Hits enemies in the beam.", unlockCost:400, cost:750, range:75, damage:60, fireRate:100, color:"#b026ff" },
  freeze:{ name:"Freeze Machine", desc:"Freezes aliens in a large area.", unlockCost:300, cost:550, range:175, damage:0.1, fireRate:50, color:"#00f0ff" },
  sniper:{ name:"Sniper Nest", desc:"Extreme range, huge single-target damage, slow fire rate.", unlockCost:900, cost:650, range:420, damage:220, fireRate:130, color:"#ffd700" },
  tesla:{ name:"Tesla Coil", desc:"Chains lightning to nearby aliens on impact.", unlockCost:1100, cost:700, range:150, damage:35, fireRate:45, color:"#fff200" },
  missile:{ name:"Missile Silo", desc:"Fires explosive missiles with splash damage.", unlockCost:1400, cost:850, range:260, damage:70, fireRate:70, color:"#ff6600", splash:65 },
  railgun:{ name:"Railgun", desc:"Fires a piercing shot that hits every alien in its line.", unlockCost:1700, cost:900, range:500, damage:130, fireRate:110, color:"#66ffff" },
  flame:{ name:"Flame Turret", desc:"Continuous burn damage to all aliens in a small radius.", unlockCost:1300, cost:600, range:130, damage:9, fireRate:8, color:"#ff3300" },
  vortex:{ name:"Vortex Emitter", desc:"Pulls nearby aliens inward while dealing damage over time.", unlockCost:2000, cost:950, range:150, damage:14, fireRate:15, color:"#9d00ff", pullForce:0.6 },
  poison:{ name:"Toxin Injector", desc:"Weak hit, but injects a toxin that deals heavy damage over time.", unlockCost:1900, cost:700, range:190, damage:8, fireRate:40, color:"#66ff33", poisonDps:5, poisonDuration:150 },
  emp:{ name:"EMP Disruptor", desc:"Pulses all aliens in range, stunning them in place.", unlockCost:2300, cost:1000, range:170, damage:3, fireRate:180, color:"#00ffff", empStun:70 },
  hijack:{ name:"Neural Hijacker", desc:"ONE-TIME USE. Turns a single alien against its own kind, then self-destructs.", unlockCost:1600, cost:500, range:210, damage:0, fireRate:1, color:"#ff00ff", oneTime:true },
  blackhole:{ name:"Singularity Core", desc:"Collapses spacetime in a massive radius, obliterating every alien caught inside.", unlockCost:3200, cost:2000, range:260, damage:900, fireRate:260, color:"#c084ff" },
  hacktower:{ name:"Firewall Breaker", desc:"[Mainframe] Rapid-fire data spikes that ignore armor.", unlockCost:1200, cost:600, range:200, damage:20, fireRate:14, color:"#39ff14", areaLocked:true, areaIndex:0, ignoresArmor:true },
  magmacannon:{ name:"Magma Cannon", desc:"[Magma Depths] Lobs molten splash shots.", unlockCost:1500, cost:750, range:240, damage:55, fireRate:55, color:"#ff6a00", areaLocked:true, areaIndex:1, splash:70 },
  frostlance:{ name:"Frost Lance", desc:"[Frozen Wastes] Pierces and heavily slows a line of enemies.", unlockCost:1600, cost:700, range:300, damage:40, fireRate:65, color:"#aeeaff", areaLocked:true, areaIndex:2, pierce:true, slowFactor:0.3 },
  sandreaper:{ name:"Sand Reaper", desc:"[Dune Sea] Whirling blades that hit everything nearby.", unlockCost:1700, cost:800, range:140, damage:18, fireRate:10, color:"#ffcf6b", areaLocked:true, areaIndex:3 },
  voidray:{ name:"Void Ray", desc:"[Deep Space] Continuous beam, ramps up damage the longer it channels.", unlockCost:1900, cost:900, range:260, damage:12, fireRate:5, color:"#c9d6ff", areaLocked:true, areaIndex:4 },
  swampmaw:{ name:"Swamp Maw", desc:"[Toxic Swamp] Bites for heavy damage, applies deep poison.", unlockCost:2000, cost:850, range:120, damage:45, fireRate:35, color:"#8aff33", areaLocked:true, areaIndex:5, poisonDps:8, poisonDuration:180 },
  neonblade:{ name:"Neon Blade Array", desc:"[Neon City] Extremely fast, low-damage slashes.", unlockCost:2200, cost:900, range:160, damage:9, fireRate:5, color:"#ff2fd0", areaLocked:true, areaIndex:6 },
  phantomtrap:{ name:"Phantom Trap", desc:"[Haunted Grounds] Roots and damages one target until it dies.", unlockCost:2400, cost:950, range:180, damage:26, fireRate:12, color:"#b7ffcf", areaLocked:true, areaIndex:7 },
  krakenharpoon:{ name:"Kraken Harpoon", desc:"[The Abyss] Massive single-target harpoon shot.", unlockCost:2600, cost:1000, range:380, damage:260, fireRate:90, color:"#33bbff", areaLocked:true, areaIndex:8 },
  hivespike:{ name:"Hive Spike", desc:"[The Hive Core] Organic turret, grows stronger the longer it survives.", unlockCost:2800, cost:1050, range:220, damage:30, fireRate:20, color:"#ff1155", areaLocked:true, areaIndex:9 },
  flosswall:{ name:"Floss Wall", desc:"A moving wall that blocks aliens. Cannot be upgraded or flossed. Only one allowed on the field. Price rises the more times you place one in a run.", unlockCost:1250, cost:100, range:0, damage:0, fireRate:1, color:"#ffffff", isWall:true, wallHp:400 },
  omega:{ name:"OMEGA ANNIHILATOR", desc:"ADMIN ONLY. Erases anything that enters its range.", unlockCost:0, cost:0, range:9999, damage:999999, fireRate:1, color:"#ffffff", admin:true },
  secretop:{ name:"VOIDBRINGER", desc:"SECRET. Extremely rare summon-only turret.", unlockCost:0, cost:0, range:320, damage:400, fireRate:12, color:"#ff00ff", admin:true, secretSummon:true }
};

const SUMMON_TOWER_IDS=["biospire","cryospike","solarray","quantumcell","plaguepod","stormcaller","obsidianfist","coralsentry","embercore","aetherlance"];
const SUMMON_TOWER_DEFS={
  biospire:   { name:"Biospire",       desc:"[Summon] Grows tendrils that lash multiple aliens.", cost:800, range:170, damage:26, fireRate:16, color:"#7CFC00" },
  cryospike: { name:"Cryospike",      desc:"[Summon] Impales and deep-freezes a single target.", cost:850, range:230, damage:60, fireRate:60, color:"#7fd8ff" },
  solarray:  { name:"Solarray",       desc:"[Summon] Focused sunbeam, ramps up the longer it's aimed.", cost:900, range:280, damage:18, fireRate:6, color:"#ffdd55" },
  quantumcell:{name:"Quantum Cell",   desc:"[Summon] Randomly teleports damage to any alien on the field.", cost:1000, range:9999, damage:24, fireRate:35, color:"#66e0ff" },
  plaguepod: { name:"Plague Pod",     desc:"[Summon] Bursts spores that spread infection between aliens.", cost:900, range:150, damage:10, fireRate:30, color:"#a0ff40", poisonDps:6, poisonDuration:200 },
  stormcaller:{name:"Stormcaller",    desc:"[Summon] Calls lightning strikes across its whole range.", cost:1100, range:220, damage:32, fireRate:40, color:"#ffe97f" },
  obsidianfist:{name:"Obsidian Fist", desc:"[Summon] Slow, devastating melee smash with splash.", cost:1200, range:110, damage:140, fireRate:80, color:"#4a2b6b", splash:80 },
  coralsentry:{name:"Coral Sentry",   desc:"[Summon] Passive turret that slowly heals nearby towers' cooldowns.", cost:950, range:200, damage:14, fireRate:25, color:"#ff8fb1" },
  embercore: { name:"Ember Core",     desc:"[Summon] Smolders enemies with a growing burn.", cost:1050, range:160, damage:12, fireRate:12, color:"#ff5a1f" },
  aetherlance:{name:"Aether Lance",   desc:"[Summon] Pierces the entire lane in a straight line.", cost:1400, range:9999, damage:95, fireRate:75, color:"#d9b3ff" }
};
for(const id of SUMMON_TOWER_IDS){ TOWER_STATS[id]=Object.assign({unlockCost:0,summonOnly:true},SUMMON_TOWER_DEFS[id]); }
const TOWER_CRATE={ name:"Tower Beacon", cost:12 };

const towerImages={};
for(const type in TOWER_STATS){ towerImages[type]=new Image(); }

const ENEMY_TYPES={
  normal:{name:"Alien",color:"#ffff00",size:12,hp:30,speed:1.8,reward:10},
  runner:{name:"Runner",color:"#ff8a00",size:10,hp:18,speed:3.4,reward:14},
  stunner:{name:"Stunner",color:"#b026ff",size:14,hp:50,speed:1.5,reward:22,stunRadius:150,stunDuration:60,stunInterval:110},
  tank:{name:"Tank",color:"#ff0000",size:18,hp:120,speed:0.95,reward:30,armored:true},
  shielded:{name:"Shielded Drone",color:"#00d4ff",size:15,hp:170,speed:1.3,reward:26},
  splitter:{name:"Splitter",color:"#ff44cc",size:16,hp:60,speed:1.4,reward:20,splitsInto:"splitling",splitCount:2},
  splitling:{name:"Splitling",color:"#ff99dd",size:8,hp:12,speed:2.1,reward:5,tiny:true},
  cloaked:{name:"Cloaked Stalker",color:"#888888",size:13,hp:65,speed:1.9,reward:24,cloakInterval:90,cloakDuration:45},
  juggernaut:{name:"Juggernaut",color:"#aa0000",size:22,hp:400,speed:0.6,reward:60,armored:true,heavy:true},
  boss:{name:"Boss",color:"#00ff88",size:28,hp:850,speed:0.75,reward:200,stunRadius:250,stunDuration:90,stunInterval:75},
  glitch:{name:"Glitch Wisp",color:"#39ff14",size:10,hp:20,speed:3.2,reward:14,cloakInterval:55,cloakDuration:25,shape:"wisp"},
  daemon:{name:"Rogue Daemon",color:"#00ffcc",size:10,hp:20,speed:3.2,reward:14,shape:"wisp"},
  trojan:{name:"Trojan Crawler",color:"#2fbf71",size:18,hp:130,speed:0.95,reward:32,armored:true,shape:"brute"},
  cinder:{name:"Cinder Brute",color:"#ff6a00",size:18,hp:166,speed:0.95,reward:42,armored:true,shape:"brute"},
  ashling:{name:"Ash Wisp",color:"#ffb347",size:10,hp:26,speed:3.2,reward:18,shape:"wisp"},
  obsidianite:{name:"Obsidian Crab",color:"#5c3a21",size:18,hp:166,speed:0.95,reward:42,armored:true,shape:"brute"},
  frostfang:{name:"Frostfang",color:"#aeeaff",size:10,hp:31,speed:3.2,reward:23,shape:"fang"},
  icewraith:{name:"Ice Wraith",color:"#d6f7ff",size:13,hp:94,speed:1.9,reward:36,cloakInterval:70,cloakDuration:40,shape:"wraith"},
  glacierback:{name:"Glacierback",color:"#8fd9ff",size:18,hp:203,speed:0.95,reward:52,armored:true,shape:"brute"},
  burrower:{name:"Sand Burrower",color:"#ffcf6b",size:22,hp:773,speed:0.6,reward:127,armored:true,heavy:true,shape:"burrower"},
  scarab:{name:"Sand Scarab",color:"#e0b34d",size:16,hp:120,speed:1.4,reward:43,shape:"burrower"},
  mirage:{name:"Mirage Phantom",color:"#fff0c2",size:13,hp:110,speed:1.9,reward:43,cloakInterval:60,cloakDuration:50,shape:"wraith"},
  drifter:{name:"Void Drifter",color:"#c9d6ff",size:10,hp:42,speed:3.2,reward:32,shape:"drifter"},
  meteorhusk:{name:"Meteor Husk",color:"#8892b0",size:18,hp:276,speed:0.95,reward:73,armored:true,shape:"brute"},
  nebulamoth:{name:"Nebula Moth",color:"#e0d6ff",size:13,hp:127,speed:1.9,reward:50,cloakInterval:65,cloakDuration:45,shape:"wraith"},
  leech:{name:"Bog Leech",color:"#8aff33",size:16,hp:156,speed:1.4,reward:57,splitsInto:"leechling",splitCount:3,shape:"leech"},
  leechling:{name:"Leechling",color:"#c6ff99",size:8,hp:30,speed:2.4,reward:10,tiny:true,shape:"leech"},
  sporeling:{name:"Spore Drone",color:"#c6ff66",size:10,hp:48,speed:3.2,reward:36,shape:"wisp"},
  bogcrawler:{name:"Bog Crawler",color:"#557a1f",size:18,hp:312,speed:0.95,reward:83,armored:true,shape:"brute"},
  wraith:{name:"Data Wraith",color:"#ff2fd0",size:14,hp:147,speed:1.5,reward:70,cloakInterval:80,cloakDuration:45,shape:"wraith"},
  circuitbreaker:{name:"Circuit Breaker",color:"#ff77e6",size:14,hp:147,speed:1.5,reward:70,stunRadius:140,stunDuration:50,stunInterval:100},
  hologram:{name:"Hologram Decoy",color:"#ff9ff0",size:13,hp:161,speed:1.9,reward:64,cloakInterval:50,cloakDuration:55,shape:"wraith"},
  specter:{name:"Specter",color:"#b7ffcf",size:14,hp:163,speed:1.5,reward:78,cloakInterval:70,cloakDuration:55,shape:"wraith"},
  ghoul:{name:"Ghoul",color:"#8fae8f",size:18,hp:385,speed:0.95,reward:104,armored:true,shape:"brute"},
  banshee:{name:"Banshee",color:"#d9fff0",size:13,hp:178,speed:1.9,reward:71,cloakInterval:55,cloakDuration:50,shape:"wraith"},
  angler:{name:"Angler Horror",color:"#33bbff",size:18,hp:421,speed:0.95,reward:114,armored:true,stunRadius:180,stunDuration:70,stunInterval:95,shape:"angler"},
  jellydrifter:{name:"Jelly Drifter",color:"#7fe0ff",size:10,hp:65,speed:3.2,reward:50,shape:"drifter"},
  deepcrawler:{name:"Deep Crawler",color:"#4fa8cc",size:13,hp:194,speed:1.9,reward:78,cloakInterval:70,cloakDuration:40,shape:"wraith"},
  broodling:{name:"Brood Mother",color:"#ff1155",size:22,hp:1478,speed:0.6,reward:252,armored:true,heavy:true,splitsInto:"broodletling",splitCount:3,shape:"brute"},
  broodletling:{name:"Broodletling",color:"#ff6699",size:9,hp:45,speed:2.6,reward:14,tiny:true},
  hivelarva:{name:"Hive Larva",color:"#ff6699",size:8,hp:42,speed:2.2,reward:23,tiny:true},
  hiveguardian:{name:"Hive Guardian",color:"#c40d3f",size:18,hp:458,speed:0.95,reward:124,armored:true,shape:"brute"},
  impostor:{name:"The Impostor",color:"#c51111",size:16,hp:80,speed:2.0,reward:150,cloakInterval:200,cloakDuration:20,shape:"impostor"}
};
const BEAST_ORDER=["normal","runner","stunner","tank","shielded","splitter","splitling","cloaked","juggernaut",
  "glitch","daemon","trojan","cinder","ashling","obsidianite","frostfang","icewraith","glacierback",
  "burrower","scarab","mirage","drifter","meteorhusk","nebulamoth","leech","leechling","sporeling","bogcrawler",
  "wraith","circuitbreaker","hologram","specter","ghoul","banshee","angler","jellydrifter","deepcrawler",
  "broodling","broodletling","hivelarva","hiveguardian","impostor"];
const BEAST_DESC={
  normal:"The baseline grunt. No tricks, no gimmicks - just numbers.",
  runner:"Fragile but fast. Outruns slow-firing towers if left unchecked.",
  stunner:"Periodically pulses a stun field, freezing nearby towers.",
  tank:"Slow-moving wall of health. Absorbs sustained fire.",
  shielded:"Wrapped in a rotating energy barrier - high HP, mechanical.",
  splitter:"Bursts into two Splitlings on death.",
  splitling:"The quick, weak offspring left behind when a Splitter dies.",
  cloaked:"Flickers in and out of visibility.",
  juggernaut:"A crawling fortress. Glacially slow, but the toughest non-boss on the field.",
  glitch:"A flickering corrupted process from the Mainframe.",
  daemon:"A rogue background process that slipped its sandbox.",
  trojan:"Disguised as harmless code - hits like an armored brick.",
  cinder:"A molten brawler dredged up from the Magma Depths.",
  ashling:"A skittering cinder that outruns most defenses.",
  obsidianite:"A crab-like shell of cooled volcanic glass.",
  frostfang:"An arctic predator that closes distance fast.",
  icewraith:"A translucent chill that fades in and out of sight.",
  glacierback:"A lumbering wall of packed glacial ice.",
  burrower:"An armored digger from the Dune Sea.",
  scarab:"A segmented sand-dweller with a tough shell.",
  mirage:"A heat-shimmer illusion that's hard to pin down.",
  drifter:"A weightless Deep Space stray.",
  meteorhusk:"A burnt-out meteorite fragment, still armored and dangerous.",
  nebulamoth:"A drifting cloud of luminous space dust.",
  leech:"A swollen parasite from the Toxic Swamp.",
  leechling:"A small hungry offshoot of a Bog Leech.",
  sporeling:"A quick puff of drifting toxic spores.",
  bogcrawler:"A sludge-caked brute that wades through the muck.",
  wraith:"A rogue Neon City process that phases in and out.",
  circuitbreaker:"Pulses an overload field that shorts out nearby towers.",
  hologram:"A projected decoy that flickers between real and fake.",
  specter:"A restless spirit of the Haunted Grounds.",
  ghoul:"A shambling grave-dweller, slow but durable.",
  banshee:"A wailing spirit that vanishes when it senses danger.",
  angler:"A deep-sea lurker from the Abyss.",
  jellydrifter:"A translucent drifter pulsing through the current.",
  deepcrawler:"A pressure-adapted stalker of the ocean floor.",
  broodling:"A bloated Hive Core matriarch. Splits into three on death.",
  broodletling:"A skittering offshoot of a Brood Mother.",
  hivelarva:"A tiny, freshly-hatched Hive Core grub.",
  hiveguardian:"A hardened Hive Core sentinel guarding its brood.",
  impostor:"Sus. Definitely not one of us. Extremely rare, worth a huge bounty."
};
const AREA_EXCLUSIVE_TYPES=[
  ["glitch","daemon","trojan"],
  ["cinder","ashling","obsidianite"],
  ["frostfang","icewraith","glacierback"],
  ["burrower","scarab","mirage"],
  ["drifter","meteorhusk","nebulamoth"],
  ["leech","sporeling","bogcrawler"],
  ["wraith","circuitbreaker","hologram"],
  ["specter","ghoul","banshee"],
  ["angler","jellydrifter","deepcrawler"],
  ["broodling","hivelarva","hiveguardian"]
];
const AREA_SIGNATURE_TYPE=AREA_EXCLUSIVE_TYPES.map(trio=>trio[0]);
const RECURRING_TYPES=["normal","runner","stunner","tank","shielded","splitter","splitling","cloaked","juggernaut"];

const AREAS=[
  { name:"The Mainframe",   theme:"hacker",    bg:["#001a00","#000d00"], accent:"#39ff14", boss:{name:"Mainframe Overlord",   color:"#39ff14"} },
  { name:"Magma Depths",    theme:"volcano",   bg:["#3a0d02","#160400"], accent:"#ff6a00", boss:{name:"Magma Colossus",       color:"#ff6a00"} },
  { name:"Frozen Wastes",   theme:"arctic",    bg:["#0d2a3a","#01121c"], accent:"#aeeaff", boss:{name:"Frost Wyrm",           color:"#aeeaff"} },
  { name:"Dune Sea",        theme:"desert",    bg:["#3a2a0d","#1c1204"], accent:"#ffcf6b", boss:{name:"Sand Behemoth",        color:"#ffcf6b"} },
  { name:"Deep Space",      theme:"space",     bg:["#020212","#000005"], accent:"#c9d6ff", boss:{name:"Void Leviathan",       color:"#c9d6ff"} },
  { name:"Toxic Swamp",     theme:"swamp",     bg:["#132a0d","#081405"], accent:"#8aff33", boss:{name:"Sludge Titan",         color:"#8aff33"} },
  { name:"Neon City",       theme:"cyberpunk", bg:["#1a0a2a","#0a0414"], accent:"#ff2fd0", boss:{name:"Neon Reaper",          color:"#ff2fd0"} },
  { name:"Haunted Grounds", theme:"graveyard", bg:["#1c1c24","#0a0a0f"], accent:"#b7ffcf", boss:{name:"Wraith King",          color:"#b7ffcf"} },
  { name:"The Abyss",       theme:"underwater",bg:["#021a2e","#010b15"], accent:"#33bbff", boss:{name:"Abyssal Kraken",       color:"#33bbff"} },
  { name:"The Hive Core",   theme:"hive",      bg:["#2a0018","#12000a"], accent:"#ff1155", boss:{name:"Hive Mother",          color:"#ff1155"} }
];

const MODES={
  easy:   {name:"EASY",     hpMul:0.7, speedMul:0.85, color:"#39ff14"},
  normal: {name:"NORMAL",   hpMul:1.0, speedMul:1.0,  color:"#00f0ff"},
  hard:   {name:"HARD",     hpMul:1.5, speedMul:1.15, color:"#ffae00"},
  extreme:{name:"EXTREME MODE",  hpMul:2.2, speedMul:1.3, color:"#ff0055"},
  expert: {name:"EXPERT MODE!",  hpMul:3.2, speedMul:1.5, color:"#ff00ff"}
};

const POWERUP_DEFS=[
  {id:"dmg",     name:"Overcharge",      rarity:"common",    desc:"+X% tower damage",              values:[10,20,35]},
  {id:"range",   name:"Long Sight",      rarity:"common",    desc:"+X% tower range",               values:[10,20,35]},
  {id:"fire",    name:"Quickfire",       rarity:"uncommon",  desc:"+X% fire rate",                 values:[8,16,28]},
  {id:"gold",    name:"Prospector",      rarity:"uncommon",  desc:"+X% credits earned from this tower's kills", values:[10,20,35]},
  {id:"lives",   name:"Reinforced Core", rarity:"rare",      desc:"+X core shields at start (account passive, not tower-equippable)", values:[1,2,4]},
  {id:"splash",  name:"Wide Blast",      rarity:"rare",      desc:"+X% splash radius (splash towers only)", values:[15,30,50]},
  {id:"crit",    name:"Weak Point",      rarity:"epic",      desc:"X% chance to deal double damage",values:[10,18,30]},
  {id:"cooldown",name:"Overclock",       rarity:"epic",      desc:"-X% tower cooldown",             values:[10,18,30]},
  {id:"biomass", name:"Harvester",       rarity:"legendary", desc:"+X% biomass from kills (account passive, not tower-equippable)", values:[15,30,50]},
  {id:"revive",  name:"Second Wind",     rarity:"legendary", desc:"First revive each run is X% cheaper (account passive, not tower-equippable)", values:[20,35,55]},
  {id:"godslayer",name:"GODSLAYER",      rarity:"godly",     desc:"+X% damage to bosses only",       values:[15,30,50]}
];
const TOWER_EQUIPPABLE_CARD_IDS=["dmg","range","fire","gold","splash","crit","cooldown","godslayer"];
const RARITY_ORDER=["common","uncommon","rare","epic","legendary","godly"];
const RARITY_COLOR={common:"#9fd8a0",uncommon:"#39ff14",rare:"#00f0ff",epic:"#b026ff",legendary:"#ffd700",godly:"#ff0055"};

function powerupDescForLevel(def,level){
  if(!def) return "";
  const idx=Math.max(0,Math.min((def.values.length||1)-1,(parseInt(level,10)||1)-1));
  const v=def.values[idx];
  return def.desc.replace("X",v);
}
const LEVEL_DURABILITY={1:1,2:3,3:6};
const RARITY_REPAIR_INFO={
  common:   {amount:1, cost:20},
  uncommon: {amount:1, cost:40},
  rare:     {amount:2, cost:80},
  epic:     {amount:2, cost:150},
  legendary:{amount:3, cost:300},
  godly:    {amount:3, cost:600}
};

const CRATES=[
  {id:1,name:"Common Crate",cost:5,music:"crate1",
    odds:{common:55,uncommon:28,rare:12,epic:4,legendary:0.9,godly:0.1}},
  {id:2,name:"Rare Crate",cost:15,music:"crate2",
    odds:{common:30,uncommon:32,rare:24,epic:10,legendary:3.5,godly:0.5}},
  {id:3,name:"Legendary Crate",cost:40,music:"crate3",
    odds:{common:10,uncommon:20,rare:28,epic:25,legendary:15,godly:2}}
];
function rollRarity(odds){
  const r=Math.random()*100;
  let acc=0;
  for(const rar of RARITY_ORDER){
    acc+=odds[rar]||0;
    if(r<=acc) return rar;
  }
  return "common";
}

const MATERIAL_TIERS=["common","uncommon","rare","epic","legendary"];
const MATERIAL_COLOR={common:"#9fd8a0",uncommon:"#39ff14",rare:"#00f0ff",epic:"#b026ff",legendary:"#ffd700"};
const MATERIAL_NAME={common:"Chitin Shard",uncommon:"Alloy Core",rare:"Plasma Crystal",epic:"Void Residue",legendary:"Genesis Cell"};

const ARMOR_DEFS=[
  {id:"plate",   name:"Reactive Plating",  rarity:"common",    desc:"+X% tower damage",          values:[8,16,28]},
  {id:"visor",   name:"Targeting Visor",   rarity:"common",    desc:"+X% tower range",           values:[8,16,28]},
  {id:"servo",   name:"Servo Actuator",    rarity:"uncommon",  desc:"+X% fire rate",              values:[6,14,24]},
  {id:"coil",    name:"Capacitor Coil",    rarity:"uncommon",  desc:"-X% cooldown on special attacks", values:[6,14,24]},
  {id:"shell",   name:"Ablative Shell",    rarity:"rare",      desc:"Towers take X% less stun duration", values:[15,30,50]},
  {id:"core",    name:"Overdrive Core",    rarity:"rare",      desc:"+X% splash/AoE radius",      values:[10,20,35]},
  {id:"barb",    name:"Barbed Housing",    rarity:"epic",      desc:"+X% chance to deal double damage", values:[8,16,26]},
  {id:"sink",    name:"Heat Sink Array",   rarity:"epic",      desc:"+X% damage vs armored aliens", values:[10,20,32]},
  {id:"prism",   name:"Prism Lattice",     rarity:"legendary", desc:"+X% credits from this tower's kills", values:[10,20,35]},
  {id:"crown",   name:"Sovereign Crown",   rarity:"godly",     desc:"+X% damage to bosses only",  values:[15,30,50]}
];
function armorDescForLevel(def,level){
  if(!def) return "";
  const idx=Math.max(0,Math.min((def.values.length||1)-1,(parseInt(level,10)||1)-1));
  return def.desc.replace("X",def.values[idx]);
}
const ARMOR_CRATES=[
  {id:1,name:"Common Armor Crate",cost:6,music:"crate1",odds:{common:55,uncommon:28,rare:12,epic:4,legendary:0.9,godly:0.1}},
  {id:2,name:"Rare Armor Crate",cost:18,music:"crate2",odds:{common:30,uncommon:32,rare:24,epic:10,legendary:3.5,godly:0.5}},
  {id:3,name:"Legendary Armor Crate",cost:45,music:"crate3",odds:{common:10,uncommon:20,rare:28,epic:25,legendary:15,godly:2}}
];
