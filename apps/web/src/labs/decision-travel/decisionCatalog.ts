export type ChoiceKind = "career" | "major" | "pet";

export interface StartupCostItem {
  label: string;
  amount: number;
  description: string;
}

export interface RoleArtwork {
  src: string;
}

export interface DecisionChoiceDetails {
  id: string;
  kind: ChoiceKind;
  category: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  startingSalary: number;
  cost: number;
  costLabel: string;
  timeLabel: string;
  outlook: "Steady" | "Growing" | "Fast growing" | "Competitive" | "Low care" | "Moderate care" | "High care";
  tags: readonly string[];
  note: string;
  startupSummary?: string;
  startupItems?: readonly StartupCostItem[];
  artwork?: RoleArtwork;
  monthlyCost?: number;
  weeklyHours?: number;
  housingLabel?: string;
  commitmentLabel?: string;
}

type ChoiceTuple = readonly [
  id: string,
  category: string,
  difficulty: 1 | 2 | 3 | 4 | 5,
  startingSalary: number,
  cost: number,
  costLabel: string,
  timeLabel: string,
  outlook: DecisionChoiceDetails["outlook"],
  tags: readonly string[],
  note: string,
];

function fromTuples(kind: Exclude<ChoiceKind, "pet">, rows: readonly ChoiceTuple[]): readonly DecisionChoiceDetails[] {
  return rows.map(([id, category, difficulty, startingSalary, cost, costLabel, timeLabel, outlook, tags, note]) => ({
    id, kind, category, difficulty, startingSalary, cost, costLabel, timeLabel, outlook, tags, note,
    ...(kind === "career" ? CAREER_STARTUP_DETAILS[id] : MAJOR_COMMITMENT_DETAILS[id]),
    artwork: { src: `/role-cards/${kind === "career" ? "roles" : "majors"}/${id}.svg` },
  }));
}

