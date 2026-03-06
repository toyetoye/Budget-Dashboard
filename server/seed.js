const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./db');
require('dotenv').config();

const COST_HIERARCHY = [
  { group: "Port Agency Disbursement", elements: [{ code: "22185101", name: "Agency - Transport & Accomm" }, { code: "22185102", name: "Agency - Medical" }] },
  { group: "Recoverable (from crew)", elements: [{ code: "22188001", name: "Slop Chest /Bond" }, { code: "22188002", name: "Cash to Master" }, { code: "22188003", name: "Sundry Deductions" }, { code: "22188004", name: "Private Radio Traffic / Cards" }] },
  { group: "Victualling", elements: [{ code: "22185201", name: "Victualling" }] },
  { group: "Voyage Repairs & Services", elements: [{ code: "22181001", name: "Voy Rep - Deck" }, { code: "22181002", name: "Voy Rep - Engine" }, { code: "22181003", name: "Voy Rep - Electrical" }, { code: "22181004", name: "Voy Rep - Navigation" }, { code: "22181005", name: "Voy Rep - Computing" }, { code: "22181006", name: "Voy Rep - Safety" }, { code: "22181007", name: "Voy Rep - Cargo" }, { code: "22181008", name: "Voy Rep - Cabin" }, { code: "22181009", name: "Voy Rep - Waste/Slop" }, { code: "22181010", name: "Voy Rep - Service Contracts" }] },
  { group: "Surveys and Inspections", elements: [{ code: "22181101", name: "Class Survey" }, { code: "22181102", name: "Industry Inspections" }, { code: "22181103", name: "Internal Audits" }] },
  { group: "Specialist Service", elements: [{ code: "22181201", name: "Omnisafe/ISM Update" }, { code: "22181202", name: "SC - Kongsberg" }, { code: "22181201b", name: "Seagull" }, { code: "22181203", name: "SC - Hyundai Global Services" }, { code: "22181206", name: "SC - Wartsila" }] },
  { group: "Freight Handling and Customs", elements: [{ code: "22182001", name: "Freight - To Warehouse" }, { code: "22182002", name: "Freight - To Port" }, { code: "22182003", name: "Freight - Local" }] },
  { group: "Main Stores", elements: [{ code: "22182101", name: "Stores - Deck" }, { code: "22182102", name: "Stores - Engine" }, { code: "22182106", name: "Stores - Electrical" }, { code: "22182107", name: "Stores - Nav&Radio" }, { code: "22182108", name: "Stores - Charts&Pubs" }, { code: "22182109", name: "Stores - Cargo" }, { code: "22182110", name: "Stores - Cabin" }, { code: "22182111", name: "Stores - Welfare" }] },
  { group: "Mooring Ropes, Wires, Tails", elements: [{ code: "22182103", name: "Stores - Ropes, Wires" }] },
  { group: "Paint & Chemicals", elements: [{ code: "22182104", name: "Stores - Paint" }, { code: "22182105", name: "Stores - Chemicals" }] },
  { group: "HSSE", elements: [{ code: "22182201", name: "HSSE - Health/Medical" }, { code: "22182202", name: "HSSE - Safety" }, { code: "22182203", name: "HSSE - PPE" }, { code: "22182204", name: "HSSE - Security" }, { code: "22182205", name: "HSSE - Environmental" }] },
  { group: "Lubricating Oil", elements: [{ code: "22183001", name: "Lubes - Main" }, { code: "22183002", name: "Lubes - Aux" }, { code: "22183003", name: "Lubes - Other" }] },
  { group: "Depot Spares", elements: [{ code: "22184002", name: "Depot - Engine" }, { code: "22184003", name: "Depot - Electrical" }, { code: "22184008", name: "Depot - Storage Costs" }] },
  { group: "Shipboard Spares", elements: [{ code: "22184101", name: "Spares - Deck" }, { code: "22184102", name: "Spares - Engine" }, { code: "22184103", name: "Spares - Electrical" }, { code: "22184104", name: "Spares - Nav&Rad" }, { code: "22184105", name: "Spares - Safety" }, { code: "22184106", name: "Spares - Cargo" }, { code: "22184107", name: "Spares - Cabin" }] },
  { group: "Project Delivery & Refit", elements: [{ code: "22186001", name: "Drydocking & Refit" }, { code: "22187001", name: "Maintenance Projects" }, { code: "22187002", name: "Special Projects" }, { code: "22188101", name: "Recoverable Costs" }] },
  { group: "Communications", elements: [{ code: "22189001", name: "Radio Traffic" }, { code: "22189002", name: "Internet" }] },
  { group: "Superintendents", elements: [{ code: "22189101", name: "Super - Travel" }] },
  { group: "Owners Port Costs", elements: [{ code: "22189301", name: "Port - In Port" }, { code: "22189302", name: "Port - Agency" }, { code: "22189303", name: "Port - Special Charges" }, { code: "22189304", name: "Port - Waste/Sludge" }] },
  { group: "Other General Expenses", elements: [{ code: "22242004", name: "General Expenses - Other" }, { code: "22189401", name: "Central HSSE" }, { code: "22188102", name: "Admin Costs" }] },
];

