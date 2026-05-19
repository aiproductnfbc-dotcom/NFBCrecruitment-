// ─── Seniority Detection ────────────────────────────────────────────────────

const SENIORITY_RULES: Array<{ level: string; patterns: RegExp[] }> = [
  {
    level: "C-Suite",
    patterns: [
      /\bCEO\b/i,
      /\bCTO\b/i,
      /\bCFO\b/i,
      /\bCOO\b/i,
      /\bCMO\b/i,
      /\bCIO\b/i,
      /\bCISO\b/i,
      /\bCHRO\b/i,
      /\bCPO\b/i,
      /\bCRO\b/i,
      /\bChief\s/i,
      /\bFounder\b/i,
      /\bCo-Founder\b/i,
      /\bCofounder\b/i,
      /\bOwner\b/i,
      /\bPartner\b(?!.*\bJunior\b)/i,
      /(?<!Vice\s)\bPresident\b/i,
      /\bChairman\b/i,
      /\bChairperson\b/i,
      /\bBoard\s+(Member|Director|of\s+Directors)\b/i,
    ],
  },
  {
    level: "VP",
    patterns: [
      /\bVice\s+President\b/i,
      /\bVP[\s,\-]/i,
      /\bVP$/i,
      /\bSVP\b/i,
      /\bEVP\b/i,
      /\bAVP\b/i,
    ],
  },
  {
    level: "Director",
    patterns: [
      /\bDirector\b/i,
      /\bHead\s+of\b/i,
      /\bGroup\s+Head\b/i,
      /\bGeneral\s+Manager\b/i,
      /\bGM\s/i,
      /\bGM$/i,
    ],
  },
  {
    level: "Manager",
    patterns: [
      /\bManager\b/i,
      /\bMgr\b/i,
      /\bSupervisor\b/i,
      /\bTeam\s+Manager\b/i,
      /\bDepartment\s+Head\b/i,
    ],
  },
  {
    level: "Lead",
    patterns: [
      /\bLead\s/i,
      /\sLead\b/i,
      /\bPrincipal\b/i,
      /\bStaff\s/i,
      /\bDistinguished\b/i,
      /\bTeam\s+Lead\b/i,
      /\bTeam\s+Leader\b/i,
    ],
  },
  {
    level: "Senior",
    patterns: [
      /\bSenior\b/i,
      /\bSr\.\s/i,
      /\bSr\s/i,
      /\bIII\b/,
      /\bLevel\s*3\b/i,
      /\bL3\b/i,
    ],
  },
  {
    level: "Junior",
    patterns: [
      /\bJunior\b/i,
      /\bJr\.\s/i,
      /\bJr\s/i,
      /\bEntry[\s-]Level\b/i,
      /\bLevel\s*1\b/i,
      /\bL1\b/i,
      /\s+I\b(?!\w)/,
    ],
  },
  {
    level: "Mid",
    patterns: [
      /\bII\b/,
      /\bLevel\s*2\b/i,
      /\bL2\b/i,
      /\bMid-/i,
      /\bMid\s/i,
    ],
  },
  {
    level: "Intern",
    patterns: [
      /\bIntern\b/i,
      /\bTrainee\b/i,
      /\bApprentice\b/i,
      /\bCo-op\b/i,
      /\bCoop\b/i,
      /\bStudent\b/i,
      /\bGraduate\s+Trainee\b/i,
    ],
  },
];

// Management-level keywords — when these appear, they take priority as seniority
const MANAGEMENT_LEVELS = ["C-Suite", "VP", "Director", "Manager"];

// "Associate" should map to Junior only in non-management contexts
const ASSOCIATE_MANAGEMENT_RE =
  /\bAssociate\s+(Director|Vice\s+President|VP|SVP|EVP|AVP)\b/i;

export function detectSeniority(rawTitle: string): string | null {
  if (!rawTitle || rawTitle.trim() === "") return null;

  const title = rawTitle.trim();

  // Special case: "Associate Director/VP" → use the management level, not Junior
  if (ASSOCIATE_MANAGEMENT_RE.test(title)) {
    if (/\bVice\s+President\b|VP|SVP|EVP|AVP\b/i.test(title)) return "VP";
    if (/\bDirector\b/i.test(title)) return "Director";
  }

  for (const rule of SENIORITY_RULES) {
    // Skip "Junior" Associate pattern check — handled above or in non-management context
    if (rule.level === "Junior") {
      // Check for "Associate" only if no management keyword is present
      const hasManagement = SENIORITY_RULES.filter((r) =>
        MANAGEMENT_LEVELS.includes(r.level)
      ).some((r) => r.patterns.some((p) => p.test(title)));

      const associatePattern = /\bAssociate\b/i;
      if (!hasManagement && associatePattern.test(title)) {
        return "Junior";
      }
    }

    for (const pattern of rule.patterns) {
      if (pattern.test(title)) {
        return rule.level;
      }
    }
  }

  // Default: any non-empty title with no seniority marker → Mid
  return "Mid";
}