const CAREER_STARTUP_DETAILS: Readonly<Record<string, Pick<DecisionChoiceDetails, "startupSummary" | "startupItems">>> = {
  retail: {
    startupSummary: "The role starts quickly, but you still need dependable workwear and a reliable way to reach changing shifts.",
    startupItems: [
      { label: "Supportive work shoes", amount: 110, description: "Long shifts on hard floors make safe, comfortable footwear a practical first purchase." },
      { label: "Work-ready clothing", amount: 90, description: "A small rotation that meets the employer's dress code." },
      { label: "First-week transit", amount: 50, description: "Bus fare, fuel, or rides until the first paycheck arrives." },
    ],
  },
  warehouse: {
    startupSummary: "Warehouse work commonly requires safety gear before you can step onto the floor.",
    startupItems: [
      { label: "Safety-toe boots", amount: 150, description: "Required foot protection for loading, inventory, and equipment areas." },
      { label: "Gloves and high-visibility gear", amount: 80, description: "Basic personal protective equipment not always supplied on day one." },
      { label: "Shift commute setup", amount: 120, description: "Transportation for early, late, or industrial-park shifts." },
    ],
  },
  sales: {
    startupSummary: "A client-facing sales role needs a credible presentation and tools for calls, meetings, and follow-up.",
    startupItems: [
      { label: "Client-ready wardrobe", amount: 220, description: "A compact set of professional outfits for interviews and meetings." },
      { label: "Phone and sales tools", amount: 100, description: "A headset, data plan, and basic contact-management setup." },
      { label: "Meeting transportation", amount: 180, description: "Fuel, transit, or rides for the first round of client appointments." },
    ],
  },
  "administrative-assistant": {
    startupSummary: "Office work rewards software fluency and a polished, dependable first impression.",
    startupItems: [
      { label: "Office software classes", amount: 250, description: "Short courses in spreadsheets, calendars, documents, and records." },
      { label: "Professional wardrobe", amount: 180, description: "Workplace-appropriate clothing for a regular office schedule." },
      { label: "Commute reserve", amount: 170, description: "Transportation costs carried until the first paycheck." },
    ],
  },
  "customer-support": {
    startupSummary: "Remote or hybrid support requires a quiet, dependable place to take customer calls.",
    startupItems: [
      { label: "Call-quality headset", amount: 100, description: "A durable microphone and headset for clear conversations." },
      { label: "Home-office basics", amount: 250, description: "Desk, chair, lighting, and privacy improvements for full shifts." },
      { label: "Internet setup", amount: 100, description: "Activation or equipment costs for reliable service." },
    ],
  },
  "bank-teller": {
    startupSummary: "Banks often require screening plus conservative workwear before training begins.",
    startupItems: [
      { label: "Background checks", amount: 60, description: "Identity, fingerprint, or financial-trust screening fees." },
      { label: "Branch-ready wardrobe", amount: 180, description: "Professional clothing suitable for daily customer contact." },
      { label: "Training commute", amount: 60, description: "Transportation during the onboarding period." },
    ],
  },
  "construction-laborer": {
    startupSummary: "You cannot safely join a construction crew without protective gear, basic tools, and site credentials.",
    startupItems: [
      { label: "Boots and PPE", amount: 300, description: "Safety-toe boots, eye and hearing protection, gloves, and a hard hat." },
      { label: "Starter tool kit", amount: 400, description: "Core hand tools expected on common residential and commercial sites." },
      { label: "Safety cards and classes", amount: 200, description: "Entry safety orientation, first aid, or locally required site training." },
    ],
  },
  "delivery-driver": {
    startupSummary: "Delivery work depends on a clean license, reliable navigation, and a vehicle ready for heavy use.",
    startupItems: [
      { label: "License and record checks", amount: 120, description: "Driving-record, background, and onboarding fees." },
      { label: "Phone mount and delivery gear", amount: 130, description: "Hands-free navigation, charging, bags, and weather protection." },
      { label: "Vehicle readiness reserve", amount: 400, description: "Inspection, maintenance, fuel, or insurance changes before regular routes." },
    ],
  },
  "medical-assistant": {
    startupSummary: "Clinical employers typically expect formal training, screening, and patient-safe work equipment.",
    startupItems: [
      { label: "Certificate classes", amount: 2_600, description: "A short medical-assisting program covering clinical and office skills." },
      { label: "Exam and background screening", amount: 400, description: "Credential testing, immunization records, and required checks." },
      { label: "Scrubs and clinical equipment", amount: 800, description: "Workwear, shoes, basic instruments, and course supplies." },
    ],
  },
  "pharmacy-technician": {
    startupSummary: "Pharmacy work requires medication-safety training and, in many places, registration or certification.",
    startupItems: [
      { label: "Technician classes", amount: 1_500, description: "Preparation in medication names, dosage, law, and pharmacy systems." },
      { label: "Exam and registration", amount: 350, description: "Certification testing and local licensing or registration." },
      { label: "Screening", amount: 150, description: "Background and substance-screening requirements." },
      { label: "Workwear and supplies", amount: 400, description: "Shoes, scrubs or uniform pieces, and study materials." },
    ],
  },
  "it-support": {
    startupSummary: "A first support role is easier to win when you can prove foundational knowledge and practice on real equipment.",
    startupItems: [
      { label: "Certification prep and exam", amount: 600, description: "Coursework and one entry-level technical certification attempt." },
      { label: "Repair toolkit", amount: 250, description: "Hand tools, adapters, storage media, and diagnostic accessories." },
      { label: "Home lab", amount: 350, description: "Used hardware or cloud credits for hands-on troubleshooting practice." },
    ],
  },
  "junior-web-developer": {
    startupSummary: "This route has the largest self-funded ramp: capable hardware, focused instruction, and a public portfolio.",
    startupItems: [
      { label: "Development laptop", amount: 1_800, description: "A reliable computer that can run local tools and design software." },
      { label: "Classes or bootcamp", amount: 2_000, description: "Structured instruction to build employable frontend and backend foundations." },
      { label: "Portfolio tools", amount: 700, description: "Hosting, domains, software, and assets for several finished projects." },
    ],
  },
  "security-officer": {
    startupSummary: "Security work requires documented training, screening, and a uniform that can handle long shifts.",
    startupItems: [
      { label: "License and training", amount: 300, description: "Required guard coursework and license application fees." },
      { label: "Uniform and boots", amount: 250, description: "Durable clothing and footwear for patrol or post duty." },
      { label: "Background and fingerprints", amount: 150, description: "Identity and criminal-record screening." },
    ],
  },
  "food-service": {
    startupSummary: "Food service starts quickly but still has health, footwear, and uniform requirements.",
    startupItems: [
      { label: "Non-slip shoes", amount: 120, description: "Kitchen-safe footwear for wet, fast-moving floors." },
      { label: "Food-safety card", amount: 80, description: "Basic handling course and local permit or test." },
      { label: "Uniform and small tools", amount: 150, description: "Aprons, work clothing, and role-specific utensils." },
    ],
  },
  "childcare-assistant": {
    startupSummary: "Working with children brings safety training, background checks, and introductory education requirements.",
    startupItems: [
      { label: "First aid and CPR", amount: 160, description: "Child-focused emergency-response certification." },
      { label: "Background screening", amount: 90, description: "Required identity, record, and vulnerable-sector checks." },
      { label: "Early-childhood classes", amount: 500, description: "Introductory child-development and care coursework." },
      { label: "Workwear and activity supplies", amount: 150, description: "Washable clothing and a small set of learning materials." },
    ],
  },
  manufacturing: {
    startupSummary: "Technical production work calls for site-safe equipment plus enough training to operate around machinery.",
    startupItems: [
      { label: "Safety and technical course", amount: 450, description: "Machine awareness, lockout, measurement, and basic quality training." },
      { label: "Boots and PPE", amount: 300, description: "Protective footwear, eyewear, gloves, and hearing protection." },
      { label: "Technical tools", amount: 350, description: "Measuring and hand tools for setup and maintenance tasks." },
    ],
  },
  landscaping: {
    startupSummary: "Outdoor crew work requires durable tools, protective gear, and a way to reach changing job sites.",
    startupItems: [
      { label: "Starter hand tools", amount: 450, description: "Pruners, hand tools, maintenance supplies, and weather-resistant storage." },
      { label: "Boots and PPE", amount: 250, description: "Work boots, gloves, eye and hearing protection, and sun gear." },
      { label: "Job-site transportation", amount: 250, description: "Fuel, transit, or equipment-hauling contribution during the first weeks." },
    ],
  },
  "call-center": {
    startupSummary: "A home-based call-center role needs dependable audio, connectivity, and an ergonomic station.",
    startupItems: [
      { label: "Call headset", amount: 100, description: "Noise-controlled audio for a full day of customer conversations." },
      { label: "Home-office basics", amount: 200, description: "Desk, chair, lighting, and a quiet-work setup." },
      { label: "Internet setup", amount: 100, description: "Equipment or activation for a stable wired connection." },
    ],
  },
  bookkeeping: {
    startupSummary: "Bookkeeping is accessible without a degree, but accuracy credentials and current software skills matter.",
    startupItems: [
      { label: "Bookkeeping classes", amount: 750, description: "Double-entry accounting, payroll, reconciliations, and reporting instruction." },
      { label: "Accounting software", amount: 350, description: "A learning subscription and practice-company materials." },
      { label: "Certification exam", amount: 500, description: "Preparation and testing for a recognized entry credential." },
    ],
  },
  "real-estate": {
    startupSummary: "A real-estate path has regulated education and licensing costs before client work can begin.",
    startupItems: [
      { label: "Pre-license classes", amount: 800, description: "Required instruction in contracts, agency, ethics, and property law." },
      { label: "Exam and license", amount: 350, description: "Testing, application, fingerprints, and initial license fees." },
      { label: "Association and listing access", amount: 650, description: "Early professional dues and market-listing tools." },
      { label: "Client travel and marketing", amount: 500, description: "Transportation, photos, cards, signs, and first prospecting materials." },
    ],
  },
};