const BUDGETS = [
  { g: "Shipboard Spares", s: "Spares - Engine", b: 50000 }, { g: "Shipboard Spares", s: "Spares - Deck", b: 8500 },
  { g: "Shipboard Spares", s: "Spares - Cargo", b: 7500 }, { g: "Shipboard Spares", s: "Spares - Electrical", b: 10000 },
  { g: "Shipboard Spares", s: "Spares - Safety", b: 10000 }, { g: "Shipboard Spares", s: "Spares - Cabin", b: 4000 },
  { g: "Shipboard Spares", s: "Spares - Nav&Rad", b: 3000 },
  { g: "Main Stores", s: "Stores - Engine", b: 19000 }, { g: "Main Stores", s: "Stores - Deck", b: 10000 },
  { g: "Main Stores", s: "Stores - Electrical", b: 15000 }, { g: "Main Stores", s: "Stores - Cabin", b: 13000 },
  { g: "Main Stores", s: "Stores - Cargo", b: 3000 }, { g: "Main Stores", s: "Stores - Nav&Radio", b: 3000 },
  { g: "Main Stores", s: "Stores - Charts&Pubs", b: 10000 }, { g: "Main Stores", s: "Stores - Welfare", b: 5000 },
  { g: "Mooring Ropes, Wires, Tails", s: "Stores - Ropes, Wires", b: 8000 },
  { g: "Paint & Chemicals", s: "Stores - Paint", b: 10000 }, { g: "Paint & Chemicals", s: "Stores - Chemicals", b: 11000 },
  { g: "Victualling", s: "Victualling", b: 162680 },
  { g: "Voyage Repairs & Services", s: "Voy Rep - Engine", b: 13000 }, { g: "Voyage Repairs & Services", s: "Voy Rep - Deck", b: 10000 },
  { g: "Voyage Repairs & Services", s: "Voy Rep - Electrical", b: 3500 }, { g: "Voyage Repairs & Services", s: "Voy Rep - Navigation", b: 2500 },
  { g: "Voyage Repairs & Services", s: "Voy Rep - Computing", b: 12200 }, { g: "Voyage Repairs & Services", s: "Voy Rep - Safety", b: 1500 },
  { g: "Voyage Repairs & Services", s: "Voy Rep - Cargo", b: 10000 }, { g: "Voyage Repairs & Services", s: "Voy Rep - Cabin", b: 2500 },
  { g: "Voyage Repairs & Services", s: "Voy Rep - Waste/Slop", b: 4000 }, { g: "Voyage Repairs & Services", s: "Voy Rep - Service Contracts", b: 10100 },
  { g: "HSSE", s: "HSSE - Health/Medical", b: 3000 }, { g: "HSSE", s: "HSSE - Safety", b: 3500 },
  { g: "HSSE", s: "HSSE - PPE", b: 25200 }, { g: "HSSE", s: "HSSE - Security", b: 3000 },
  { g: "HSSE", s: "HSSE - Environmental", b: 2000 },
  { g: "Other General Expenses", s: "Central HSSE", b: 2000 },
  { g: "Lubricating Oil", s: "Lubes - Main", b: 100000 }, { g: "Lubricating Oil", s: "Lubes - Aux", b: 10000 },
  { g: "Lubricating Oil", s: "Lubes - Other", b: 5000 },
  { g: "Surveys and Inspections", s: "Class Survey", b: 35000 }, { g: "Surveys and Inspections", s: "Industry Inspections", b: 5000 },
  { g: "Surveys and Inspections", s: "Internal Audits", b: 1000 },
  { g: "Freight Handling and Customs", s: "Freight - To Warehouse", b: 10500 }, { g: "Freight Handling and Customs", s: "Freight - To Port", b: 55000 },
  { g: "Freight Handling and Customs", s: "Freight - Local", b: 15000 },
  { g: "Communications", s: "Radio Traffic", b: 12050 }, { g: "Communications", s: "Internet", b: 48327 },
  { g: "Specialist Service", s: "SC - Kongsberg", b: 107500 },
  { g: "Superintendents", s: "Super - Travel", b: 4500 },
  { g: "Port Agency Disbursement", s: "Agency - Transport & Accomm", b: 0 }, { g: "Port Agency Disbursement", s: "Agency - Medical", b: 4000 },
  { g: "Recoverable (from crew)", s: "Cash to Master", b: 0 },
  { g: "Project Delivery & Refit", s: "Drydocking & Refit", b: 0 }, { g: "Project Delivery & Refit", s: "Special Projects", b: 0 },
  { g: "Project Delivery & Refit", s: "Recoverable Costs", b: 2000 },
  { g: "Owners Port Costs", s: "Port - In Port", b: 1 }, { g: "Owners Port Costs", s: "Port - Waste/Sludge", b: 1 },
];