// ─── Department Detection ────────────────────────────────────────────────────

interface DeptRule {
  department: string;
  patterns: RegExp[];
}

// Order matters: more specific / narrower rules first so broad patterns
// (e.g. /\bEngineer\b/) don't swallow specialised roles.
const DEPARTMENT_RULES: DeptRule[] = [

  // ── 1. Executive ──────────────────────────────────────────────────────────────
  // Highest-level leadership titles — checked first so "Managing Director" never
  // falls through to a generic "Director" match lower in the list.
  {
    department: "Executive",
    patterns: [
      /\bChief\s+Executive\b/i,
      /\bCEO\b/i,
      /\bFounder\b/i,
      /\bCo-?Founder\b/i,
      /\bCofounder\b/i,
      /(?<!Vice\s)\bPresident\b/i,         // excludes "Vice President"
      /\bManaging\s+(Director|Partner)\b/i,
      /\bChairman\b/i,
      /\bChairperson\b/i,
      /\bVice\s+Chairman\b/i,
      /\bBoard\s+(Member|Director|of\s+Directors|of\s+Trustees)\b/i,
      /\bGeneral\s+Manager\b/i,
      /\bGroup\s+(CEO|MD|COO|CFO|Director|General\s+Manager|Head)\b/i,
      /\bCountry\s+(Manager|Director|Head)\b/i,
      /\bRegional\s+(Manager|Director|Head)\b/i,
      /\bArea\s+(Manager|Director|Head)\b/i,
      /\bDeputy\s+(CEO|MD|Managing\s+Director|General\s+Manager|Director\s+General)\b/i,
      /\bDirector\s+General\b/i,
      /\bExecutive\s+Director\b/i,
      /\bPrincipal\s+Partner\b/i,
      /\bOwner\b/i,
    ],
  },

  // ── 2. Data & Analytics ───────────────────────────────────────────────────────
  {
    department: "Data",
    patterns: [
      /\bData\s+Scientist\b/i,
      /\bData\s+Analyst\b/i,
      /\bData\s+Engineer\b/i,
      /\bData\s+Architect\b/i,
      /\bData\s+(Manager|Director|Lead|Head|Specialist|Officer|Steward)\b/i,
      /\bData\s+Governance\b/i,
      /\bData\s+Quality\b/i,
      /\bData\s+Warehouse\b/i,
      /\bData\s+Modell?er\b/i,
      /\bMachine\s+Learning\b/i,
      /\bMLOps\b/i,
      /\bML\s/i,
      /\bML$/i,
      /\bAI\s/i,
      /\bAI$/i,
      /\bArtificial\s+Intelligence\b/i,
      /\bDeep\s+Learning\b/i,
      /\bNLP\b/i,
      /\bAnalytics\b/i,
      /\bBI\s/i,
      /\bBI$/i,
      /\bBusiness\s+Intelligence\b/i,
      /\bStatistician\b/i,
    ],
  },

  // ── 3. Energy & Oil / Gas ─────────────────────────────────────────────────────
  // Before Engineering so "Petroleum Engineer" → Energy, not Engineering.
  {
    department: "Energy",
    patterns: [
      /\bOil\s+(and|&)\s+Gas\b/i,
      /\bPetroleum\b/i,
      /\bReservoir\b/i,
      /\bDrilling\b/i,
      /\bUpstream\b/i,
      /\bDownstream\b/i,
      /\bMidstream\b/i,
      /\bRefin(ery|ing|er)\b/i,
      /\bPipeline\b/i,
      /\bOffshore\b/i,
      /\bOnshore\b/i,
      /\bLNG\b/i,
      /\bLPG\b/i,
      /\bPetrochemical\b/i,
      /\bGeologist\b/i,
      /\bGeophysicist\b/i,
      /\bWell\s+(Engineer|Log|Completion|Intervention)\b/i,
      /\bCompletion\s+Engineer\b/i,
      /\bSubsea\b/i,
      /\bRig\s+(Manager|Superintendent|Supervisor|Operator)\b/i,
      /\bProcess\s+Engineer\b/i,
      /\bEnergy\s+(Manager|Engineer|Analyst|Consultant|Auditor)\b/i,
      /\bRenewable\s+Energy\b/i,
      /\bSolar\s+(Engineer|Technician|Manager|Specialist)\b/i,
      /\bWind\s+(Engineer|Technician|Manager)\b/i,
      /\bPower\s+(Plant|Engineer|Systems)\b/i,
      /\bNuclear\b/i,
      /\bUtilities\s+(Manager|Engineer|Director)\b/i,
    ],
  },

  // ── 4. Real Estate ────────────────────────────────────────────────────────────
  {
    department: "Real Estate",
    patterns: [
      /\bReal\s+Estate\b/i,
      /\bProperty\s+(Consultant|Manager|Developer|Valuer|Advisor|Analyst|Agent|Broker|Officer)\b/i,
      /\bProperty\s+(Management|Development|Investment)\b/i,
      /\bLeasing\s+(Agent|Manager|Consultant|Specialist|Executive|Officer)\b/i,
      /\bEstate\s+Agent\b/i,
      /\bLetting\s+(Agent|Manager)\b/i,
      /\bRERA\b/i,
      /\bMortgage\s+(Advisor|Broker|Consultant|Manager|Specialist|Officer)\b/i,
      /\bLand\s+(Developer|Manager|Acquisition)\b/i,
      /\bPropTech\b/i,
      /\bBuilding\s+Manager\b/i,
      /\bFacility\s+(Manager|Director|Coordinator)\b/i,
      /\bAsset\s+(Manager|Management)\b/i,
      /\bValuation\b/i,
    ],
  },

  // ── 5. Hospitality & Tourism ──────────────────────────────────────────────────
  // Before Sales so "Revenue Manager" (hotel term) → Hospitality.
  {
    department: "Hospitality",
    patterns: [
      /\bHotel\b/i,
      /\bHospitality\b/i,
      /\bFood\s+(and|&)\s+Beverage\b/i,
      /\bF&B\b/i,
      /\bRestaurant\b/i,
      /\bChef\b/i,
      /\bSous\s+Chef\b/i,
      /\bPastry\b/i,
      /\bCulinary\b/i,
      /\bHousekeeping\b/i,
      /\bFront\s+(Desk|Office)\b/i,
      /\bGuest\s+(Relations|Services|Experience)\b/i,
      /\bConcierge\b/i,
      /\bBanqueting\b/i,
      /\bCatering\b/i,
      /\bTourism\b/i,
      /\bTravel\s+(Agent|Consultant|Manager|Coordinator)\b/i,
      /\bResort\b/i,
      /\bLodging\b/i,
      /\bReservations\s+(Manager|Supervisor|Agent)\b/i,
      /\bRevenue\s+Manager\b/i,
      /\bNight\s+(Manager|Auditor)\b/i,
      /\bRoom\s+Division\b/i,
      /\bSpa\s+(Manager|Director|Therapist)\b/i,
      /\bAirline\b/i,
      /\bAviation\b/i,
      /\bCabin\s+Crew\b/i,
      /\bFlight\s+(Attendant|Steward|Operations)\b/i,
    ],
  },

  // ── 6. Sales & Business Development ──────────────────────────────────────────
  {
    department: "Sales",
    patterns: [
      /\bSales\s+Engineer\b/i,
      /\bPre-?Sales\b/i,
      /\bInside\s+Sales\b/i,
      /\bOutside\s+Sales\b/i,
      /\bAccount\s+Executive\b/i,
      /\bKey\s+Account\b/i,
      /\bNational\s+Account\b/i,
      /\bBDR\b/i,
      /\bSDR\b/i,
      /\bBusiness\s+Development\b/i,
      /\bAccount\s+Manager\b/i,
      /\bRevenue\b/i,
      /\bPartnerships\b/i,
      /\bClient\s+(Success|Relations|Services|Manager|Director|Executive)\b/i,
      /\bCustomer\s+(Success|Relations|Service|Experience|Care)\b/i,
      /\bCustomer\s+Support\b/i,
      /\bRelationship\s+Manager\b/i,
      /\bCRO\b/i,
      /\bSales\b/i,
      /\bCommercial\b/i,
      /\bTrade\s+(Manager|Executive|Specialist|Analyst|Marketing)\b/i,
      /\bChannel\s+(Manager|Partner|Sales|Director)\b/i,
      /\bTerritory\s+(Manager|Sales|Executive)\b/i,
      /\bRetail\s+(Manager|Director|Supervisor|Analyst|Executive)\b/i,
      /\bInsurance\s+(Agent|Broker|Advisor|Sales|Executive)\b/i,
      /\bMedical\s+(Sales|Representative|Rep)\b/i,
      /\b(AE)\b/i,
    ],
  },

  // ── 7. Product ────────────────────────────────────────────────────────────────
  {
    department: "Product",
    patterns: [
      /\bProduct\s+(Manager|Owner|Lead|Director|VP|Analyst|Strategist|Designer)\b/i,
      /\bCPO\b/i,
      /\b(PM)\b/i,
      /\b(PO)\b/i,
    ],
  },

  // ── 8. Design ─────────────────────────────────────────────────────────────────
  {
    department: "Design",
    patterns: [
      /\bProduct\s+Designer\b/i,
      /\bUX\b/i,
      /\bUI\b/i,
      /\bCreative\s+Director\b/i,
      /\bArt\s+Director\b/i,
      /\bGraphic\b/i,
      /\bVisual\s+(Design|Designer)\b/i,
      /\bBrand\s+(Designer|Identity)\b/i,
      /\bInteraction\s+Design\b/i,
      /\bMotion\s+Design\b/i,
      /\bInterior\s+(Designer|Design|Decorator|Architect)\b/i,
      /\bFashion\s+Designer\b/i,
      /\b3D\s+(Designer|Artist|Modell?er|Animator)\b/i,
      /\bAnimation\b/i,
      /\bIllustrat(or|ion)\b/i,
      /\bDesigner\b/i,
    ],
  },

  // ── 9. Marketing ──────────────────────────────────────────────────────────────
  {
    department: "Marketing",
    patterns: [
      /\bMarketing\s+Engineer\b/i,
      /\bSEO\b/i,
      /\bSEM\b/i,
      /\bSocial\s+Media\b/i,
      /\bDigital\s+Marketing\b/i,
      /\bBrand\s+(Manager|Director|Strategist)\b/i,
      /\bCommunications\b/i,
      /\bPublic\s+Relations\b/i,
      /\b(PR)\b(?!\s+Manager)/i,
      /\bCMO\b/i,
      /\bDemand\s+Gen(eration)?\b/i,
      /\bMarketing\s+Ops\b/i,
      /\bCopywriter\b/i,
      /\bContent\s+(Writer|Strategist|Creator|Manager|Producer|Specialist)\b/i,
      /\bAdvertising\b/i,
      /\bGrowth\s+(Manager|Hacker|Marketer|Director|Lead)\b/i,
      /\bGrowth\b/i,
      /\bEvent\s+(Manager|Coordinator|Planner|Director|Specialist)\b/i,
      /\bMedia\s+(Buyer|Planner|Manager|Director|Specialist)\b/i,
      /\bPerformance\s+Marketing\b/i,
      /\bEmail\s+Marketing\b/i,
      /\bInfluencer\b/i,
      /\bCampaign\s+(Manager|Director|Specialist|Analyst)\b/i,
      /\bMarketing\b/i,
    ],
  },

  // ── 10. Engineering & Technology ──────────────────────────────────────────────
  // Broad /\bEngineer\b/ is intentionally last inside this block so specific
  // departments above (Energy, Architecture) take priority.
  {
    department: "Engineering",
    patterns: [
      // Software / Web
      /\bSoftware\s+Architect\b/i,
      /\bSolutions\s+Architect\b/i,
      /\bCloud\s+Architect\b/i,
      /\bEnterprise\s+Architect\b/i,
      /\bNetwork\s+Architect\b/i,
      /\bSWE\b/i,
      /\bSDE\b/i,
      /\bDeveloper\b/i,
      /\bProgrammer\b/i,
      /\bDevOps\b/i,
      /\bSRE\b/i,
      /\bQA\b/i,
      /\bTester\b/i,
      /\bFull\s+Stack\b/i,
      /\bFrontend\b/i,
      /\bBack[\s-]?end\b/i,
      /\biOS\b/i,
      /\bAndroid\b/i,
      /\bInfrastructure\b/i,
      /\bPlatform\b/i,
      /\bEmbedded\b/i,
      /\bFirmware\b/i,
      // Security
      /\bCybersecurity\b/i,
      /\bPenetration\s+Test(er|ing)\b/i,
      /\bInformation\s+Security\b/i,
      // Networking & IT
      /\bNetwork\s+(Engineer|Admin(istrator)?)\b/i,
      /\bDBA\b/i,
      /\bDatabase\s+Admin(istrator)?\b/i,
      /\bIT\s+(Manager|Specialist|Support|Director|Officer|Head|Lead|Engineer|Coordinator)\b/i,
      /\bInformation\s+Technology\b/i,
      /\bHelp\s+Desk\b/i,
      /\bService\s+Desk\b/i,
      /\bTechnical\s+Support\b/i,
      /\bSystem(s)?\s+Admin(istrator)?\b/i,
      /\bSysadmin\b/i,
      /\bTech\s+(Lead|Manager|Director)\b/i,
      /\bCloud\s+(Engineer|Manager|Administrator|Specialist)\b/i,
      // Enterprise Systems
      /\bERP\s+(Consultant|Specialist|Manager|Developer|Analyst)\b/i,
      /\bSAP\s+(Consultant|Developer|Analyst|Specialist|Manager)\b/i,
      /\bOracle\s+(Consultant|Developer|DBA|Administrator)\b/i,
      // C-level Tech
      /\bCTO\b/i,
      /\bCIO\b/i,
      /\bCISO\b/i,
      // Broad — keep last so specific rules above win
      /\bEngineer\b/i,
    ],
  },

  // ── 11. Architecture & Construction ───────────────────────────────────────────
  // After Engineering — "Software Architect" already caught above;
  // bare "Architect" here captures civil/building architects.
  {
    department: "Architecture",
    patterns: [
      /\bArchitect\b/i,
      /\bUrban\s+Plann(er|ing)\b/i,
      /\bLandscape\s+(Architect|Designer|Planner)\b/i,
      /\bQuantity\s+Surveyor\b/i,
      /\bCost\s+(Estimator|Consultant|Engineer)\b/i,
      /\bBIM\s+(Manager|Coordinator|Specialist|Modell?er)\b/i,
      /\bCivil\b/i,
      /\bStructural\b/i,
      /\bMEP\b/i,
      /\bHVAC\b/i,
      /\bConstruction\s+(Manager|Director|Supervisor|Coordinator|Engineer)\b/i,
      /\bDrafts(man|person)\b/i,
      /\bCAD\s+(Tech(nician)?|Operator|Designer|Engineer)\b/i,
      /\bRevit\b/i,
      /\bAutoCAD\b/i,
    ],
  },

  // ── 12. Finance & Banking ─────────────────────────────────────────────────────
  {
    department: "Finance",
    patterns: [
      /\bFinance\b/i,
      /\bFinancial\b/i,
      /\bAccountant\b/i,
      /\b(Financial|Cost|Credit)\s+Controller\b/i,
      /\bFP&A\b/i,
      /\bAuditor\b/i,
      /\bTax\b/i,
      /\bTreasury\b/i,
      /\bCFO\b/i,
      /\bChief\s+Financial\b/i,
      /\bBookkeeper\b/i,
      /\bAccounts\s+Payable\b/i,
      /\bAccounts\s+Receivable\b/i,
      /\bAccounting\b/i,
      /\bActuary\b/i,
      /\bInvestment\b/i,
      /\bBanking\b/i,
      /\bBanker\b/i,
      /\bBank\s+(Manager|Officer|Teller|Director)\b/i,
      /\bTeller\b/i,
      /\bCredit\s+(Analyst|Officer|Manager|Controller)\b/i,
      /\bLoan\s+(Officer|Manager|Processor)\b/i,
      /\bUnderwriter\b/i,
      /\bInsurance\b/i,
      /\bWealth\s+(Manager|Advisor|Management)\b/i,
      /\bPrivate\s+Banking\b/i,
      /\bMortgage\b/i,
      /\bRisk\s+(Analyst|Manager|Officer|Specialist)\b/i,
      /\bCompliance\b/i,
      /\bAnti[\s-]?Money\s+Laundering\b/i,
      /\bAML\b/i,
      /\bKYC\b/i,
      /\bPayroll\b/i,
      /\bBudget\b/i,
      /\bFintech\b/i,
    ],
  },

  // ── 13. HR & People ───────────────────────────────────────────────────────────
  {
    department: "HR",
    patterns: [
      /\bHR\b/i,
      /\bHuman\s+Resources\b/i,
      /\bRecruiter\b/i,
      /\bRecruitment\b/i,
      /\bTalent\s+(Acquisition|Manager|Partner|Specialist|Director|Head|Sourcer)\b/i,
      /\bTalent\b/i,
      /\bPeople\s+(Operations|Partner|Director|Manager|Analytics|Officer)\b/i,
      /\bHRBP\b/i,
      /\bCompensation\s+(and|&)\s+Benefits\b/i,
      /\bC&B\b/i,
      /\bCompensation\b/i,
      /\bBenefits\s+(Manager|Specialist|Admin(istrator)?)\b/i,
      /\bL&D\b/i,
      /\bLearning\s+(and|&)\s+Development\b/i,
      /\bTraining\s+(Manager|Specialist|Coordinator|Officer|Director)\b/i,
      /\bCHRO\b/i,
      /\bOrganizational\s+Development\b/i,
      /\bWorkforce\s+(Planning|Management|Analytics)\b/i,
      /\bEmployee\s+(Relations|Engagement|Experience)\b/i,
      /\bHR\s+(Generalist|Specialist|Analyst|Administrator|Officer)\b/i,
      /\bHRIS\b/i,
      /\bPerformance\s+Management\b/i,
      /\bExecutive\s+Search\b/i,
      /\bHeadhunter\b/i,
      /\bOnboarding\b/i,
    ],
  },

  // ── 14. Operations & Supply Chain ─────────────────────────────────────────────
  {
    department: "Operations",
    patterns: [
      /\bSupply\s+Chain\b/i,
      /\bLogistics\b/i,
      /\bProcurement\b/i,
      /\bPurchasing\s+(Manager|Officer|Specialist)\b/i,
      /\bFacilities\b/i,
      /\bExecutive\s+Assistant\b/i,
      /\bPersonal\s+Assistant\b/i,
      /\bOffice\s+(Manager|Admin(istrator)?|Coordinator)\b/i,
      /\bProject\s+Manager\b/i,
      /\bProgram\s+Manager\b/i,
      /\bCOO\b/i,
      /\bBusiness\s+Analyst\b/i,
      /\bProcess\s+(Improvement|Manager|Analyst|Excellence|Engineer)\b/i,
      /\bCoordinator\b/i,
      /\bDispatcher\b/i,
      /\bOperations\b/i,
      /\bAdmin(istrator)?\b/i,
      /\bAdministrative\b/i,
      /\bBranch\s+(Manager|Director|Head)\b/i,
      /\bWarehouse\b/i,
      /\bInventory\s+(Manager|Controller|Analyst|Specialist)\b/i,
      /\bProduction\s+(Manager|Director|Supervisor|Coordinator|Lead|Planner)\b/i,
      /\bPlant\s+(Manager|Director|Supervisor)\b/i,
      /\bMaintenance\s+(Manager|Engineer|Supervisor|Technician|Coordinator)\b/i,
      /\bSite\s+(Manager|Director|Supervisor|Engineer)\b/i,
      /\bQuality\s+(Manager|Assurance|Control|Specialist|Analyst|Director)\b/i,
      /\bHealth\s+(and|&)\s+Safety\b/i,
      /\bHSE\b/i,
      /\bFleet\s+(Manager|Coordinator|Supervisor)\b/i,
      /\bTransportation\s+(Manager|Coordinator|Supervisor)\b/i,
      /\bCustoms\s+(Manager|Officer|Broker|Clearance)\b/i,
      /\bImport\s*(and|&|\/)\s*Export\b/i,
      /\bFreight\b/i,
      /\bShipping\s+(Manager|Coordinator|Specialist)\b/i,
      /\bGovernment\s+Relations\b/i,
      /\bPRO\b/i,                         // Public Relations Officer (UAE)
      /\bGRO\b/i,                         // Government Relations Officer
      /\bPublic\s+Affairs\b/i,
      /\bDocument\s+Controller\b/i,
      /\bCompany\s+Secretary\b/i,
      /\bSix\s+Sigma\b/i,
    ],
  },

  // ── 15. Legal ─────────────────────────────────────────────────────────────────
  {
    department: "Legal",
    patterns: [
      /\bLawyer\b/i,
      /\bAttorney\b/i,
      /\bLegal\b/i,
      /\bCounsel\b/i,
      /\bRegulatory\b/i,
      /\bParalegal\b/i,
      /\bPatent\b/i,
      /\bGeneral\s+Counsel\b/i,
      /\bContract\s+(Manager|Specialist|Lawyer|Admin(istrator)?|Negotiator)\b/i,
      /\bIntellectual\s+Property\b/i,
      /\bLitigation\b/i,
      /\bCorporate\s+(Lawyer|Attorney|Governance)\b/i,
      /\bNotary\b/i,
    ],
  },

  // ── 16. Consulting & Strategy ─────────────────────────────────────────────────
  {
    department: "Consulting",
    patterns: [
      /\bConsultant\b/i,
      /\bAdvisor\b/i,
      /\bAdvisory\b/i,
      /\bStrategy\s+(Manager|Director|Consultant|Analyst|Lead|Specialist)\b/i,
      /\bManagement\s+Consulting\b/i,
      /\bBusiness\s+Consultant\b/i,
      /\bIT\s+Consultant\b/i,
      /\bChange\s+Management\b/i,
      /\bImplementation\s+(Consultant|Manager|Specialist)\b/i,
      /\bTransformation\b/i,
    ],
  },

  // ── 17. Healthcare & Medical ──────────────────────────────────────────────────
  // Operations has /\bHealth\s+(and|&)\s+Safety\b/ and comes first, so
  // "Health & Safety" roles are already captured before reaching this block.
  {
    department: "Healthcare",
    patterns: [
      /\bDoctor\b/i,
      /\bNurse\b/i,
      /\bNursing\b/i,
      /\bPhysician\b/i,
      /\bSurgeon\b/i,
      /\bPharmacist\b/i,
      /\bPharmacy\b/i,
      /\bTherapist\b/i,
      /\bMedical\b/i,
      /\bClinical\b/i,
      /\bDental\b/i,
      /\bDentist\b/i,
      /\bVeterinary\b/i,
      /\bDietitian\b/i,
      /\bNutritionist\b/i,
      /\bRadiologist\b/i,
      /\bRadiographer\b/i,
      /\bPathologist\b/i,
      /\bPhysiotherapist\b/i,
      /\bOphthalmologist\b/i,
      /\bOptometrist\b/i,
      /\bOccupational\s+Therapist\b/i,
      /\bEMT\b/i,
      /\bParamedic\b/i,
      /\bLab\s+Tech(nician)?\b/i,
      /\bLaboratory\b/i,
      /\bHospital\b/i,
      /\bHealthcare\b/i,
      /\bHealth\b/i,
    ],
  },

  // ── 18. Education ─────────────────────────────────────────────────────────────
  {
    department: "Education",
    patterns: [
      /\bTeacher\b/i,
      /\bProfessor\b/i,
      /\bLecturer\b/i,
      /\bInstructor\b/i,
      /\bDean\b/i,
      /\bAcademic\b/i,
      /\bEducation\b/i,
      /\bTutor\b/i,
      /\bLearning\s+Specialist\b/i,
      /\bLibrarian\b/i,
      /\bCurriculum\b/i,
      /\bSchool\s+(Manager|Director|Coordinator|Principal)\b/i,
    ],
  },
];