const MAJOR_COMMITMENT_DETAILS: Readonly<Record<string, Pick<DecisionChoiceDetails, "startupSummary" | "startupItems">>> = {
  nursing: {
    startupSummary: "This four-year estimate combines classroom tuition with the clinical equipment and travel needed for supervised placements.",
    startupItems: [
      { label: "Tuition", amount: 54_400, description: "Four years of nursing lectures, skills instruction, and clinical enrollment." },
      { label: "Clinical and lab fees", amount: 5_600, description: "Simulation labs, health clearances, screenings, and placement administration." },
      { label: "Books and supplies", amount: 4_400, description: "Clinical references, course materials, scrubs, shoes, and basic equipment." },
      { label: "Placement transportation", amount: 4_000, description: "Travel to hospitals and clinics whose shifts may begin before transit runs." },
    ],
  },
  "computer-science": {
    startupSummary: "The degree needs dependable computing equipment as well as four years of technical coursework and project infrastructure.",
    startupItems: [
      { label: "Tuition", amount: 62_000, description: "Four years of programming, mathematics, systems, and elective coursework." },
      { label: "Computer and software", amount: 5_600, description: "A capable laptop, development tools, cloud credits, and hardware repairs." },
      { label: "Books and course materials", amount: 4_000, description: "Technical references, online labs, and project resources." },
      { label: "Campus and program fees", amount: 6_000, description: "Student services, computing facilities, project showcases, and commuting." },
    ],
  },
  business: {
    startupSummary: "A broad business program combines tuition with case materials, campus fees, and the networking costs that make the degree useful.",
    startupItems: [
      { label: "Tuition", amount: 58_400, description: "Four years across management, operations, marketing, finance, and electives." },
      { label: "Books and case materials", amount: 4_400, description: "Textbooks, business cases, simulations, and presentation materials." },
      { label: "Program and campus fees", amount: 5_200, description: "Student services, business-school events, software, and facilities." },
      { label: "Commute and networking", amount: 4_800, description: "Travel, interview clothing, career fairs, and employer events." },
    ],
  },
  "liberal-arts": {
    startupSummary: "The program's flexibility rests on sustained reading, writing, campus access, and enough travel to pursue internships.",
    startupItems: [
      { label: "Tuition", amount: 52_000, description: "Four years of humanities, social-science, language, and elective study." },
      { label: "Books and materials", amount: 4_800, description: "A substantial reading list, writing tools, and course-specific materials." },
      { label: "Campus and program fees", amount: 5_200, description: "Libraries, student services, workshops, and academic events." },
      { label: "Local travel", amount: 2_000, description: "Commuting and transportation to internships, archives, or community projects." },
    ],
  },
  accounting: {
    startupSummary: "Accounting pairs the degree itself with current software, detailed reference materials, and early credential preparation.",
    startupItems: [
      { label: "Tuition", amount: 56_000, description: "Four years of financial reporting, audit, tax, systems, and business courses." },
      { label: "Books and references", amount: 4_800, description: "Current accounting standards, tax references, and digital homework access." },
      { label: "Software and exam preparation", amount: 4_800, description: "Accounting platforms, analytics tools, and introductory credential study." },
      { label: "Campus and commute fees", amount: 4_800, description: "Student services, recruiting events, and regular transportation." },
    ],
  },
  "mechanical-engineering": {
    startupSummary: "Engineering costs more because design studios, fabrication labs, project materials, and technical software are central to the degree.",
    startupItems: [
      { label: "Tuition", amount: 66_400, description: "Four years of calculus, mechanics, thermodynamics, design, and electives." },
      { label: "Labs and project builds", amount: 8_000, description: "Fabrication access, components, safety equipment, prototypes, and testing." },
      { label: "Books and technical tools", amount: 4_800, description: "References, calculator, drafting tools, and course software." },
      { label: "Program fees and travel", amount: 5_600, description: "Engineering facilities, team competitions, campus fees, and commuting." },
    ],
  },
  education: {
    startupSummary: "Teacher preparation includes classroom study plus certification steps and repeated travel to supervised school placements.",
    startupItems: [
      { label: "Tuition", amount: 48_800, description: "Four years of subject study, learning science, curriculum, and teaching methods." },
      { label: "Books and classroom supplies", amount: 3_600, description: "Education texts, lesson materials, printing, and demonstration resources." },
      { label: "Certification and placements", amount: 4_800, description: "Testing, clearances, background checks, and practicum administration." },
      { label: "Campus and school travel", amount: 4_400, description: "Student fees and commuting among campus and partner schools." },
    ],
  },
  psychology: {
    startupSummary: "Psychology combines a broad course sequence with research-method tools and participation in labs or community studies.",
    startupItems: [
      { label: "Tuition", amount: 52_400, description: "Four years of behavior, development, cognition, statistics, and electives." },
      { label: "Texts and research access", amount: 4_800, description: "Course books, journal access, experiment platforms, and survey tools." },
      { label: "Lab and program fees", amount: 3_600, description: "Research participation, methods labs, software, and departmental activities." },
      { label: "Campus and field travel", amount: 4_800, description: "Student services and transportation to research or community placements." },
    ],
  },
  biology: {
    startupSummary: "Biology requires repeated laboratory and field access alongside the standard tuition and scientific reference costs.",
    startupItems: [
      { label: "Tuition", amount: 57_600, description: "Four years of biology, chemistry, mathematics, laboratories, and electives." },
      { label: "Laboratory fees", amount: 6_800, description: "Specimens, reagents, protective equipment, instruments, and lab access." },
      { label: "Books and field supplies", amount: 4_400, description: "Scientific references, notebooks, sampling tools, and course materials." },
      { label: "Field and campus travel", amount: 4_400, description: "Transportation to field sites, research facilities, and regular classes." },
    ],
  },
  communications: {
    startupSummary: "The program mixes writing and media study with production tools, portfolio work, and practical campus experiences.",
    startupItems: [
      { label: "Tuition", amount: 52_000, description: "Four years of writing, media analysis, audience research, and campaign courses." },
      { label: "Media tools and software", amount: 4_400, description: "Recording accessories, editing applications, storage, and project hosting." },
      { label: "Books and course materials", amount: 3_600, description: "Texts, research access, printing, and production supplies." },
      { label: "Campus and portfolio costs", amount: 4_800, description: "Student fees, showcases, professional events, and local transportation." },
    ],
  },
  "criminal-justice": {
    startupSummary: "The path includes justice-system coursework plus applied program requirements, screenings, and travel to community placements.",
    startupItems: [
      { label: "Tuition", amount: 49_600, description: "Four years covering law, institutions, policy, investigation, and social science." },
      { label: "Books and legal references", amount: 4_400, description: "Current case materials, policy texts, databases, and course access." },
      { label: "Program and screening fees", amount: 3_600, description: "Applied exercises, records checks, workshops, and career preparation." },
      { label: "Campus and placement travel", amount: 4_800, description: "Student services and transport to courts, agencies, or community programs." },
    ],
  },
  economics: {
    startupSummary: "Economics adds quantitative software and data access to a demanding four-year sequence in theory, policy, and statistics.",
    startupItems: [
      { label: "Tuition", amount: 59_600, description: "Four years of economic theory, calculus, statistics, policy, and electives." },
      { label: "Books and data references", amount: 5_200, description: "Technical texts, journal access, datasets, and problem-set platforms." },
      { label: "Analytics software", amount: 4_400, description: "Statistical tools, computing access, and applied research resources." },
      { label: "Campus and commute fees", amount: 5_600, description: "Student services, speaker events, career programs, and transportation." },
    ],
  },
  "graphic-design": {
    startupSummary: "Design study carries substantial hardware, software, printing, studio-material, and portfolio-production costs.",
    startupItems: [
      { label: "Tuition", amount: 54_400, description: "Four years of visual communication, typography, interaction, and studio critique." },
      { label: "Computer and creative software", amount: 7_600, description: "A capable workstation, design applications, storage, and maintenance." },
      { label: "Studio and print materials", amount: 4_400, description: "Paper, inks, mockups, photography, fabrication, and presentation boards." },
      { label: "Portfolio and campus fees", amount: 4_000, description: "Hosting, final shows, student services, and project transportation." },
    ],
  },
  cybersecurity: {
    startupSummary: "Cybersecurity combines core computing tuition with lab hardware, secure cloud environments, and early certification preparation.",
    startupItems: [
      { label: "Tuition", amount: 62_800, description: "Four years of networking, systems, programming, security, and risk coursework." },
      { label: "Computer and security lab", amount: 7_200, description: "A capable laptop, virtual labs, networking gear, and cloud environments." },
      { label: "Books and certification prep", amount: 4_800, description: "Technical references, practice platforms, and introductory exam materials." },
      { label: "Campus and program fees", amount: 4_800, description: "Computing facilities, student services, events, and transportation." },
    ],
  },
  "data-science": {
    startupSummary: "This quantitative path needs strong computing resources, specialized software, and four years of statistics and programming study.",
    startupItems: [
      { label: "Tuition", amount: 64_000, description: "Four years of statistics, computing, mathematics, modeling, and domain electives." },
      { label: "Computer, cloud, and software", amount: 8_000, description: "A capable workstation, cloud compute, storage, and analytics platforms." },
      { label: "Books and data access", amount: 4_800, description: "Technical texts, datasets, journal access, and learning platforms." },
      { label: "Campus and program fees", amount: 5_200, description: "Computing facilities, project showcases, student services, and commute." },
    ],
  },
  "social-work": {
    startupSummary: "Social-work education includes supervised community placements, screening requirements, and frequent travel beyond campus.",
    startupItems: [
      { label: "Tuition", amount: 49_200, description: "Four years of policy, human development, practice methods, and field education." },
      { label: "Books and practice materials", amount: 4_000, description: "Course texts, case resources, assessment tools, and printing." },
      { label: "Placement and screening fees", amount: 3_600, description: "Background checks, clearances, supervision, and placement administration." },
      { label: "Community-placement travel", amount: 4_800, description: "Transportation among campus, agencies, and client-serving organizations." },
    ],
  },
  "public-health": {
    startupSummary: "Public health blends science and policy with data tools and community-based fieldwork that adds program and travel costs.",
    startupItems: [
      { label: "Tuition", amount: 56_000, description: "Four years of population health, epidemiology, policy, statistics, and electives." },
      { label: "Books and data tools", amount: 4_800, description: "Texts, datasets, survey platforms, and analytical software." },
      { label: "Lab and program fees", amount: 4_400, description: "Applied labs, certifications, workshops, and project resources." },
      { label: "Community and campus travel", amount: 5_200, description: "Transportation to field projects, agencies, and regular classes." },
    ],
  },
  finance: {
    startupSummary: "Finance study adds market-data tools, technical texts, and career networking to its four-year business curriculum.",
    startupItems: [
      { label: "Tuition", amount: 59_200, description: "Four years of markets, valuation, accounting, economics, and business study." },
      { label: "Books and financial references", amount: 4_800, description: "Technical texts, news and research access, and course platforms." },
      { label: "Market data and software", amount: 4_800, description: "Spreadsheet, modeling, analytics, and simulated trading resources." },
      { label: "Campus and career networking", amount: 6_000, description: "Student fees, interview travel, professional events, and commuting." },
    ],
  },
  "environmental-science": {
    startupSummary: "Environmental science carries laboratory, field-equipment, and travel costs for work beyond the classroom.",
    startupItems: [
      { label: "Tuition", amount: 55_200, description: "Four years of earth systems, ecology, chemistry, policy, and quantitative study." },
      { label: "Laboratory and field fees", amount: 6_000, description: "Sampling equipment, protective gear, instruments, and facility access." },
      { label: "Books and field supplies", amount: 4_400, description: "Scientific references, maps, notebooks, and durable outdoor materials." },
      { label: "Field-site transportation", amount: 4_800, description: "Travel to watersheds, monitoring sites, laboratories, and campus." },
    ],
  },
  hospitality: {
    startupSummary: "Hospitality education combines business coursework with practical labs, professional presentation, and internship travel.",
    startupItems: [
      { label: "Tuition", amount: 50_400, description: "Four years of lodging, food service, events, finance, and operations study." },
      { label: "Books and course materials", amount: 3_600, description: "Operations texts, case studies, planning tools, and digital access." },
      { label: "Practical labs and uniform", amount: 4_800, description: "Food, beverage, event-lab materials, professional clothing, and equipment." },
      { label: "Internship and campus travel", amount: 5_200, description: "Transportation to placements, industry events, and regular classes." },
    ],
  },
};