const HO = [
  { n:"240001",t:"RESCUE BOAT; Outboard 2-Stroke (MERCURY MARINE)",st:"Estimate",c:50,s:"Spares - Engine",g:"Shipboard Spares" },
  { n:"240002",t:"DRINKING WATER FOUNTAIN FILTERS",st:"On Order",c:2398.72,s:"Spares - Engine",g:"Shipboard Spares" },
  { n:"240003",t:"Statutory Life-Raft Annual Service",st:"Invoiced",c:13509.30,s:"Class Survey",g:"Surveys and Inspections" },
  { n:"240004",t:"Gas Detection System",st:"On Order",c:9161.40,s:"Spares - Cargo",g:"Shipboard Spares" },
  { n:"240005",t:"Cargo Level Gauge",st:"Invoiced",c:817.80,s:"Spares - Cargo",g:"Shipboard Spares" },
  { n:"240006",t:"Span Gas",st:"On Order",c:254.96,s:"Spares - Cargo",g:"Shipboard Spares" },
  { n:"240007",t:"NSSL Subscription Charges",st:"Invoiced",c:382.13,s:"Internet",g:"Communications" },
  { n:"240008",t:"Printers",st:"On Order",c:1700,s:"Stores - Engine",g:"Main Stores" },
  { n:"240009",t:"LifeBoat Hydraulic Hose",st:"On Order",c:240,s:"Voy Rep - Safety",g:"Voyage Repairs & Services" },
  { n:"240010",t:"Ballast Pump Magnetic Contactor",st:"On Order",c:1100,s:"Voy Rep - Engine",g:"Voyage Repairs & Services" },
  { n:"240011",t:"MV Safety PPE Requisition",st:"On Order",c:3700.61,s:"HSSE - PPE",g:"HSSE" },
  { n:"240012",t:"HOF PPE Requisition",st:"On Order",c:15000,s:"HSSE - PPE",g:"HSSE" },
  { n:"240013",t:"Steering Gear Unit Filter",st:"On Order",c:300,s:"Spares - Engine",g:"Shipboard Spares" },
  { n:"240014",t:"LO Sample Analysis",st:"Invoiced",c:540,s:"Voy Rep - Engine",g:"Voyage Repairs & Services" },
  { n:"240015",t:"Engine Room Stores Jan 2024",st:"Estimate",c:7427.59,s:"Stores - Engine",g:"Main Stores" },
  { n:"240018",t:"Control/GS Compressor Spares",st:"Estimate",c:960,s:"Spares - Engine",g:"Shipboard Spares" },
  { n:"240019",t:"Eye Wash",st:"Estimate",c:160.92,s:"Spares - Safety",g:"Shipboard Spares" },
  { n:"240020",t:"Welfare - Karaoke Equipment",st:"Received",c:2099,s:"Stores - Welfare",g:"Main Stores" },
  { n:"240025",t:"Safety LOFL Gear",st:"Estimate",c:1010.13,s:"HSSE - Safety",g:"HSSE" },
];