export function detectDepartment(rawTitle: string): string {
  if (!rawTitle || rawTitle.trim() === "") return "Other";

  const title = rawTitle.trim();

  for (const rule of DEPARTMENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(title)) {
        return rule.department;
      }
    }
  }

  return "Other";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorizedResult {
  normalized_title: string;
  seniority_level: string | null;
  department: string;
  original_title: string;
}

export interface TitleMappingRule {
  pattern: string;
  normalized_title: string | null;
  seniority_level: string | null;
  department: string | null;
  priority: number;
}

// ─── Abbreviation Expansion ───────────────────────────────────────────────────

// Order matters: expand most-specific / multi-word acronyms first
const ABBREV_MAP: Array<[RegExp, string]> = [
  // Multi-word acronyms
  [/\bFP&A\b/g, "Financial Planning & Analysis"],
  [/\bHRBP\b/g, "HR Business Partner"],
  [/\bSWE\b/g, "Software Engineer"],
  [/\bSDE\b/g, "Software Development Engineer"],
  [/\bSRE\b/g, "Site Reliability Engineer"],
  [/\bBDR\b/g, "Business Development Representative"],
  [/\bSDR\b/g, "Sales Development Representative"],
  [/\bDBA\b/g, "Database Administrator"],
  [/\bQA\b/g, "Quality Assurance"],
  [/\bBI\b/g, "Business Intelligence"],
  [/\bML\b/g, "Machine Learning"],
  [/\bNLP\b/g, "Natural Language Processing"],
  [/\bAI\b/g, "Artificial Intelligence"],
  // UI/UX combos before individual expansions
  [/\bUI\/UX\b/gi, "User Interface/User Experience"],
  [/\bUX\/UI\b/gi, "User Experience/User Interface"],
  [/\bUX\b/g, "User Experience"],
  [/\bUI\b/g, "User Interface"],
  // Role acronyms (standalone only via word boundary)
  [/\bPM\b/g, "Product Manager"],
  [/\bPO\b/g, "Product Owner"],
  [/\bAE\b/g, "Account Executive"],
  // Seniority abbreviations (with or without dot)
  [/\bSr\.\s*/gi, "Senior "],
  [/\bSr\b/gi, "Senior"],
  [/\bJr\.\s*/gi, "Junior "],
  [/\bJr\b/gi, "Junior"],
  // Title abbreviations
  [/\bEng\.\s*/gi, "Engineer "],
  [/\bEng\b/gi, "Engineer"],
  [/\bMgr\b/gi, "Manager"],
  [/\bMgmt\b/gi, "Management"],
  [/\bDevs\b/gi, "Developers"],
  [/\bDev\.\s*/gi, "Developer "],
  [/\bDev\b/gi, "Developer"],
  [/\bMktg\b/gi, "Marketing"],
  [/\bAcct\b/gi, "Accountant"],
  [/\bAssoc\b/gi, "Associate"],
  [/\bAsst\b/gi, "Assistant"],
  [/\bExec\b/gi, "Executive"],
  [/\bOps\b/gi, "Operations"],
  [/\bCoord\b/gi, "Coordinator"],
  [/\bSupt\b/gi, "Superintendent"],
  [/\bSvcs\b/gi, "Services"],
  [/\bSvc\b/gi, "Service"],
  [/\bInfo\b/gi, "Information"],
  [/\bSys\b/gi, "Systems"],
  [/\bIntl\b/gi, "International"],
  [/\bNatl\b/gi, "National"],
  [/\bDept\b/gi, "Department"],
  [/\bRep\b/gi, "Representative"],
  // "Tech" as prefix only (not inside Technology/Technical)
  [/\bTech\b(?!nolog|nical)/gi, "Technical"],
  // "Admin" standalone → Administrator
  [/\bAdmin\b/gi, "Administrator"],
];