const careerRows: readonly ChoiceTuple[] = [
  ["retail", "Service", 2, 31_200, 250, "Typical setup", "Days", "Steady", ["people", "flexible shifts", "management path"], "A quick start with strong practice in customer service and team leadership."],
  ["warehouse", "Operations", 3, 38_400, 350, "Typical setup", "Days", "Growing", ["active", "shift work", "logistics"], "Reliable hours and a visible path into inventory, dispatch, and supervision."],
  ["sales", "Business", 4, 36_000, 500, "Typical setup", "1–2 weeks", "Growing", ["commission", "people", "fast growth"], "Income can vary, but communication skill and results can accelerate advancement."],
  ["administrative-assistant", "Business", 2, 37_800, 600, "Skills & setup", "2–6 weeks", "Steady", ["office", "organized", "transferable"], "Build a foundation in scheduling, records, software, and team coordination."],
  ["customer-support", "Technology", 3, 36_600, 450, "Home-office setup", "1–3 weeks", "Growing", ["remote options", "problem solving", "people"], "A strong launch point into operations, account management, or product support."],
  ["bank-teller", "Finance", 2, 37_200, 300, "Typical setup", "1–3 weeks", "Steady", ["finance", "structured", "customer service"], "Learn day-to-day banking while building trust, accuracy, and sales experience."],
  ["construction-laborer", "Skilled work", 4, 42_600, 900, "Gear & safety", "1–4 weeks", "Growing", ["outdoors", "active", "crew work"], "Physical work with practical routes into equipment operation and specialized trades."],
  ["delivery-driver", "Transportation", 3, 40_200, 650, "License & gear", "1–3 weeks", "Growing", ["independent", "active", "early shifts"], "A self-directed role where route knowledge, safety, and reliability matter."],
  ["medical-assistant", "Healthcare", 4, 41_400, 3_800, "Training estimate", "6–12 months", "Fast growing", ["patients", "clinical", "certificate"], "Blend patient care and administrative skills in clinics and physician offices."],
  ["pharmacy-technician", "Healthcare", 4, 39_600, 2_400, "Training estimate", "3–9 months", "Growing", ["detail oriented", "healthcare", "certificate"], "Precision-focused work with a clear credential path and varied care settings."],
  ["it-support", "Technology", 4, 46_200, 1_200, "Training & exam", "2–6 months", "Fast growing", ["technical", "certifications", "hybrid"], "Troubleshooting experience can lead into systems, networking, or security."],
  ["junior-web-developer", "Technology", 5, 51_000, 4_500, "Portfolio training", "4–12 months", "Competitive", ["creative", "technical", "portfolio"], "A portfolio-driven route with higher upside and a steeper self-study ramp."],
  ["security-officer", "Public safety", 3, 37_800, 700, "License & uniform", "2–6 weeks", "Steady", ["shift work", "observant", "structured"], "Dependable work that rewards composure, documentation, and situational awareness."],
  ["food-service", "Hospitality", 4, 33_000, 350, "Typical setup", "Days", "Steady", ["fast paced", "teamwork", "flexible shifts"], "A rapid entry with clear steps toward lead, kitchen, and restaurant management roles."],
  ["childcare-assistant", "Care", 4, 34_200, 900, "Checks & training", "2–8 weeks", "Growing", ["children", "purpose driven", "active"], "Meaningful, high-energy work that develops patience, planning, and communication."],
  ["manufacturing", "Operations", 4, 43_200, 1_100, "Gear & training", "2–8 weeks", "Growing", ["technical", "shift work", "process"], "Build equipment and quality skills with room to advance into maintenance or supervision."],
  ["landscaping", "Skilled work", 4, 36_600, 950, "Tools & gear", "1–3 weeks", "Steady", ["outdoors", "seasonal", "ownership path"], "Hands-on outdoor work with a practical route toward crew leadership or a small business."],
  ["call-center", "Service", 3, 35_400, 400, "Home-office setup", "1–2 weeks", "Steady", ["communication", "metrics", "remote options"], "Develop concise communication and resilience in a measurable service environment."],
  ["bookkeeping", "Finance", 3, 42_000, 1_600, "Course & software", "2–6 months", "Growing", ["numbers", "office", "certificate"], "Accuracy and software fluency can grow into payroll, accounting, or independent clients."],
  ["real-estate", "Business", 4, 38_400, 2_300, "Course & license", "2–5 months", "Competitive", ["people", "commission", "license"], "Learn transactions and local markets while preparing for a licensed sales role."],
] as const;