const OP = [
  { n:"246001",t:"CTM @ Lagos Jan 2024",st:"Invoiced",u:7455,s:"Cash to Master",g:"Recoverable (from crew)" },
  { n:"246002",t:"WAPS Medical",st:"Invoiced",u:1291.80,s:"Agency - Medical",g:"Port Agency Disbursement" },
  { n:"246003",t:"WAPS CTM STOCKGAP PHC",st:"Invoiced",u:8610,s:"Cash to Master",g:"Recoverable (from crew)" },
  { n:"246005",t:"Agency Dec 2023 Victualling",st:"Invoiced",u:12570.69,s:"Victualling",g:"Victualling" },
  { n:"246007",t:"CTM NSML/24/015 Lagos Feb",st:"Invoiced",u:9030,s:"Cash to Master",g:"Recoverable (from crew)" },
  { n:"246009",t:"Shell Lubes 2024 (Feb)",st:"On Order",u:9736,s:"Lubes - Main",g:"Lubricating Oil" },
  { n:"246010",t:"Deck Stores Feb 2024",st:"Invoiced",u:2348.20,s:"Stores - Deck",g:"Main Stores" },
  { n:"246012",t:"WAPS Agency Template LPG AT 005",st:"Invoiced",u:727.42,s:"Agency - Transport & Accomm",g:"Port Agency Disbursement" },
  { n:"246013",t:"WAPS Agency Template LPG AT 006",st:"Invoiced",u:5140.55,s:"Victualling",g:"Victualling" },
  { n:"246015",t:"Victualling Provisions Feb",st:"Invoiced",u:25187.84,s:"Victualling",g:"Victualling" },
  { n:"246016",t:"Cabin Stores Feb",st:"Invoiced",u:2941.61,s:"Stores - Cabin",g:"Main Stores" },
  { n:"246014",t:"Crew Transfer",st:"Invoiced",u:277.18,s:"Agency - Transport & Accomm",g:"Port Agency Disbursement" },
  { n:"246004a",t:"Agency Dec 2023 Lubes Other",st:"Invoiced",u:211.32,s:"Lubes - Other",g:"Lubricating Oil" },
  { n:"246004b",t:"Agency Dec 2023 PPE",st:"Invoiced",u:281.68,s:"HSSE - PPE",g:"HSSE" },
  { n:"246006",t:"Agency Dec 2023 Voy Rep Engine",st:"Invoiced",u:3602.27,s:"Voy Rep - Engine",g:"Voyage Repairs & Services" },
];