export function expandAbbreviations(title: string): string {
  let result = title;
  for (const [pattern, replacement] of ABBREV_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

// ─── Title Normalization ──────────────────────────────────────────────────────

// Seniority modifier prefixes that can be stripped from start of title
const SENIORITY_STRIP_PREFIXES: RegExp[] = [
  /^Senior\s+/i,
  /^Junior\s+/i,
  /^Lead\s+/i,
  /^Principal\s+/i,
  /^Staff\s+/i,
  /^Distinguished\s+/i,
];

// Strip "Associate " prefix only when NOT followed by a management word
const ASSOC_STRIP_RE =
  /^Associate\s+(?!Director|Vice\s+President|VP|SVP|EVP|AVP|Manager\b)/i;

// Roman numeral / level indicator suffixes
const SUFFIX_STRIP_RE =
  /[\s,]+(?:IV|VI{0,3}|I{1,3}|V|Level\s*\d+|L\d+)\s*$/i;

export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle || rawTitle.trim() === "") return "";

  const cleaned = rawTitle.trim();
  // Titles that are only punctuation/symbols → empty
  if (/^[\W_]+$/.test(cleaned)) return "";

  // Step 1: expand abbreviations
  let title = expandAbbreviations(cleaned);

  // Step 2: strip roman numeral / level suffixes from end
  title = title.replace(SUFFIX_STRIP_RE, "").trim();

  // Step 3: strip seniority modifier prefix from start (one pass)
  for (const prefixRe of SENIORITY_STRIP_PREFIXES) {
    if (prefixRe.test(title)) {
      const stripped = title.replace(prefixRe, "").trim();
      if (stripped.length > 0) {
        title = stripped;
        break;
      }
    }
  }

  // Step 4: strip "Associate " prefix when not part of management role
  if (ASSOC_STRIP_RE.test(title)) {
    const stripped = title.replace(ASSOC_STRIP_RE, "").trim();
    if (stripped.length > 0) title = stripped;
  }

  return title.replace(/\s{2,}/g, " ").trim();
}