const majorRows: readonly ChoiceTuple[] = [
  ["nursing", "Health", 5, 74_400, 68_400, "4-year tuition + books", "4 years", "Fast growing", ["clinical", "licensed", "people"], "Demanding clinical training with a direct, licensed path into patient care."],
  ["computer-science", "Technology", 5, 96_000, 77_600, "4-year tuition + books", "4 years", "Fast growing", ["coding", "math", "versatile"], "A rigorous technical foundation with many software and systems career routes."],
  ["business", "Business", 3, 66_000, 72_800, "4-year tuition + books", "4 years", "Growing", ["broad", "leadership", "networking"], "A flexible degree spanning operations, marketing, management, and entrepreneurship."],
  ["liberal-arts", "Humanities", 3, 50_400, 64_000, "4-year tuition + books", "4 years", "Competitive", ["writing", "critical thinking", "flexible"], "Broad analytical and communication skills; internships sharpen the career route."],
  ["accounting", "Business", 4, 70_800, 70_400, "4-year tuition + books", "4 years", "Growing", ["numbers", "credential path", "structured"], "A precise business degree with strong routes into audit, tax, and corporate finance."],
  ["mechanical-engineering", "Engineering", 5, 88_800, 84_800, "4-year tuition + books", "4 years", "Growing", ["math", "design", "labs"], "Intensive math and design work that opens manufacturing, energy, and product roles."],
  ["education", "Public service", 4, 54_000, 61_600, "4-year tuition + books", "4 years", "Steady", ["teaching", "licensed", "people"], "Classroom practice and certification lead to a direct, community-centered profession."],
  ["psychology", "Social science", 4, 55_200, 65_600, "4-year tuition + books", "4 years", "Growing", ["research", "people", "grad-school option"], "Study behavior and research methods; clinical routes usually require further study."],
  ["biology", "Science", 5, 61_200, 73_200, "4-year tuition + books", "4 years", "Growing", ["labs", "science", "grad-school option"], "A lab-heavy foundation for healthcare, research, environment, or further study."],
  ["communications", "Media", 3, 57_600, 64_800, "4-year tuition + books", "4 years", "Competitive", ["writing", "media", "people"], "Build clear storytelling and audience skills for media, marketing, and public relations."],
  ["criminal-justice", "Public service", 3, 58_800, 62_400, "4-year tuition + books", "4 years", "Steady", ["policy", "law", "public service"], "Explore justice systems, investigation, policy, and community safety careers."],
  ["economics", "Social science", 5, 75_600, 74_800, "4-year tuition + books", "4 years", "Growing", ["math", "analysis", "policy"], "Quantitative reasoning for finance, policy, consulting, and market analysis."],
  ["graphic-design", "Creative", 4, 56_400, 70_400, "4-year tuition + books", "4 years", "Competitive", ["portfolio", "creative", "software"], "A studio and portfolio path into brand, product, motion, and digital design."],
  ["cybersecurity", "Technology", 5, 91_200, 79_600, "4-year tuition + books", "4 years", "Fast growing", ["security", "technical", "certifications"], "Technical defense, risk, and systems work with strong certification value."],
  ["data-science", "Technology", 5, 98_400, 82_000, "4-year tuition + books", "4 years", "Fast growing", ["math", "coding", "analytics"], "A high-intensity blend of statistics, programming, and domain problem solving."],
  ["social-work", "Public service", 4, 51_600, 61_600, "4-year tuition + books", "4 years", "Growing", ["people", "community", "licensed path"], "Purpose-driven work supporting people and communities through complex situations."],
  ["public-health", "Health", 4, 63_600, 70_400, "4-year tuition + books", "4 years", "Growing", ["community", "analysis", "health"], "Work on prevention, programs, data, and policy across populations."],
  ["finance", "Business", 4, 79_200, 74_800, "4-year tuition + books", "4 years", "Growing", ["numbers", "markets", "business"], "A quantitative business path into banking, planning, investment, and corporate roles."],
  ["environmental-science", "Science", 4, 62_400, 70_400, "4-year tuition + books", "4 years", "Growing", ["fieldwork", "science", "sustainability"], "Combine science and fieldwork to address land, water, climate, and compliance challenges."],
  ["hospitality", "Hospitality", 3, 56_400, 64_000, "4-year tuition + books", "4 years", "Growing", ["people", "operations", "travel"], "A people-and-operations degree for hotels, events, tourism, and food service leadership."],
] as const;