async function seed() {
  await initDB();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    // Clean existing data for fresh seed
    await c.query('DELETE FROM indents');
    await c.query('DELETE FROM budget_categories');
    await c.query('DELETE FROM cost_elements');
    await c.query('DELETE FROM cost_groups');

    // Add unique constraint if missing
    await c.query(`DO $$ BEGIN
      ALTER TABLE budget_categories ADD CONSTRAINT budget_categories_vessel_sub_year_key UNIQUE (vessel_id, sub_category, year);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`);

    // 1. Cost groups & elements
    for (let i = 0; i < COST_HIERARCHY.length; i++) {
      const g = COST_HIERARCHY[i];
      const gr = await c.query('INSERT INTO cost_groups (name,sort_order) VALUES ($1,$2) RETURNING id', [g.group, i]);
      for (let j = 0; j < g.elements.length; j++) {
        const e = g.elements[j];
        await c.query('INSERT INTO cost_elements (cost_group_id,code,name,sort_order) VALUES ($1,$2,$3,$4)', [gr.rows[0].id, e.code, e.name, j]);
      }
    }
    console.log('Cost hierarchy seeded');

    // 2. Users
    const ah = await bcrypt.hash('admin123', 10);
    const sh = await bcrypt.hash('supt123', 10);
    const mh = await bcrypt.hash('manager123', 10);
    const vh = await bcrypt.hash('vessel123', 10);
    await c.query(`INSERT INTO users (username,password,role,display_name) VALUES ('admin',$1,'admin','Fleet Admin') ON CONFLICT (username) DO UPDATE SET password=$1,role='admin'`, [ah]);

    // 3. Vessel
    let vid;
    const vr = await c.query(`INSERT INTO vessels (name,imo,vessel_type) VALUES ('LPG Alfred Temile','9859882','LPG Carrier') ON CONFLICT DO NOTHING RETURNING id`);
    if (vr.rows.length) vid = vr.rows[0].id;
    else vid = (await c.query("SELECT id FROM vessels WHERE imo='9859882'")).rows[0].id;

    await c.query(`INSERT INTO users (username,password,role,vessel_id,display_name) VALUES ('superintendent',$1,'superintendent',$2,'Technical Superintendent') ON CONFLICT (username) DO UPDATE SET password=$1,role='superintendent',vessel_id=$2`, [sh, vid]);
    // Assign superintendent to vessel via junction table
    const suptUser = await c.query("SELECT id FROM users WHERE username='superintendent'");
    if (suptUser.rows.length) {
      await c.query('DELETE FROM user_vessels WHERE user_id=$1', [suptUser.rows[0].id]);
      await c.query('INSERT INTO user_vessels (user_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [suptUser.rows[0].id, vid]);
    }
    await c.query(`INSERT INTO users (username,password,role,display_name) VALUES ('manager',$1,'manager','Fleet Manager') ON CONFLICT (username) DO UPDATE SET password=$1,role='manager'`, [mh]);
    await c.query(`INSERT INTO users (username,password,role,vessel_id,display_name) VALUES ('alfred_temile',$1,'vessel',$2,'LPG Alfred Temile') ON CONFLICT (username) DO UPDATE SET password=$1,role='vessel',vessel_id=$2`, [vh, vid]);

    // 4. Fix legacy schema - drop NOT NULL on old 'category' column if it exists
    await c.query(`DO $$ BEGIN
      ALTER TABLE budget_categories ALTER COLUMN category DROP NOT NULL;
      ALTER TABLE budget_categories ALTER COLUMN category SET DEFAULT NULL;
    EXCEPTION WHEN undefined_column THEN NULL; END $$`);

    // Budgets
    for (const b of BUDGETS) {
      await c.query('INSERT INTO budget_categories (vessel_id,cost_group,sub_category,annual_budget,year) VALUES ($1,$2,$3,$4,2024) ON CONFLICT (vessel_id,sub_category,year) DO UPDATE SET annual_budget=$4,cost_group=$2', [vid, b.g, b.s, b.b]);
    }
    console.log(`${BUDGETS.length} budget lines seeded`);

    // 5. HO Indents
    for (const i of HO) {
      await c.query('INSERT INTO indents (vessel_id,indent_number,title,cost_group,sub_category,source,status,cost_usd) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [vid,i.n,i.t,i.g,i.s,'HO',i.st,i.c]);
    }
    // 6. Outport Indents
    for (const i of OP) {
      await c.query('INSERT INTO indents (vessel_id,indent_number,title,cost_group,sub_category,source,status,cost_usd) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [vid,i.n,i.t,i.g,i.s,'Outport',i.st,i.u]);
    }
    console.log(`${HO.length} HO + ${OP.length} Outport indents seeded`);

    await c.query('COMMIT');
    console.log('\nSeed complete!');
    console.log('admin / admin123         (Admin)');
    console.log('superintendent / supt123 (Superintendent)');
    console.log('manager / manager123     (Manager - read only)');
    console.log('alfred_temile / vessel123 (Vessel)');
  } catch (err) { await c.query('ROLLBACK'); console.error('Seed failed:', err); }
  finally { c.release(); await pool.end(); }
}

seed();