// ─── Full Categorization ──────────────────────────────────────────────────────

export function categorizeTitle(rawTitle: string): CategorizedResult {
  const original_title = (rawTitle ?? "").trim();

  if (!original_title) {
    return { normalized_title: "", seniority_level: null, department: "Other", original_title: "" };
  }

  // Expand abbreviations for department detection and normalization
  const expanded = expandAbbreviations(original_title);

  // Seniority from the ORIGINAL title (catches abbreviations like Sr., Jr.)
  const seniority_level = detectSeniority(original_title);

  // Department from the EXPANDED title (abbreviations resolved)
  const department = detectDepartment(expanded);

  // Normalized title strips seniority modifiers
  const normalized_title = normalizeTitle(original_title);

  return { normalized_title, seniority_level, department, original_title };
}

// ─── Custom Rules ─────────────────────────────────────────────────────────────

export function applyCustomRule(
  rawTitle: string,
  rules: TitleMappingRule[]
): Partial<CategorizedResult> | null {
  if (!rules.length) return null;

  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  const title = (rawTitle ?? "").trim().toLowerCase();

  for (const rule of sorted) {
    if (title.includes(rule.pattern.toLowerCase())) {
      const result: Partial<CategorizedResult> = {};
      if (rule.normalized_title !== null) result.normalized_title = rule.normalized_title;
      if (rule.seniority_level !== null) result.seniority_level = rule.seniority_level;
      if (rule.department !== null) result.department = rule.department;
      return result;
    }
  }

  return null;
}