export const PET_CHOICES: readonly DecisionChoiceDetails[] = [
  {
    id: "adult-dog", kind: "pet", category: "Dogs", difficulty: 4, startingSalary: 0, cost: 650,
    costLabel: "Adoption and setup", timeLabel: "10–14 years", outlook: "High care",
    tags: ["active", "training", "daily walks", "pet-friendly housing"],
    note: "A loyal adult companion who needs daily exercise, training, routine vet care, and housing that welcomes dogs.",
    monthlyCost: 145, weeklyHours: 10, housingLabel: "Pet-friendly home; daily outdoor access", commitmentLabel: "10–14 years",
    startupSummary: "An adult rescue dog arrives with adoption, health, and everyday equipment costs before the first regular month begins.",
    startupItems: [
      { label: "Adoption fee", amount: 250, description: "Shelter placement, records, identification, and initial care." },
      { label: "First exam and vaccines", amount: 220, description: "A baseline health visit, preventives, and any vaccine updates." },
      { label: "Walking and home gear", amount: 180, description: "Harness, lead, bed, bowls, tags, and a safe settling-in space." },
    ], artwork: { src: "/role-cards/pets/adult-dog.svg" },
  },
  {
    id: "puppy", kind: "pet", category: "Dogs", difficulty: 5, startingSalary: 0, cost: 1_400,
    costLabel: "Puppy setup", timeLabel: "12–15 years", outlook: "High care",
    tags: ["intensive training", "frequent breaks", "active", "pet-friendly housing"],
    note: "The highest-time dog option: house training, socialization, supervision, exercise, and early veterinary care shape every week.",
    monthlyCost: 230, weeklyHours: 18, housingLabel: "Stable pet-friendly home; frequent outdoor breaks", commitmentLabel: "12–15 years",
    startupSummary: "A puppy needs a larger first-year reserve for veterinary care, training, containment, and equipment that will be outgrown.",
    startupItems: [
      { label: "Adoption and records", amount: 500, description: "Placement fee, identification, and available early medical records." },
      { label: "Puppy veterinary series", amount: 450, description: "Exams, vaccine series, preventives, and spay or neuter planning." },
      { label: "Crate, gear, and training", amount: 450, description: "Safe containment, walking gear, chew toys, cleanup supplies, and a starter class." },
    ], artwork: { src: "/role-cards/pets/puppy.svg" },
  },
  {
    id: "senior-dog", kind: "pet", category: "Dogs", difficulty: 4, startingSalary: 0, cost: 750,
    costLabel: "Adoption and senior care", timeLabel: "2–7 years", outlook: "High care",
    tags: ["gentle pace", "medical reserve", "daily routine", "pet-friendly housing"],
    note: "A calmer companion with a shorter horizon but a greater chance of medication, mobility support, and frequent veterinary visits.",
    monthlyCost: 190, weeklyHours: 9, housingLabel: "Quiet pet-friendly home; easy outdoor access", commitmentLabel: "2–7 years",
    startupSummary: "Senior adoption fees may be modest, but a complete health baseline and comfort-focused home setup matter immediately.",
    startupItems: [
      { label: "Senior adoption fee", amount: 150, description: "Placement, identification, and transfer of medical history." },
      { label: "Senior exam and lab work", amount: 350, description: "A thorough baseline visit with age-appropriate screening." },
      { label: "Comfort and mobility setup", amount: 250, description: "Supportive bed, ramps or mats, walking gear, bowls, and medication supplies." },
    ], artwork: { src: "/role-cards/pets/senior-dog.svg" },
  },
  {
    id: "adult-cat", kind: "pet", category: "Cats", difficulty: 2, startingSalary: 0, cost: 500,
    costLabel: "Adoption and setup", timeLabel: "12–18 years", outlook: "Moderate care",
    tags: ["indoor", "litter", "play", "renter-friendly"],
    note: "An independent indoor companion who still needs daily play, litter care, enrichment, and a long-term veterinary plan.",
    monthlyCost: 90, weeklyHours: 5, housingLabel: "Indoor pet-friendly housing", commitmentLabel: "12–18 years",
    startupSummary: "A healthy adult cat needs an adoption fee, veterinary baseline, safe transport, and a well-equipped indoor territory.",
    startupItems: [
      { label: "Adoption fee", amount: 175, description: "Shelter placement, identification, and available health records." },
      { label: "First exam and preventives", amount: 175, description: "Baseline check, vaccines, parasite prevention, and microchip review." },
      { label: "Litter and home setup", amount: 150, description: "Carrier, litter box, scratcher, bowls, bed, and initial enrichment." },
    ], artwork: { src: "/role-cards/pets/adult-cat.svg" },
  },
  {
    id: "bonded-cats", kind: "pet", category: "Cats", difficulty: 3, startingSalary: 0, cost: 850,
    costLabel: "Pair adoption and setup", timeLabel: "12–18 years", outlook: "Moderate care",
    tags: ["bonded pair", "indoor", "double vet care", "pet-friendly housing"],
    note: "Two cats keep each other company, while food, litter, veterinary bills, insurance, and housing deposits scale upward.",
    monthlyCost: 165, weeklyHours: 7, housingLabel: "Housing permits two indoor cats", commitmentLabel: "12–18 years",
    startupSummary: "A bonded pair shares a home but needs two health baselines and enough litter, transport, feeding, and resting space for both.",
    startupItems: [
      { label: "Pair adoption fee", amount: 300, description: "Joint placement, identification, and transferred records for both cats." },
      { label: "Two veterinary baselines", amount: 300, description: "Exams, vaccine updates, parasite prevention, and microchip review." },
      { label: "Expanded home setup", amount: 250, description: "Carriers, multiple litter stations, scratchers, bowls, beds, and toys." },
    ], artwork: { src: "/role-cards/pets/bonded-cats.svg" },
  },
  {
    id: "rabbit", kind: "pet", category: "Small companions", difficulty: 4, startingSalary: 0, cost: 600,
    costLabel: "Adoption and habitat", timeLabel: "8–12 years", outlook: "High care",
    tags: ["indoor habitat", "hay", "exotic vet", "daily cleaning"],
    note: "A social, sensitive companion needing generous indoor space, unlimited hay, daily cleaning, enrichment, and an exotic-pet veterinarian.",
    monthlyCost: 100, weeklyHours: 7, housingLabel: "Quiet indoor exercise area; rabbit-safe lease", commitmentLabel: "8–12 years",
    startupSummary: "Rabbit care begins with medical preparation and a roomy, chew-safe indoor habitat—not a small cage.",
    startupItems: [
      { label: "Adoption fee", amount: 100, description: "Rescue placement and transferred care history." },
      { label: "Exam and spay/neuter reserve", amount: 250, description: "An exotic-vet baseline and reproductive-health planning." },
      { label: "Indoor habitat", amount: 250, description: "Exercise pen, hide, litter station, hay feeder, bowls, and cord protection." },
    ], artwork: { src: "/role-cards/pets/rabbit.svg" },
  },
  {
    id: "guinea-pig-pair", kind: "pet", category: "Small companions", difficulty: 3, startingSalary: 0, cost: 450,
    costLabel: "Pair and habitat", timeLabel: "5–7 years", outlook: "Moderate care",
    tags: ["social pair", "large enclosure", "hay", "exotic vet"],
    note: "Guinea pigs thrive with a companion, a broad enclosure, fresh hay and vegetables, regular cleaning, and exotic-vet access.",
    monthlyCost: 80, weeklyHours: 5, housingLabel: "Space for a large stable indoor enclosure", commitmentLabel: "5–7 years",
    startupSummary: "A social pair needs a properly sized shared habitat, two health checks, and food and bedding ready before arrival.",
    startupItems: [
      { label: "Pair adoption fee", amount: 100, description: "Placement of a compatible pair with any available records." },
      { label: "Two wellness exams", amount: 120, description: "An exotic-vet baseline for both companions." },
      { label: "Large habitat and supplies", amount: 230, description: "Enclosure, hides, fleece or bedding, hay rack, bowls, and carrier." },
    ], artwork: { src: "/role-cards/pets/guinea-pig-pair.svg" },
  },
  {
    id: "hamster", kind: "pet", category: "Small companions", difficulty: 2, startingSalary: 0, cost: 225,
    costLabel: "Habitat setup", timeLabel: "2–3 years", outlook: "Low care",
    tags: ["nocturnal", "solo", "enclosure", "small space"],
    note: "A compact nocturnal companion with a shorter commitment, but still deserving a deep-bedding enclosure, enrichment, and careful handling.",
    monthlyCost: 35, weeklyHours: 2, housingLabel: "Stable indoor surface away from heat and noise", commitmentLabel: "2–3 years",
    startupSummary: "The animal is inexpensive; a humane, escape-safe enclosure with deep bedding and enrichment is the real entry cost.",
    startupItems: [
      { label: "Adoption fee", amount: 25, description: "Responsible placement of a single hamster." },
      { label: "Humane enclosure", amount: 150, description: "Large ventilated habitat, wheel, hides, and secure lid." },
      { label: "Bedding and first supplies", amount: 50, description: "Deep bedding, nesting material, food, chew items, and carrier." },
    ], artwork: { src: "/role-cards/pets/hamster.svg" },
  },
  {
    id: "parakeet", kind: "pet", category: "Birds", difficulty: 3, startingSalary: 0, cost: 425,
    costLabel: "Bird and habitat", timeLabel: "7–12 years", outlook: "Moderate care",
    tags: ["social", "daily interaction", "noise", "avian vet"],
    note: "A bright, social bird needing daily interaction, safe flight time, rotating enrichment, cage cleaning, and access to an avian veterinarian.",
    monthlyCost: 55, weeklyHours: 5, housingLabel: "Bird-safe room; lease and neighbors tolerate noise", commitmentLabel: "7–12 years",
    startupSummary: "A parakeet needs more than a decorative cage: safe space, varied perches, enrichment, and an avian-health baseline.",
    startupItems: [
      { label: "Adoption fee", amount: 75, description: "Responsible placement and any transferred records." },
      { label: "Avian wellness exam", amount: 120, description: "A specialized baseline health assessment." },
      { label: "Flight cage and enrichment", amount: 230, description: "Wide cage, varied perches, bowls, toys, carrier, and safe-room supplies." },
    ], artwork: { src: "/role-cards/pets/parakeet.svg" },
  },
  {
    id: "freshwater-aquarium", kind: "pet", category: "Aquatic", difficulty: 3, startingSalary: 0, cost: 500,
    costLabel: "Aquarium setup", timeLabel: "5–10 years", outlook: "Moderate care",
    tags: ["quiet", "water chemistry", "small space", "routine maintenance"],
    note: "A quiet living display with little handling, balanced by careful tank cycling, water testing, cleaning, and equipment monitoring.",
    monthlyCost: 45, weeklyHours: 2, housingLabel: "Strong level surface; lease permits an aquarium", commitmentLabel: "5–10 years",
    startupSummary: "Healthy fish need a fully cycled ecosystem with reliable filtration and heating before animals enter the water.",
    startupItems: [
      { label: "Fish and live plants", amount: 100, description: "A compatible, responsibly stocked community after the tank cycles." },
      { label: "Tank, filter, and heater", amount: 320, description: "A properly sized aquarium with essential life-support equipment and secure stand." },
      { label: "Water testing and setup", amount: 80, description: "Conditioner, test kit, substrate, tools, food, and cycling supplies." },
    ], artwork: { src: "/role-cards/pets/freshwater-aquarium.svg" },
  },
  {
    id: "leopard-gecko", kind: "pet", category: "Reptiles", difficulty: 3, startingSalary: 0, cost: 550,
    costLabel: "Gecko and habitat", timeLabel: "10–20 years", outlook: "Moderate care",
    tags: ["quiet", "heated habitat", "live insects", "exotic vet"],
    note: "A quiet reptile with modest weekly handling but strict heat, supplement, live-food, shedding, and exotic-vet requirements.",
    monthlyCost: 45, weeklyHours: 3, housingLabel: "Stable space and reliable power for a heated habitat", commitmentLabel: "10–20 years",
    startupSummary: "The enclosure must hold a safe temperature gradient, hides, lighting, and monitoring equipment before the gecko comes home.",
    startupItems: [
      { label: "Responsible adoption", amount: 100, description: "The gecko plus available feeding and health records." },
      { label: "Exotic-vet baseline", amount: 100, description: "Initial health and husbandry assessment." },
      { label: "Heated habitat", amount: 350, description: "Enclosure, thermostat-controlled heat, hides, substrate, gauges, and supplements." },
    ], artwork: { src: "/role-cards/pets/leopard-gecko.svg" },
  },
  {
    id: "tortoise", kind: "pet", category: "Reptiles", difficulty: 5, startingSalary: 0, cost: 900,
    costLabel: "Tortoise and habitat", timeLabel: "40+ years", outlook: "High care",
    tags: ["lifetime commitment", "large habitat", "UV lighting", "exotic vet"],
    note: "A multidecade companion whose roomy habitat, UV exposure, climate control, diet, and future caretaker may outlast several homes.",
    monthlyCost: 70, weeklyHours: 4, housingLabel: "Long-term room for a large climate-controlled habitat", commitmentLabel: "40+ years",
    startupSummary: "The largest commitment in this set begins with a roomy species-appropriate habitat and specialized lighting and veterinary guidance.",
    startupItems: [
      { label: "Responsible adoption", amount: 250, description: "Species-confirmed placement with any available history and permits." },
      { label: "Exotic-vet baseline", amount: 150, description: "Health, diet, growth, and habitat assessment." },
      { label: "Large UV habitat", amount: 500, description: "Roomy enclosure, UVB and heat equipment, hides, substrate, gauges, and feeding setup." },
    ], artwork: { src: "/role-cards/pets/tortoise.svg" },
  },
] as const;

export const CAREER_CHOICES = fromTuples("career", careerRows);
export const MAJOR_CHOICES = fromTuples("major", majorRows);

export function detailsForDecision(nodeId: string): readonly DecisionChoiceDetails[] | null {
  if (nodeId === "entry-track") return CAREER_CHOICES;
  if (nodeId === "declare-major" || nodeId === "swap-major") return MAJOR_CHOICES;
  if (nodeId === "rng-pet") return PET_CHOICES;
  return null;
}

export function isDecisionExplorerNode(nodeId: string): boolean {
  return isLifestyleDecisionNode(nodeId) || detailsForDecision(nodeId) !== null;
}
import { isLifestyleDecisionNode } from "./lifestyleDecisions";