export function categorizeTitleWithRules(
  rawTitle: string,
  customRules: TitleMappingRule[] = []
): CategorizedResult {
  const base = categorizeTitle(rawTitle);
  if (!customRules.length) return base;

  const override = applyCustomRule(rawTitle, customRules);
  if (!override) return base;

  return {
    ...base,
    ...override,
  };
}

// ─── Fuzzy Matching ───────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Use two-row rolling array for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function wordOverlapScore(searchTerm: string, candidate: string): number {
  const searchWords = new Set(searchTerm.toLowerCase().split(/\s+/).filter(Boolean));
  const candidateWords = new Set(candidate.toLowerCase().split(/\s+/).filter(Boolean));
  if (searchWords.size === 0) return 0;
  let matches = 0;
  for (const w of searchWords) {
    if (candidateWords.has(w)) matches++;
  }
  return matches / searchWords.size;
}

export function fuzzyMatchTitle(
  searchTerm: string,
  candidateTitle: string
): number {
  if (!searchTerm || !candidateTitle) return 0;

  // Expand abbreviations before comparing
  const search = expandAbbreviations(searchTerm.trim()).toLowerCase();
  const candidate = expandAbbreviations(candidateTitle.trim()).toLowerCase();

  // Exact match
  if (search === candidate) return 1.0;

  // Contains (search inside candidate)
  if (candidate.includes(search)) return 0.9;

  // Contains (candidate inside search)
  if (search.includes(candidate)) return 0.85;

  // Word overlap precision (how many search words appear in candidate)
  const wordScore = wordOverlapScore(search, candidate);

  // Levenshtein similarity
  const dist = levenshtein(search, candidate);
  const maxLen = Math.max(search.length, candidate.length);
  const levenScore = maxLen === 0 ? 1 : 1 - dist / maxLen;

  return Math.max(wordScore, levenScore * 0.8);
}

export function findSimilarTitles(
  searchTerm: string,
  titles: string[],
  threshold: number = 0.4
): Array<{ title: string; score: number }> {
  return titles
    .map((title) => ({ title, score: fuzzyMatchTitle(searchTerm, title) }))
    .filter((item) => item.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
