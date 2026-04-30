import db from '../db';
import type { GeneratedCaseData, MissionOffer } from '../types';

interface SeedCaseTemplate {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  difficulty: number;
  minLevel: number;
  data: GeneratedCaseData;
}

interface SeedCaseRow {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  min_level: number;
  raw_case_json: string;
}

export interface SeedCaseClaim {
  templateId: string;
  slug: string;
  title: string;
  difficulty: number;
  minLevel: number;
  data: GeneratedCaseData;
}

function cloneCaseData(data: GeneratedCaseData): GeneratedCaseData {
  return JSON.parse(JSON.stringify(data)) as GeneratedCaseData;
}

function getCrimeSummary(data: GeneratedCaseData): string {
  const summary = typeof data?.crime?.summary === 'string' ? data.crime.summary.trim() : '';
  if (summary) return summary;

  const description = typeof data?.crime?.description === 'string' ? data.crime.description.trim() : '';
  return description;
}

const SEED_CASE_TEMPLATES: SeedCaseTemplate[] = [
  {
    id: 'seed-star-of-carthage',
    slug: 'star-of-carthage',
    title: 'The Star of Carthage',
    sortOrder: 1,
    difficulty: 1,
    minLevel: 1,
    data: {
      crime: {
        summary: "A gala theft in Istanbul sends the Star of Carthage necklace through forged paperwork, decoy ports, and one real private-vault buyer.",
        description: "The Star of Carthage, a necklace insured for 4.2 million euros, vanished from the Istanbul Archaeological Museum during a private gala after the security grid went dark for three minutes. What looks like a clean museum theft quickly turns into a layered smuggling route built from false restoration requests, phantom port bookings, and paperwork meant to drag investigators toward the wrong handoff. Work the route before the necklace is stabilized behind a shell insurer and sold into a private collection.",
        type: 'theft',
      },
      cities: [
        {
          name: 'Istanbul',
          country: 'Turkey',
          lat: 41.0082,
          lng: 28.9784,
          witnesses: [
            {
              name: 'Elif Yilmaz',
              personality: 'Nervous museum curator who noticed something odd',
              backstory: 'Head curator at the Istanbul Archaeological Museum for 12 years. She organized the gala and feels personally responsible for the theft.',
              knowledge: [
                'The security cameras were disabled exactly 3 minutes before the theft',
                'A woman in a red dress asked whether an Athens conservator could restore an Ottoman clasp without paperwork',
                'The alarm system was bypassed using an insider code',
              ],
              voiceDescription: 'Middle-aged woman, slight Turkish accent, anxious and fast-speaking',
            },
            {
              name: 'Marco Ferretti',
              personality: 'Charming Italian art dealer with connections',
              backstory: 'International art dealer who was attending the gala as a VIP guest. Known for his extensive network in the underground art world.',
              knowledge: [
                "He overheard one caller push Marrakech while another snapped that Lisbon was too visible",
                'A courier booked a late southbound flight with no checked baggage minutes after the gala',
                'The necklace was recently appraised at 4.2 million euros',
              ],
              voiceDescription: '50s Italian man, smooth baritone, confident and slightly evasive',
            },
          ],
        },
        {
          name: 'Athens',
          country: 'Greece',
          lat: 37.9838,
          lng: 23.7275,
          witnesses: [
            {
              name: 'Nikos Varela',
              personality: 'Auction registrar who treats missing paperwork like a personal insult',
              backstory: 'He manages intake at a private Athens auction house and remembers every wealthy client who asks for exceptions before a piece even arrives.',
              knowledge: [
                'An assistant tied to Isabella Crane requested blank provenance papers for an Ottoman necklace',
                'No high-value jewel was ever logged into the Athens vault',
                'The caller disappeared the moment he asked for original ownership records',
              ],
              voiceDescription: '50s Greek man, dry formal tone, patient and suspicious',
            },
            {
              name: 'Sofia Markou',
              personality: 'Piraeus freight clerk who trusts container logs over glamorous stories',
              backstory: 'She watches bonded lockers near the port and notices when expensive rumors arrive with no matching cargo behind them.',
              knowledge: [
                'A courier locker at Piraeus was rented under a false museum lender name',
                'The locker held only wrapping silk and a copied customs seal',
                'Athens looked like paperwork cover, not the actual drop',
              ],
              voiceDescription: '30s Greek woman, brisk dockside cadence, alert and skeptical',
            },
          ],
        },
        {
          name: 'Marrakech',
          country: 'Morocco',
          lat: 31.6295,
          lng: -7.9811,
          witnesses: [
            {
              name: 'Amina Benali',
              personality: 'Sharp-eyed spice merchant who sees everything',
              backstory: 'Runs a spice stall in the medina for 20 years. Nothing happens in the souk without her knowing.',
              knowledge: [
                'The same European woman asked which Algiers freeport brokers move sealed antiques fastest',
                'She met a fixer at Cafe Atlas and left with fresh shipping labels',
                'Her case never opened in the medina, which made the jewelers suspicious',
              ],
              voiceDescription: '60s Moroccan woman, warm but direct, speaks with authority',
            },
            {
              name: 'Youssef Tazi',
              personality: 'Quiet jeweler with a mysterious past',
              backstory: 'Master jeweler who once worked for a European auction house before retiring to Marrakech. Some say he left under suspicious circumstances.',
              knowledge: [
                'Someone brought him photos and a rough mock-up of the Star of Carthage asking if the clasp could be copied without exposing the original stones',
                "The person who contacted him used the name 'Nightingale'",
                'The payment guarantee behind the inquiry came from a Vienna insurance front, and he walked away when he realized they wanted the original necklace hidden behind a fake twin',
              ],
              voiceDescription: '70s Moroccan man, soft-spoken, deliberate pauses, wise tone',
            },
          ],
        },
        {
          name: 'Algiers',
          country: 'Algeria',
          lat: 36.7538,
          lng: 3.0588,
          witnesses: [
            {
              name: 'Karim Belkacem',
              personality: 'Freeport dispatcher who hates phantom bookings',
              backstory: 'He manages sealed cargo windows at Algiers freeport and keeps personal notes on clients who try to reserve unloading space for goods that never appear.',
              knowledge: [
                'A freeport intake note mentioned the necklace, but the container number never reached the dock',
                'The paperwork was withdrawn minutes before unloading',
                'Someone wanted Algiers on the trail without sending any cargo',
              ],
              voiceDescription: '40s Algerian man, clipped official tone, practical and guarded',
            },
            {
              name: 'Leila Haddad',
              personality: 'Customs archivist who remembers forged seals better than real ones',
              backstory: 'She audits canceled manifests for the port authority and can spot copied insurance paperwork from a single wrong code stamp.',
              knowledge: [
                'The canceled manifest carried a copied seal from a Vienna insurer',
                'The goods description was too vague to survive a real customs exam',
                'She filed it as a phantom shipment meant to misdirect investigators',
              ],
              voiceDescription: '30s Algerian woman, precise voice, cool and methodical',
            },
          ],
        },
        {
          name: 'Vienna',
          country: 'Austria',
          lat: 48.2082,
          lng: 16.3738,
          witnesses: [
            {
              name: 'Dr. Helga Braun',
              personality: 'Meticulous insurance investigator',
              backstory: 'Senior investigator at Europa Insurance Group. She has been tracking art theft rings across Europe for 15 years.',
              knowledge: [
                'The necklace was insured by a shell company whose vault access was guaranteed through a Geneva private freeport account',
                'The insurance policy was taken out just 3 weeks before the theft',
                'The beneficiary chain avoided Austria entirely once the jewel was stabilized',
              ],
              voiceDescription: '50s Austrian woman, precise diction, analytical and cold',
            },
            {
              name: 'Franz Huber',
              personality: 'Retired Interpol agent turned private consultant',
              backstory: 'Spent 25 years at Interpol specializing in art crime. Now consults privately and still has contacts everywhere.',
              knowledge: [
                'In two earlier art thefts, Sokolov\'s circle pushed buyers toward Prague to draw heat off the real vault',
                'Prague restorers were asked for fake Habsburg provenance on Ottoman pieces',
                'The Vienna paperwork stage ended the moment the Geneva hold was secured',
              ],
              voiceDescription: '60s Austrian man, gruff voice, no-nonsense, speaks in short sentences',
            },
          ],
        },
        {
          name: 'Prague',
          country: 'Czech Republic',
          lat: 50.0755,
          lng: 14.4378,
          witnesses: [
            {
              name: 'Tomas Cerny',
              personality: 'Antiquities restorer who distrusts anyone asking for instant history',
              backstory: 'He repairs aristocratic heirlooms in Prague and has become a quiet expert at spotting forged provenance before a single object reaches his bench.',
              knowledge: [
                'A caller asked him to forge Habsburg-era provenance for an Ottoman necklace and later showed him a near-convincing twin',
                'The stones in that necklace were weighted glass and the clasp casting was freshly made, not historical',
                'The request felt like bait for customs inspectors',
              ],
              voiceDescription: '60s Czech man, careful soft voice, scholarly and wary',
            },
            {
              name: 'Eva Krizova',
              personality: 'Night dispatcher who notices when decoys are heavier than the truth',
              backstory: 'She monitors bonded courier arrivals across Prague rail depots and has a habit of opening incident logs whenever expensive cargo behaves theatrically.',
              knowledge: [
                'A courier bag from Vienna was rushed through Prague but held only weighted glass paste',
                'The paperwork copied museum seals but no insurer codes',
                'She wrote it off as a deliberate decoy transfer',
              ],
              voiceDescription: '40s Czech woman, quick crisp speech, sharp-eyed and unsentimental',
            },
          ],
        },
        {
          name: 'Geneva',
          country: 'Switzerland',
          lat: 46.2044,
          lng: 6.1432,
          witnesses: [
            {
              name: 'Margot Duval',
              personality: 'Freeport compliance officer who keeps elegant notes on ugly money',
              backstory: 'She audits private vault usage at the Geneva freeport and knows which clients hide behind art insurance fronts to avoid appearing on inventory trails.',
              knowledge: [
                'A banker acting for Viktor Sokolov reserved a sealed viewing room for an Ottoman necklace',
                'The vault request used the same shell company listed on the Vienna policy',
                'The client demanded privacy before moving the piece again',
              ],
              voiceDescription: '40s Swiss French woman, low steady voice, discreet and exact',
            },
            {
              name: 'Luc Renard',
              personality: 'Private driver who remembers passengers by what they refuse to say aloud',
              backstory: 'He handles secure late-night transfers around Lake Geneva and keeps mental tabs on clients who pay double to avoid customs eyes.',
              knowledge: [
                'He drove Sokolov\'s fixer from the Geneva freeport to a lakeside villa carrying a slim jewel case',
                'The fixer said the Star of Carthage would disappear once the buyer confirmed the clasp',
                'Sokolov was waiting at the villa when the case arrived',
              ],
              voiceDescription: '50s French Swiss man, restrained driver\'s cadence, observant and blunt',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Viktor Sokolov',
          description: 'Russian oligarch with a known obsession for Ottoman artifacts. Has been linked to previous art thefts across Europe. Was in Istanbul the week before the gala and took out an insurance policy on the necklace through a shell company.',
          isCorrect: true,
        },
        {
          name: 'Isabella Crane',
          description: 'British socialite and art collector. Was the woman in the red dress at the gala. Known for her extravagant lifestyle and mounting debts.',
          isCorrect: false,
        },
        {
          name: 'Omar Hassan',
          description: 'Egyptian antiquities dealer who lost an Ottoman artifact case to Viktor Sokolov and now has motive, market access, and enough bitterness to look dangerous.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'The security cameras were disabled using an insider access code that only 5 people had.',
          witnessName: 'Elif Yilmaz',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A woman in a red dress asked whether an Athens conservator could quietly repair an Ottoman clasp.',
          witnessName: 'Elif Yilmaz',
          isMisleading: true,
          pointsToCity: 'Athens',
          pointsToSuspect: null,
        },
        {
          content: "A gala phone call argued over Marrakech versus Lisbon, but the only route that produced real movement was the southbound Marrakech handoff.",
          witnessName: 'Marco Ferretti',
          isMisleading: false,
          pointsToCity: 'Marrakech',
          pointsToSuspect: null,
        },
        {
          content: 'Isabella Crane, the woman in the red dress, was seen arguing with a security guard before the theft.',
          witnessName: 'Elif Yilmaz',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Isabella Crane',
        },
        {
          content: 'An assistant tied to Isabella Crane requested blank provenance papers for an Ottoman necklace, but no jewel ever reached Athens.',
          witnessName: 'Nikos Varela',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Isabella Crane',
        },
        {
          content: 'A courier locker at Piraeus held only wrapping silk and a copied customs seal.',
          witnessName: 'Sofia Markou',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A broker in Marrakech bragged he could stage an Algiers freeport trail whether or not any cargo ever touched the dock.',
          witnessName: 'Amina Benali',
          isMisleading: true,
          pointsToCity: 'Algiers',
          pointsToSuspect: null,
        },
        {
          content: "The would-be cutter used the codename 'Nightingale' and hid the real necklace behind a Prague-bound fake financed through a Vienna insurance front.",
          witnessName: 'Youssef Tazi',
          isMisleading: false,
          pointsToCity: 'Vienna',
          pointsToSuspect: null,
        },
        {
          content: 'An Algiers intake note mentioned the necklace, but the container number never reached the dock.',
          witnessName: 'Karim Belkacem',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'The canceled Algiers manifest carried a copied seal from a Vienna insurer.',
          witnessName: 'Leila Haddad',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'The Vienna policy guaranteed vault access through a Geneva private freeport account.',
          witnessName: 'Dr. Helga Braun',
          isMisleading: false,
          pointsToCity: 'Geneva',
          pointsToSuspect: null,
        },
        {
          content: 'Sokolov\'s circle pushed buyers toward Prague in earlier thefts to draw heat off the real vault.',
          witnessName: 'Franz Huber',
          isMisleading: true,
          pointsToCity: 'Prague',
          pointsToSuspect: null,
        },
        {
          content: 'A Prague restorer inspected a near-convincing Ottoman necklace, but the stones were weighted glass and the clasp was freshly cast.',
          witnessName: 'Tomas Cerny',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A courier bag routed to Prague held only weighted glass paste and copied museum seals.',
          witnessName: 'Eva Krizova',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A banker acting for Viktor Sokolov reserved a sealed Geneva viewing room for an Ottoman necklace.',
          witnessName: 'Margot Duval',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Viktor Sokolov',
        },
        {
          content: 'Luc Renard drove Sokolov\'s fixer from the Geneva freeport to a villa with the Star of Carthage in hand.',
          witnessName: 'Luc Renard',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Viktor Sokolov',
        },
      ],
    },
  },
  {
    id: 'seed-sapphire-relay',
    slug: 'sapphire-relay',
    title: 'The Sapphire Relay',
    sortOrder: 2,
    difficulty: 2,
    minLevel: 1,
    data: {
      crime: {
        summary: 'A stolen quantum relay chip leaves Singapore under cover of a sprinkler failure and a trail of staged transit reports.',
        description: 'At the Helix Defense Expo in Singapore, a sapphire-blue quantum relay chip disappeared moments after a fake sprinkler failure flooded the demonstration hall and forced the crowd into controlled chaos. The theft points toward a professional espionage chain using rerouted freight, cloned credentials, and decoy handoffs to hide who is moving the chip and who is merely being framed. Trace the real courier path before the relay disappears into a defense contractor\'s black-market pipeline.',
        type: 'espionage',
      },
      cities: [
        {
          name: 'Singapore',
          country: 'Singapore',
          lat: 1.3521,
          lng: 103.8198,
          witnesses: [
            {
              name: 'Tan Mei Lin',
              personality: 'Exacting operations director who notices procedural anomalies',
              backstory: 'She ran floor operations for the Helix Defense Expo and now faces an internal inquiry over the vanished prototype.',
              knowledge: [
                'The sprinkler system was tripped from a maintenance console on the mezzanine',
                'A woman wearing a courier lanyard left the flood zone completely dry',
                'The service badge used during the breach belonged to a subcontractor already off site',
              ],
              voiceDescription: '30s Singaporean woman, clipped professional tone, quietly frustrated',
            },
            {
              name: 'Rafiq Bhandari',
              personality: 'Observant freelance AV engineer with a gossip streak',
              backstory: 'He handled projection systems for the keynote stage and kept moving between loading docks and control rooms.',
              knowledge: [
                'He watched a silver equipment case get swapped into a catering cart marked TNG-14',
                'A dock dispatcher mentioned Tangier freeport over the radio minutes later',
                'A fallback dispatch packet named Busan bonded transit if Tangier drew too much attention',
                'A portable jammer pulsed from loading bay six just before the blackout',
              ],
              voiceDescription: '40s South Asian man, lively cadence, amused but alert',
            },
          ],
        },
        {
          name: 'Tangier',
          country: 'Morocco',
          lat: 35.7595,
          lng: -5.834,
          witnesses: [
            {
              name: 'Samira El Idrissi',
              personality: 'Methodical ferry manifest clerk who trusts paperwork more than people',
              backstory: 'She has worked the Tangier ferry terminal for nine years and remembers odd cargo declarations instantly.',
              knowledge: [
                'A courier using the alias Nora Vance booked overnight passage with a bonded crate',
                'The crate was declared marine sensors but requested armed escort clearance',
                'The courier met Karim Haddad beside Freeport gate three before departure',
              ],
              voiceDescription: '40s Moroccan woman, calm, precise, low steady register',
            },
            {
              name: 'Nabil Chaoui',
              personality: 'Smooth customs broker who pretends everything is routine',
              backstory: 'He arranges paperwork for bonded cargo and knows which consignments come with pressure from above.',
              knowledge: [
                'The bonded crate was rerouted to Montreal cold storage under a diplomatic waiver',
                'The waiver was signed by a shell company called Northstar Maritime',
                'Karim Haddad argued with the courier because the crate bypassed the warehouse he expected to control',
              ],
              voiceDescription: '50s Moroccan man, polished voice, unhurried and slightly smug',
            },
          ],
        },
        {
          name: 'Montreal',
          country: 'Canada',
          lat: 45.5017,
          lng: -73.5673,
          witnesses: [
            {
              name: 'Dr. Chloe Bouchard',
              personality: 'Cold insurance risk analyst with an appetite for patterns',
              backstory: 'She specializes in sensitive technology insurance fraud and was asked to quietly review the relay chip policy.',
              knowledge: [
                'Northstar Maritime shares a director with Elena Petrov',
                'The chip insurance rider was activated forty-eight hours before the expo breach',
                'The payout instructions named a private Baltic bank already used to finance Arctic relay and drone-control bids linked to Elena Petrov',
              ],
              voiceDescription: '40s Quebecois woman, measured diction, analytical and dry',
            },
            {
              name: 'Marc-Andre Pelletier',
              personality: 'Overworked freight dispatcher who memorizes faces',
              backstory: 'He supervises overnight temperature-controlled freight and saw the suspicious transfer that never hit the books.',
              knowledge: [
                'The first security stills seemed to place Adrian Vale near the crate route before anyone synced the dock clocks',
                'The driver who removed the crate used the phrase winter room is booked',
                'The corrected onward booking referenced a Stockholm evaluation vault under the same Northstar handling code',
                'After syncing the cameras he realized Vale arrived late, and he recognized Elena Petrov from an earlier Northstar bonded shipment review that Vale had been shut out of',
              ],
              voiceDescription: '50s Canadian man, tired rasp, practical and blunt',
            },
          ],
        },
        {
          name: 'Busan',
          country: 'South Korea',
          lat: 35.1796,
          lng: 129.0756,
          witnesses: [
            {
              name: 'Park Ji-hoon',
              personality: 'Bonded terminal dispatcher who notices shipments that exist only on paper',
              backstory: 'He manages refrigerated priority freight through Busan port and flagged the relay shipment because every document arrived before the cargo did.',
              knowledge: [
                'A pre-alert from Singapore reserved cold-chain handling in Busan, but no bonded crate matching the relay ever arrived',
                'The empty marine-sensors shell that did arrive carried Adrian Vale\'s name on the wrong pickup slot',
                'The waiver codes in the Busan paperwork matched Northstar Maritime templates later reused in Canada',
              ],
              voiceDescription: '40s Korean man, clipped port-office cadence, skeptical and precise',
            },
            {
              name: 'Min Seo-yun',
              personality: 'Freeport security analyst who trusts camera logs over courier stories',
              backstory: 'She audits restricted-lane footage for Busan freeport and reconstructed the fake pickup meant to make Busan look like the real handoff.',
              knowledge: [
                'A runner planted a cloned courier lanyard beside the empty shell to make the Busan transfer look real',
                'The false pickup window was closed before any high-value cargo ever entered the zone',
                'A Baltic buyer code was attached to the canceled routing packet once Busan was written off',
              ],
              voiceDescription: '30s Korean woman, measured security tone, analytical and dry',
            },
          ],
        },
        {
          name: 'Stockholm',
          country: 'Sweden',
          lat: 59.3293,
          lng: 18.0686,
          witnesses: [
            {
              name: 'Ingrid Magnusson',
              personality: 'Defense procurement officer who distrusts elegant cover stories',
              backstory: 'She oversees secure evaluations for Nordic defense communications hardware and recognized the relay paperwork the moment it crossed her desk.',
              knowledge: [
                'Elena Petrov approved a Stockholm evaluation transfer through a Nordic buyer shell two days after the Montreal handoff',
                'The buyer shell used the same Northstar payout rails that funded the relay insurance rider',
                'Adrian Vale\'s credential was denied before the relay ever entered the evaluation vault',
              ],
              voiceDescription: '40s Swedish woman, calm official tone, incisive and unsentimental',
            },
            {
              name: 'Henrik Strand',
              personality: 'Integration-vault supervisor who remembers who actually crossed the threshold',
              backstory: 'He runs access control for a shielded evaluation suite and noticed which visitors had paperwork and which only had reputations.',
              knowledge: [
                'The relay arrived in a Faraday transport case signed into the vault under Elena Petrov\'s authority',
                'A rejected access tablet still showed Adrian Vale\'s cloned credential attempts after the relay was already inside',
                'The final payment confirmation cleared only after Elena verified a successful threshold test',
              ],
              voiceDescription: '50s Swedish man, low measured register, observant and exact',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Elena Petrov',
          description: 'Former defense contractor turned broker for embargoed hardware. She hides operations behind maritime shell companies and Baltic banking rails.',
          isCorrect: true,
        },
        {
          name: 'Adrian Vale',
          description: 'Venture capitalist and former Northstar Maritime advisor who was frozen out of the relay deal, leaving him with motive, access history, and the look of a betrayed insider.',
          isCorrect: false,
        },
        {
          name: 'Karim Haddad',
          description: 'Tangier logistics fixer who arranges discreet freeport passages and looked like the obvious broker when the crate skipped the warehouse he expected to run.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'The sprinkler sabotage came from a maintenance console above the expo floor.',
          witnessName: 'Tan Mei Lin',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A dispatcher mentioned Tangier freeport right after the silver case disappeared into a catering cart.',
          witnessName: 'Rafiq Bhandari',
          isMisleading: false,
          pointsToCity: 'Tangier',
          pointsToSuspect: null,
        },
        {
          content: 'A fallback dispatch packet named Busan bonded transit if Tangier drew too much attention.',
          witnessName: 'Rafiq Bhandari',
          isMisleading: true,
          pointsToCity: 'Busan',
          pointsToSuspect: null,
        },
        {
          content: 'The courier met Karim Haddad at Freeport gate three before boarding.',
          witnessName: 'Samira El Idrissi',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Karim Haddad',
        },
        {
          content: 'The bonded crate was rerouted from Tangier to Montreal cold storage under a diplomatic waiver.',
          witnessName: 'Nabil Chaoui',
          isMisleading: false,
          pointsToCity: 'Montreal',
          pointsToSuspect: null,
        },
        {
          content: 'Northstar Maritime shares a director and payout bank with Elena Petrov.',
          witnessName: 'Dr. Chloe Bouchard',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Elena Petrov',
        },
        {
          content: 'The first security stills circulated after the breach appeared to show Adrian Vale beside the crate route in Montreal.',
          witnessName: 'Marc-Andre Pelletier',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Adrian Vale',
        },
        {
          content: 'Once the dock clocks were corrected, the real onward booking pointed to a Stockholm evaluation vault under the same Northstar handling code.',
          witnessName: 'Marc-Andre Pelletier',
          isMisleading: false,
          pointsToCity: 'Stockholm',
          pointsToSuspect: null,
        },
        {
          content: 'Once the dock clocks were synced, Adrian Vale fell out of the window and Elena Petrov remained the only player tied to the same bonded-shipment security phrase.',
          witnessName: 'Marc-Andre Pelletier',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Elena Petrov',
        },
        {
          content: 'The empty marine-sensors shell in Busan used Adrian Vale\'s name on the pickup slot even though no high-value crate entered the terminal.',
          witnessName: 'Park Ji-hoon',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Adrian Vale',
        },
        {
          content: 'The Busan paperwork reused Northstar waiver codes that later surfaced again on Elena Petrov\'s Nordic buyer shell.',
          witnessName: 'Min Seo-yun',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Elena Petrov approved the Stockholm evaluation transfer herself and used the same Nordic shell that carried the relay insurance payout rails.',
          witnessName: 'Ingrid Magnusson',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Elena Petrov',
        },
        {
          content: 'Adrian Vale\'s credential was rejected after the relay was already inside the Stockholm vault, leaving Elena Petrov as the only operator with successful access.',
          witnessName: 'Henrik Strand',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
      ],
    },
  },
  {
    id: 'seed-ash-ledger',
    slug: 'ash-ledger',
    title: 'The Ash Ledger',
    sortOrder: 3,
    difficulty: 2,
    minLevel: 2,
    data: {
      crime: {
        summary: 'A Vatican vault theft exposes a trafficking ledger buried under false alarms, church logistics, and antiquities fronts.',
        description: 'A hand-annotated ledger tying looted antiquities to buyers, couriers, and laundering intermediaries vanished from a sealed restoration vault beneath Vatican City after a false fire alarm cleared the corridor. The book is more dangerous than the artifacts themselves: it can expose the middlemen who turned sacred pieces into private inventory across Europe and the Mediterranean. Follow the ledger through restoration cover stories, bonded transfers, and planted suspicion before the network burns the last clean proof.',
        type: 'smuggling',
      },
      cities: [
        {
          name: 'Rome',
          country: 'Italy',
          lat: 41.9028,
          lng: 12.4964,
          witnesses: [
            {
              name: 'Sister Lucia Ferretti',
              personality: 'Composed conservator with a forensic eye for damaged objects',
              backstory: 'She supervises manuscript restoration inside the Vatican annex and noticed what did not belong after the evacuation.',
              knowledge: [
                'The fire alarm originated in a maintenance tunnel rather than the chapel wing',
                'A man in courier coveralls carried a humidity case through the west cloister',
                'A broken wax seal fragment near the vault bore a Georgian shipping crest',
              ],
              voiceDescription: '50s Italian woman, calm, measured, gently authoritative',
            },
            {
              name: 'Paolo Conti',
              personality: 'Retired security consultant who trusts timestamps over testimony',
              backstory: 'He once worked art-crime cases for the Carabinieri and now advises the restoration vault on access control.',
              knowledge: [
                'Two access cards were cloned within ninety seconds, which made the breach look like a staged insider failure rather than a lone intrusion',
                'One of those cloned credentials later booked freight to Tbilisi',
                'A Piraeus bonded-art contact offered to float Athens as cover if the Georgian lane drew notice',
                'Celeste Moreau had already placed a deposit on a reliquary whose ownership trail appeared inside the missing ledger',
              ],
              voiceDescription: '60s Italian man, gravelly, skeptical, economical with words',
            },
          ],
        },
        {
          name: 'Tbilisi',
          country: 'Georgia',
          lat: 41.7151,
          lng: 44.8271,
          witnesses: [
            {
              name: 'Nino Arveladze',
              personality: 'Precise auction cataloguer who remembers provenance details',
              backstory: 'She catalogs private cellar sales in Old Tbilisi and saw the ledger before it changed hands again.',
              knowledge: [
                'The ledger was photographed in a private cellar under a wine house',
                'A broker called the accountant ordered it sent west to Cartagena',
                'The transport seal matched a Black Sea customs cooperative used by smugglers',
              ],
              voiceDescription: '30s Georgian woman, clear diction, alert and slightly impatient',
            },
            {
              name: 'Giorgi Dekanoidze',
              personality: 'River port mechanic who notices cargo that should not need climate control',
              backstory: 'He services loading cranes along the river docks and saw the suspicious trunk leave under guard.',
              knowledge: [
                'Sorin Dobre supervised the loading of a humidity-controlled trunk',
                'The shipment manifest described the contents as liturgical textiles',
                'Father Matteo Orsini argued with the dock foreman but never touched the cargo',
              ],
              voiceDescription: '40s Georgian man, rough voice, practical, speaks with clipped certainty',
            },
          ],
        },
        {
          name: 'Cartagena',
          country: 'Colombia',
          lat: 10.391,
          lng: -75.4794,
          witnesses: [
            {
              name: 'Camila Restrepo',
              personality: 'Sharp provenance researcher with quiet underworld access',
              backstory: 'She consults for private museums and often verifies objects that should never reach public catalogues.',
              knowledge: [
                'A buyer wanted the ledger pages authenticated against Saint Irina Holdings, a shell trust controlled by Sorin Dobre\'s Romanian circle',
                'The payment trail resolved through that same Romanian banking circle rather than any account tied to Celeste Moreau',
                'Celeste Moreau had only been used as the visible intermediary in prior deals',
              ],
              voiceDescription: '30s Colombian woman, low confident tone, meticulous and cool',
            },
            {
              name: 'Tomas Ibarra',
              personality: 'Harbor pilot informant who monetizes every rumor',
              backstory: 'He guides vessels into Cartagena Bay and sells tips about suspicious cargo movements after hours.',
              knowledge: [
                'Sorin Dobre\'s crew switched the ledger case onto a yacht called Saint Irina outside the harbor mouth',
                'The false manifest named Father Matteo Orsini to distract customs',
                'Saint Irina Holdings kept a private vault registry in Valletta for buyers who demanded proof before release',
                'The humidity case remained sealed until Dobre himself boarded the yacht',
              ],
              voiceDescription: '40s Colombian man, quick and sly, warm coastal accent',
            },
          ],
        },
        {
          name: 'Athens',
          country: 'Greece',
          lat: 37.9838,
          lng: 23.7275,
          witnesses: [
            {
              name: 'Dora Pappas',
              personality: 'Bonded art registrar who notices when a storage story is built only to be repeated',
              backstory: 'She manages high-value intake near Piraeus and logged the phantom booking that made Athens look relevant without ever receiving the ledger case.',
              knowledge: [
                'Celeste Moreau\'s name was used to reserve Piraeus bonded storage for a reliquary ledger case',
                'No humidity-controlled trunk ever entered the facility despite the urgent paperwork',
                'The Athens booking existed just long enough to travel through customs chatter before disappearing',
              ],
              voiceDescription: '40s Greek woman, brisk registrar tone, skeptical and exact',
            },
            {
              name: 'Leon Vassilis',
              personality: 'Restoration runner who can spot a copied manifest at a glance',
              backstory: 'He ferries documents and sealed parcels between workshops and bonded depots and immediately recognized the Athens paperwork as theater.',
              knowledge: [
                'A copied manifest naming Father Matteo Orsini passed through Athens without the real Georgian seal ever appearing',
                'The people behind the decoy only wanted Greece on the file, not the cargo on the dock',
                'One courier muttered that the real buyer registry sat in Valletta, not Piraeus',
              ],
              voiceDescription: '30s Greek man, quick practical cadence, alert and lightly cynical',
            },
          ],
        },
        {
          name: 'Valletta',
          country: 'Malta',
          lat: 35.8989,
          lng: 14.5146,
          witnesses: [
            {
              name: 'Don Carmelino Camilleri',
              personality: 'Private vault keeper who remembers every patron who wants holiness laundered into wealth',
              backstory: 'He oversees discreet sealed storage in Valletta and keeps mental records of clients who treat sacred pieces like offshore inventory.',
              knowledge: [
                'Saint Irina Holdings registered sealed storage in Valletta under Sorin Dobre\'s Romanian banking circle',
                'A yacht from Cartagena delivered a humidity case for private vault inspection',
                'Sorin Dobre approved the buyer access windows himself',
              ],
              voiceDescription: '70s Maltese man, low ceremonial voice, patient and sharp',
            },
            {
              name: 'Father Victor Agius',
              personality: 'Church antiquities liaison who hates watching sacred objects become collateral',
              backstory: 'He advises local collectors and freeport custodians on ecclesiastical provenance disputes and quietly tracks who is laundering devotion into private inventory.',
              knowledge: [
                'Celeste Moreau appeared in Valletta, but only as the visible dealer for a buyer Sorin Dobre controlled',
                'The sealed vault inventory matched reliquaries named in the stolen Vatican ledger',
                'Father Matteo Orsini\'s name never appeared on the Maltese ownership documents',
              ],
              voiceDescription: '50s Maltese man, reflective measured cadence, weary and exacting',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Sorin Dobre',
          description: 'Romanian smuggling financier who launders antiquities through religious shipping fronts and private yacht transfers.',
          isCorrect: true,
        },
        {
          name: 'Celeste Moreau',
          description: 'French dealer with a polished reputation who had already reserved a reliquary named in the missing ledger, making her look like the public buyer even when someone else controlled the money.',
          isCorrect: false,
        },
        {
          name: 'Father Matteo Orsini',
          description: 'Charismatic cleric with extensive museum contacts whose name would be useful in a forged manifest.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'A broken wax seal from the vault carried a Georgian shipping crest.',
          witnessName: 'Sister Lucia Ferretti',
          isMisleading: false,
          pointsToCity: 'Tbilisi',
          pointsToSuspect: null,
        },
        {
          content: 'A Piraeus bonded-art contact offered to float Athens as cover if the Georgian lane drew notice.',
          witnessName: 'Paolo Conti',
          isMisleading: true,
          pointsToCity: 'Athens',
          pointsToSuspect: null,
        },
        {
          content: 'Celeste Moreau had already reserved a reliquary named in the ledger and asked unusually focused questions about its ownership chain before the theft.',
          witnessName: 'Paolo Conti',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Celeste Moreau',
        },
        {
          content: 'The accountant ordered the ledger moved west from Tbilisi to Cartagena.',
          witnessName: 'Nino Arveladze',
          isMisleading: false,
          pointsToCity: 'Cartagena',
          pointsToSuspect: null,
        },
        {
          content: 'Sorin Dobre personally supervised the loading of the climate-controlled trunk in Tbilisi.',
          witnessName: 'Giorgi Dekanoidze',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sorin Dobre',
        },
        {
          content: 'Father Matteo Orsini argued at the docks, but the cargo never passed through his hands.',
          witnessName: 'Giorgi Dekanoidze',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'The authentication payment route led to Saint Irina Holdings, a shell trust controlled by Sorin Dobre\'s Romanian banking circle.',
          witnessName: 'Camila Restrepo',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sorin Dobre',
        },
        {
          content: 'The false manifest named Father Matteo Orsini specifically to draw customs away from the real buyer.',
          witnessName: 'Tomas Ibarra',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Father Matteo Orsini',
        },
        {
          content: 'Saint Irina Holdings kept a private vault registry in Valletta for buyers who demanded proof before release.',
          witnessName: 'Tomas Ibarra',
          isMisleading: false,
          pointsToCity: 'Valletta',
          pointsToSuspect: null,
        },
        {
          content: 'Celeste Moreau\'s name reserved Athens storage, but no ledger case or humidity trunk ever entered Piraeus.',
          witnessName: 'Dora Pappas',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Celeste Moreau',
        },
        {
          content: 'A copied manifest naming Father Matteo Orsini moved through Athens without the real Georgian seal, proving the Greek stop was route noise.',
          witnessName: 'Leon Vassilis',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Saint Irina Holdings registered sealed Valletta storage under Sorin Dobre\'s banking circle, and he personally approved the buyer windows.',
          witnessName: 'Don Carmelino Camilleri',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sorin Dobre',
        },
        {
          content: 'Celeste Moreau appeared in Valletta only as the visible dealer while Sorin Dobre controlled the real vault inventory and release documents.',
          witnessName: 'Father Victor Agius',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
      ],
    },
  },
  {
    id: 'seed-glass-atlas',
    slug: 'glass-atlas',
    title: 'The Glass Atlas',
    sortOrder: 4,
    difficulty: 3,
    minLevel: 2,
    data: {
      crime: {
        summary: 'A communications blackout at a Reykjavik summit hides the theft of an undersea-cable atlas with strategic value.',
        description: 'An engraved glass atlas mapping undersea cable maintenance routes disappeared during a coordinated communications blackout at a closed-door climate security summit in Reykjavik. The object is elegant, but the intelligence inside it is not: whoever holds it can identify repair windows, choke points, and the most vulnerable stretches of critical data infrastructure. Untangle staged summit confusion, separate prestige collectors from real operators, and close the route before the atlas is weaponized.',
        type: 'intelligence theft',
      },
      cities: [
        {
          name: 'Reykjavik',
          country: 'Iceland',
          lat: 64.1466,
          lng: -21.9426,
          witnesses: [
            {
              name: 'Edda Sigurdardottir',
              personality: 'Unflappable summit floor manager who tracks every badge movement',
              backstory: 'She coordinated the climate security summit and reconstructed the blackout minute by minute after the breach.',
              knowledge: [
                'The blackout began when backup routers were manually looped in the service corridor',
                'A delegate connected to Osaka requested private access to the secure map room',
                'An abandoned parka pocket held a ferry ticket stub to Dakar',
              ],
              voiceDescription: '40s Icelandic woman, cool and even, quietly incisive',
            },
            {
              name: 'Leif Hauksson',
              personality: 'Talkative telecom contractor with a sharp memory for anomalies',
              backstory: 'He was brought in to verify network redundancy and stayed long enough to see the theft corridor being cleared.',
              knowledge: [
                'The atlas was packed into a shockproof tube labeled weather lidar parts',
                'An old logistics credential issued during Omar Diop\'s Dakar port review pinged near the service lift moments before the blackout',
                'A Lisbon NATO liaison code appeared in the service-lift access audit right after the blackout',
                'A satellite phone near the lift dialed a number in Osaka seconds after the theft',
              ],
              voiceDescription: '30s Icelandic man, conversational, bright, slightly breathless',
            },
          ],
        },
        {
          name: 'Dakar',
          country: 'Senegal',
          lat: 14.7167,
          lng: -17.4677,
          witnesses: [
            {
              name: 'Marieme Faye',
              personality: 'Strict port security sergeant who trusts manifests only after checking the cargo herself',
              backstory: 'She oversees special handling cargo entering the Dakar research docks and flagged the suspicious tube immediately.',
              knowledge: [
                'The same shockproof tube arrived on a research vessel two nights later',
                'The courier skipped customs and transferred the tube to a private hangar',
                'The hangar payment was signed by Aurora Current LLC',
              ],
              voiceDescription: '40s Senegalese woman, firm, resonant, disciplined pacing',
            },
            {
              name: 'Ibrahima Sarr',
              personality: 'Independent charter pilot who notices who cancels at the last minute',
              backstory: 'He flies ad hoc cargo missions up and down the West African coast and remembers clients who pay in cash.',
              knowledge: [
                'Ingrid Solheim booked his plane with a sealed equipment pallet and canceled only after the tube bypassed the hangar entirely',
                'A replacement flight plan sent the cargo onward to Osaka',
                'A handler on the phone insisted that Morita gets the full atlas, not the copy',
              ],
              voiceDescription: '50s Senegalese man, warm, patient, confident storyteller',
            },
          ],
        },
        {
          name: 'Osaka',
          country: 'Japan',
          lat: 34.6937,
          lng: 135.5023,
          witnesses: [
            {
              name: 'Aiko Watanabe',
              personality: 'Disciplined infrastructure auditor who hates preventable risk',
              backstory: 'She was auditing cable vulnerability contracts when she recognized a familiar shell company in the atlas trail.',
              knowledge: [
                'Aurora Current LLC shares legal counsel with Takeshi Morita',
                'Morita recently bid on Arctic cable repair contracts that would benefit from the atlas',
                'A Tokyo bid room was prepped with the scanned atlas data before the Osaka shipyard finished digitizing the pages',
                'The glass pages were being digitized in an abandoned shipyard office owned through a dormant Morita cable-maintenance subsidiary',
              ],
              voiceDescription: '40s Japanese woman, precise, formal, quietly severe',
            },
            {
              name: 'Kenjiro Sato',
              personality: 'Night watchman with a nose for industrial trespass',
              backstory: 'He patrols the deserted shipyard district and saw the final handoff into the scanning room.',
              knowledge: [
                'Takeshi Morita arrived at the shipyard with an acid-etched storage crate',
                'Omar Diop never appeared in Osaka despite the rumors around his badge',
                'A spare atlas fragment was burned after the scans completed',
              ],
              voiceDescription: '60s Japanese man, low gravelly voice, restrained and observant',
            },
          ],
        },
        {
          name: 'Lisbon',
          country: 'Portugal',
          lat: 38.7223,
          lng: -9.1393,
          witnesses: [
            {
              name: 'Joao Vaz da Silva',
              personality: 'Retired signals officer who distrusts private contractors with strategic maps',
              backstory: 'He still reviews archival cable-routing requests for a Lisbon defense liaison office and noticed when classified maintenance windows were queried for commercial reasons.',
              knowledge: [
                'A Lisbon liaison request asked for cable-window records that matched the stolen atlas exactly',
                'The access trail brushed Ingrid Solheim\'s diplomatic network before moving to Morita-linked contractors',
                'The files were copied for private infrastructure bidders rather than public resilience planning',
              ],
              voiceDescription: '60s Portuguese man, measured military cadence, skeptical and precise',
            },
            {
              name: 'Filipe Carvalho',
              personality: 'Maritime archive coordinator who notices when official curiosity turns commercial',
              backstory: 'He runs a restricted cable archive near the Tagus and flagged the second wave of requests because they arrived with consulting credentials instead of government paperwork.',
              knowledge: [
                'Ingrid Solheim visited the archive and made the whole Lisbon angle look diplomatic',
                'A second clearance code tied to Takeshi Morita\'s consulting network reopened the same files within hours',
                'The copied archive packet pointed onward to Tokyo rather than back to Reykjavik',
              ],
              voiceDescription: '40s Portuguese man, calm archival tone, observant and dry',
            },
          ],
        },
        {
          name: 'Tokyo',
          country: 'Japan',
          lat: 35.6762,
          lng: 139.6503,
          witnesses: [
            {
              name: 'Keiko Matsuda',
              personality: 'Arctic infrastructure bid analyst who hunts impossible advantages',
              backstory: 'She reviews high-value repair proposals for telecom consortia and immediately recognized when Morita\'s Arctic forecasts became too accurate to be legal.',
              knowledge: [
                'Takeshi Morita used atlas-derived maintenance windows in three Arctic cable bids prepared in Tokyo',
                'Those bids predicted chokepoint outages only someone with the sealed atlas data could know',
                'Morita\'s office tied the atlas copies to Tokyo strategy sessions after the Osaka scans finished',
              ],
              voiceDescription: '30s Japanese woman, crisp analytical voice, cool under pressure',
            },
            {
              name: 'Sato Hashimoto',
              personality: 'Shipping logistics director who watches failed proxies reveal the real owner',
              backstory: 'He coordinates oversized maritime bids and saw who was present when Morita\'s network turned the atlas into Arctic contract leverage.',
              knowledge: [
                'Omar Diop\'s proxy bid was designed to fail while Morita\'s real Tokyo bid moved ahead',
                'Morita personally coordinated the survey schedules once the atlas copies reached Tokyo',
                'Every winning timeline in the room assumed access to the same stolen maintenance map',
              ],
              voiceDescription: '50s Japanese man, low businesslike tone, methodical and unsentimental',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Takeshi Morita',
          description: 'Maritime infrastructure executive with a dormant shipyard subsidiary and contract bids that would soar in value if he controlled the atlas\' repair-window intelligence.',
          isCorrect: true,
        },
        {
          name: 'Ingrid Solheim',
          description: 'Nordic climate envoy with access to summit logistics and a suspicious Dakar charter that made her look like she wanted leverage over cable disclosures.',
          isCorrect: false,
        },
        {
          name: 'Omar Diop',
          description: 'West African logistics broker who had previously consulted on summit freight routing, making his old credential and Dakar ties an unusually plausible setup.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'A ferry ticket stub to Dakar was found in the abandoned parka near the blackout corridor.',
          witnessName: 'Edda Sigurdardottir',
          isMisleading: false,
          pointsToCity: 'Dakar',
          pointsToSuspect: null,
        },
        {
          content: 'A Lisbon NATO liaison code appeared in the service-lift audit right after the blackout, suggesting the atlas might have gone west first.',
          witnessName: 'Leif Hauksson',
          isMisleading: true,
          pointsToCity: 'Lisbon',
          pointsToSuspect: null,
        },
        {
          content: 'A summit logistics credential issued to Omar Diop\'s earlier Dakar review pinged near the service lift just before the atlas vanished.',
          witnessName: 'Leif Hauksson',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Omar Diop',
        },
        {
          content: 'The replacement flight plan moved the tube from Dakar to Osaka, and the caller demanded that Morita receive the full atlas.',
          witnessName: 'Ibrahima Sarr',
          isMisleading: false,
          pointsToCity: 'Osaka',
          pointsToSuspect: 'Takeshi Morita',
        },
        {
          content: 'Aurora Current LLC shares legal counsel and a dormant shipyard subsidiary chain with Takeshi Morita.',
          witnessName: 'Aiko Watanabe',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Takeshi Morita',
        },
        {
          content: 'The Tokyo bid room was prepped with scanned atlas data before the Osaka shipyard finished digitizing the pages.',
          witnessName: 'Aiko Watanabe',
          isMisleading: false,
          pointsToCity: 'Tokyo',
          pointsToSuspect: null,
        },
        {
          content: 'Ingrid Solheim chartered a sealed evacuation flight in Dakar, but she canceled only after the tube bypassed the hangar and left her looking involved, not in control.',
          witnessName: 'Ibrahima Sarr',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Kenjiro Sato saw Takeshi Morita bring the acid-etched crate into the shipyard scanning room himself.',
          witnessName: 'Kenjiro Sato',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Takeshi Morita',
        },
        {
          content: 'Lisbon archive copies were redirected into Morita-linked contractor packets, while Ingrid Solheim\'s diplomatic visit only served as cover noise.',
          witnessName: 'Joao Vaz da Silva',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Ingrid Solheim',
        },
        {
          content: 'A second clearance tied to Takeshi Morita\'s consulting network reopened the Lisbon archive and pushed the packet onward to Tokyo.',
          witnessName: 'Filipe Carvalho',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Takeshi Morita used atlas-derived maintenance windows in three Tokyo Arctic bids that only advanced because he had the stolen map.',
          witnessName: 'Keiko Matsuda',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Takeshi Morita',
        },
        {
          content: 'Omar Diop\'s Tokyo proxy was a deliberate failure, while Morita coordinated the real survey schedules in person.',
          witnessName: 'Sato Hashimoto',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
      ],
    },
  },
  {
    id: 'seed-neon-embassy',
    slug: 'neon-embassy',
    title: 'The Neon Embassy',
    sortOrder: 5,
    difficulty: 1,
    minLevel: 1,
    data: {
      crime: {
        summary: 'A fire drill clears a Seoul annex just long enough for embassy cipher keys to vanish into a chain of diplomatic cargo decoys.',
        description: 'A luminous ceramic cylinder carrying rotating embassy cipher keys vanished from a Seoul diplomatic technology showcase after a staged fire drill emptied the annex. The theft looks theatrical on purpose: courier tags, maritime rumors, and alternate routes are seeded just convincingly enough to make the wrong suspect or wrong city feel decisive too early. Stay on the verified movement of the cylinder and find who turned diplomatic access into a private sale.',
        type: 'cipher theft',
      },
      cities: [
        {
          name: 'Seoul',
          country: 'South Korea',
          lat: 37.5665,
          lng: 126.978,
          witnesses: [
            {
              name: 'Han So-yeon',
              personality: 'Embassy protocol officer obsessed with timings and access rules',
              backstory: 'She coordinated guest movement through the annex and rebuilt the evacuation timeline by memory after the drill. The missing cylinder has put her clearance under review.',
              knowledge: [
                'The fire alarm was triggered from a staff corridor console, not the public foyer',
                'A courier pass stamped for Fukuoka was clipped to an empty garment bag near the annex exit',
                'Julian March left the annex before the drill carrying a private archive catalogue and returned only after the hall was clear',
              ],
              voiceDescription: '30s Korean woman, precise and composed, clipped official cadence',
            },
            {
              name: 'Tomas Vega',
              personality: 'Freelance AV contractor who jokes when he gets nervous',
              backstory: 'He was wiring the showcase stage and kept drifting through the service areas looking for spare power. He notices small prop swaps because stage work trained him to read cases and labels quickly.',
              knowledge: [
                'He saw the ceramic cylinder switched into a matte gray film canister during the evacuation',
                'Someone on a radio said Gate Blue is late, reroute through Bangkok',
                'A Helios Meridian driver kept asking when the Bangkok paperwork would clear',
              ],
              voiceDescription: '40s Spanish man, breezy delivery, anxious humor under the surface',
            },
          ],
        },
        {
          name: 'Fukuoka',
          country: 'Japan',
          lat: 33.5902,
          lng: 130.4017,
          witnesses: [
            {
              name: 'Emi Takahashi',
              personality: 'Bonded ferry dispatcher who distrusts glamorous cargo stories',
              backstory: 'She manages high-priority manifests moving through Hakata and remembers every diplomatic claim that arrives without the paperwork discipline to support it.',
              knowledge: [
                'No diplomatic canister matching the cipher cylinder ever cleared bonded intake in Fukuoka',
                'The courier pass number matched a canceled rehearsal shipment',
                'Only props and lighting reels ever used that code',
              ],
              voiceDescription: '30s Japanese woman, precise ferry-office tone, cool under pressure',
            },
            {
              name: 'Kenji Mori',
              personality: 'Customs warehouse supervisor who files ghost shipments with visible contempt',
              backstory: 'He audits sealed airside transfers and has learned that fake diplomatic urgency usually collapses under one direct question about the cargo weight.',
              knowledge: [
                'A false seal kit arrived from Seoul, but no embassy cargo followed it into port',
                'Someone wanted Fukuoka on the paperwork chain without touching the harbor',
                'He logged the whole thing as a ghost manifest',
              ],
              voiceDescription: '50s Japanese man, gravelly quiet voice, methodical and unimpressed',
            },
          ],
        },
        {
          name: 'Bangkok',
          country: 'Thailand',
          lat: 13.7563,
          lng: 100.5018,
          witnesses: [
            {
              name: 'Nisa Rattanakosin',
              personality: 'Sharp manifest clerk who trusts paperwork more than stories',
              backstory: 'She works bonded courier intake at the riverside freight terminal and remembers documents that have been altered twice. Her supervisor told her to ignore this shipment, which only made her memorize it better.',
              knowledge: [
                'The gray canister was re-tagged from Bangkok to Valletta under Helios Meridian Ltd',
                'The pouch was weighed twice because the handling instructions did not match the declared contents',
                'The diplomatic override template matched an emergency drill protocol once signed off by Arun Das before it was rushed through before dawn',
              ],
              voiceDescription: '30s Thai woman, calm and exact, dry professional tone',
            },
            {
              name: 'Arun Preecha',
              personality: 'River dock porter with a talent for overhearing rushed plans',
              backstory: 'He works night transfers between bonded trucks and private air strips. He pretends not to listen, which is why smugglers keep talking around him.',
              knowledge: [
                'River dock chatter said a fallback handoff might go through Singapore if Bangkok got hot',
                'The courier never let the pouch out of sight while it was in Bangkok',
                'Everyone spoke like Singapore was backup, not destination',
              ],
              voiceDescription: '20s Thai man, quick voice, alert and slightly amused',
            },
          ],
        },
        {
          name: 'Singapore',
          country: 'Singapore',
          lat: 1.3521,
          lng: 103.8198,
          witnesses: [
            {
              name: 'Priya Mehta',
              personality: 'Bonded storage supervisor who measures panic by how fast people misuse urgent labels',
              backstory: 'She oversees high-security storage turnover at Changi freight and knows when a client wants a route named in the system without ever paying to use it.',
              knowledge: [
                'No diplomatic cinema canister ever entered her cold room from Bangkok',
                'Only a flight alert arrived and was canceled before landing',
                'Someone wanted Singapore mentioned without paying a single storage fee',
              ],
              voiceDescription: '40s Singaporean woman, efficient clipped voice, analytical and unsentimental',
            },
            {
              name: 'Hassan Ong',
              personality: 'Charter coordinator who notices when alternate routes are theater',
              backstory: 'He files last-minute private flight revisions and has grown very good at spotting itineraries designed to leak rumors rather than move cargo.',
              knowledge: [
                'A private jet from Bangkok filed Singapore as alternate and continued onward without offloading anything',
                'A passenger asked whether the route name would still appear in customs chatter',
                'He took that as proof the stop was cover',
              ],
              voiceDescription: '30s Singaporean man, polished aviation tone, lightly sardonic',
            },
          ],
        },
        {
          name: 'Valletta',
          country: 'Malta',
          lat: 35.8989,
          lng: 14.5146,
          witnesses: [
            {
              name: 'Greta Camilleri',
              personality: 'Insurance analyst who quietly follows shell companies to their real owners',
              backstory: 'She reviews marine cargo policies for a Valletta underwriter and keeps her own shadow notes on suspicious logistics firms. Helios Meridian crossed her desk three times in one month.',
              knowledge: [
                'Helios Meridian rerouted the keys onward to a private archive berth in Dubrovnik booked by Laila Voss',
                'The broker in Valletta refused a partial delivery and demanded the full rotation schedule',
                'The payment guarantee came from Voss\'s holding company',
              ],
              voiceDescription: '40s Maltese woman, low steady voice, analytical and unsentimental',
            },
            {
              name: 'Noel Attard',
              personality: 'Bastion watchman who notices the people who do not belong',
              backstory: 'He works overnight security at a converted archive overlooking the harbor. He knows regular delivery crews by face and spots outsiders immediately.',
              knowledge: [
                'Underworld rumor said a Naples broker would receive the set if the Adriatic handoff failed',
                'He saw duplicate courier seals burned after the harbor exchange',
                'The real courier boat cleared east, not west',
              ],
              voiceDescription: '50s Maltese man, roughened voice, patient and observant',
            },
          ],
        },
        {
          name: 'Naples',
          country: 'Italy',
          lat: 40.8518,
          lng: 14.2681,
          witnesses: [
            {
              name: 'Giulia Serra',
              personality: 'Harbor warehouse clerk who can smell panic on a consignment note',
              backstory: 'She supervises bonded intake on the Naples waterfront and has seen enough fake urgency to know when a route rumor matters less than the missing cargo behind it.',
              knowledge: [
                'No cipher cylinder ever cleared her bonded floor',
                'A caller asked about temporary storage but never booked a slot',
                'The Naples story looked like emergency fallback gossip',
              ],
              voiceDescription: '40s Italian woman, fast harbor-office cadence, skeptical and practical',
            },
            {
              name: 'Matteo Greco',
              personality: 'Document runner who survives by noticing dead serials before police do',
              backstory: 'He ferries paperwork between brokers and port offices and knows when a stamped consignment note was printed only to be seen, not used.',
              knowledge: [
                'He carried a fake consignment note naming Naples, but the seal serial was dead',
                'The courier who hired him only wanted the rumor to spread',
                'Nobody at the port expected real cargo',
              ],
              voiceDescription: '20s Italian man, energetic streetwise delivery, always half-whispering',
            },
          ],
        },
        {
          name: 'Dubrovnik',
          country: 'Croatia',
          lat: 42.6507,
          lng: 18.0944,
          witnesses: [
            {
              name: 'Ana Kovacevic',
              personality: 'Archive conservator who catalogs high-value lies as carefully as artifacts',
              backstory: 'She maintains a fortified private archive outside Dubrovnik and knows which clients demand secrecy because they are protecting history and which are merely hiding money.',
              knowledge: [
                'Laila Voss booked a midnight viewing inside the archive vault',
                'The ceramic cylinder arrived with Helios Meridian paperwork and a diplomatic override',
                'The broker insisted no local inventory entry be created',
              ],
              voiceDescription: '40s Croatian woman, measured cultured voice, guarded and intelligent',
            },
            {
              name: 'Petar Milic',
              personality: 'Harbor launch captain who trusts tides more than rich clients',
              backstory: 'He runs discreet night transfers along the old harbor and remembers every passenger who thinks offshore darkness makes them invisible.',
              knowledge: [
                'He ferried Laila Voss from the old harbor with the cipher cylinder in a waterproof case',
                'She said the full key rotation would be sold once the embassy noticed the delay',
                'Julian March and Arun Das were never on his boat',
              ],
              voiceDescription: '50s Croatian man, weathered harbor voice, blunt and steady',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Laila Voss',
          description: 'Luxury logistics broker who launders diplomatic cargo through boutique maritime firms and private archives.',
          isCorrect: true,
        },
        {
          name: 'Julian March',
          description: 'Cultural attaché with access to the Seoul annex, private archive contacts, and just enough off-timeline movement to look like the man steering the handoff.',
          isCorrect: false,
        },
        {
          name: 'Arun Das',
          description: 'Security consultant who drafted annex drill contingencies and once subcontracted with Helios Meridian, making his paperwork shadow look more dangerous than his actual reach.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'The fire alarm was triggered from a staff corridor console, not the public foyer.',
          witnessName: 'Han So-yeon',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A courier pass stamped for Fukuoka was clipped to an empty garment bag at the annex exit.',
          witnessName: 'Han So-yeon',
          isMisleading: true,
          pointsToCity: 'Fukuoka',
          pointsToSuspect: null,
        },
        {
          content: 'Julian March vanished before the fire drill and came back after the annex was empty.',
          witnessName: 'Han So-yeon',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Julian March',
        },
        {
          content: 'The radio order said Gate Blue was late and the canister should reroute through Bangkok.',
          witnessName: 'Tomas Vega',
          isMisleading: false,
          pointsToCity: 'Bangkok',
          pointsToSuspect: null,
        },
        {
          content: 'No diplomatic canister matching the cipher cylinder ever cleared bonded intake in Fukuoka.',
          witnessName: 'Emi Takahashi',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A false seal kit arrived from Seoul, but no embassy cargo followed it into port.',
          witnessName: 'Kenji Mori',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'The gray canister was re-tagged from Bangkok to Valletta under Helios Meridian using a diplomatic override copied from an old Arun Das drill template.',
          witnessName: 'Nisa Rattanakosin',
          isMisleading: true,
          pointsToCity: 'Valletta',
          pointsToSuspect: 'Arun Das',
        },
        {
          content: 'River dock chatter said a fallback handoff might go through Singapore if Bangkok got hot.',
          witnessName: 'Arun Preecha',
          isMisleading: true,
          pointsToCity: 'Singapore',
          pointsToSuspect: null,
        },
        {
          content: 'No diplomatic cinema canister ever entered Singapore storage from Bangkok.',
          witnessName: 'Priya Mehta',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A charter from Bangkok filed Singapore as alternate and continued onward without offloading anything.',
          witnessName: 'Hassan Ong',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Helios Meridian rerouted the keys onward to a private Dubrovnik archive berth booked by Laila Voss.',
          witnessName: 'Greta Camilleri',
          isMisleading: false,
          pointsToCity: 'Dubrovnik',
          pointsToSuspect: null,
        },
        {
          content: 'Underworld rumor said a Naples broker would receive the set if the Adriatic handoff failed.',
          witnessName: 'Noel Attard',
          isMisleading: true,
          pointsToCity: 'Naples',
          pointsToSuspect: null,
        },
        {
          content: 'No cipher cylinder ever cleared the Naples bonded floor.',
          witnessName: 'Giulia Serra',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'A fake consignment note naming Naples was printed only to spread the rumor.',
          witnessName: 'Matteo Greco',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Laila Voss booked a midnight viewing in Dubrovnik and ordered the archive to skip local inventory.',
          witnessName: 'Ana Kovacevic',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Laila Voss',
        },
        {
          content: 'Petar Milic ferried Laila Voss with the cipher cylinder in a waterproof case out of Dubrovnik harbor.',
          witnessName: 'Petar Milic',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Laila Voss',
        },
      ],
    },
  },
  {
    id: 'seed-midnight-ledger',
    slug: 'midnight-ledger',
    title: 'The Midnight Ledger',
    sortOrder: 6,
    difficulty: 3,
    minLevel: 3,
    data: {
      crime: {
        summary: 'A Dubai banking blackout masks the theft of an oil-payments ledger tied to shell firms, rerouted cargo, and sanctions evasion.',
        description: 'An encrypted ledger tracking off-book oil payments disappeared from a private banking audit in Dubai during a carefully timed power dip. On paper, it is just a book of accounts; in practice, it maps the shell guarantees, bonded transfers, and proxy signatories that keep sanctioned fuel money moving across borders. Follow the ledger through freight cover, forged signatures, and dry-dock digitization before the financial trail is scrubbed clean.',
        type: 'financial espionage',
      },
      cities: [
        {
          name: 'Dubai',
          country: 'United Arab Emirates',
          lat: 25.2048,
          lng: 55.2708,
          witnesses: [
            {
              name: 'Salma Al Nuaimi',
              personality: 'Compliance director who distrusts every unexplained interruption',
              backstory: 'She ran the audit room and now faces regulators because the ledger disappeared on her watch. She has reconstructed every badge swipe since the outage.',
              knowledge: [
                'The audit room lights were cut from a maintenance cabinet rather than the central panel',
                'The paper ledger left the room inside a velvet document sleeve',
                'An overnight courier booking to Tbilisi was created under emergency handling codes minutes later',
              ],
              voiceDescription: '40s Emirati woman, controlled and exact, quietly severe',
            },
            {
              name: 'Pavel Orlov',
              personality: 'Luxury hotel concierge who remembers the lies wealthy clients tell badly',
              backstory: 'He handles private banking guests and noticed which names were nervously checking departures after the blackout. He is polished, but he keeps score.',
              knowledge: [
                'Daria Volkova asked about the charter apron before the outage',
                'A customs fixer named Niko Tsereteli received the velvet sleeve from a courier in the lobby garage',
                'A charter broker floated Baku as the safe apron if Tbilisi went loud',
                'Someone on a secure call used the phrase midnight books travel north',
              ],
              voiceDescription: '50s Russian man, smooth hotel cadence, faintly mocking',
            },
          ],
        },
        {
          name: 'Tbilisi',
          country: 'Georgia',
          lat: 41.7151,
          lng: 44.8271,
          witnesses: [
            {
              name: 'Maka Tsiklauri',
              personality: 'Bonded warehouse manager who checks crates herself when clients act nervous',
              backstory: 'She supervises high-value transfers along the rail corridor and flagged the velvet sleeve shipment as misdeclared. People higher up told her to stop asking questions.',
              knowledge: [
                'The sleeve arrived hidden inside a turbine parts crate',
                'Niko Tsereteli collected his fee, took the courier sleeve, and passed the crate onward almost immediately',
                'The final manifest was re-tagged from Tbilisi to Riga before dawn',
              ],
              voiceDescription: '40s Georgian woman, firm voice, practical and suspicious',
            },
            {
              name: 'Levan Japaridze',
              personality: 'Night accountant who trusts numbers more than signatures',
              backstory: 'He clears bonded fees for a freight consortium and noticed the payment trail behind the rerouted crate. Forged documents irritate him on principle.',
              knowledge: [
                'Mikhail Arsenyev\'s shell firm guaranteed the bonded transfer',
                'Daria Volkova\'s signature on the ledger transfer was forged',
                'The clearing code used for the handoff referenced an Old Harbor Room in Riga, a dockside scanning suite leased through Mikhail\'s port network',
              ],
              voiceDescription: '30s Georgian man, dry voice, methodical and restrained',
            },
          ],
        },
        {
          name: 'Riga',
          country: 'Latvia',
          lat: 56.9496,
          lng: 24.1052,
          witnesses: [
            {
              name: 'Ilze Straume',
              personality: 'Financial crimes analyst who quietly hunts patterns across shell firms',
              backstory: 'She was already mapping suspicious oil commissions when the Dubai ledger surfaced in her case notes. The names on it fit a pattern she has tracked for months.',
              knowledge: [
                'The first commission trace brushed a Daria Volkova account before resolving into Mikhail Arsenyev\'s shell firm',
                'The ledger pages were being digitized near the Riga dry docks',
                'The clearing code in the Old Harbor Room resolved to an Istanbul conversion vault on Mikhail\'s network',
                'A false rumor trail naming Daria Volkova was seeded to distract auditors',
              ],
              voiceDescription: '40s Latvian woman, calm low register, analytical and cool',
            },
            {
              name: 'Edgars Ozols',
              personality: 'Dock electrician who notices which rooms stay lit after midnight',
              backstory: 'He works maintenance in the dry dock district and saw the final transfer enter a shuttered scanning room. He knows which visitors are local and which ones are bluffing.',
              knowledge: [
                'He saw Mikhail Arsenyev inspect the scanning room personally',
                'Niko Tsereteli never entered the final site despite being blamed for the ledger theft',
                'Spare ledger pages were shredded after the scans completed',
              ],
              voiceDescription: '50s Latvian man, gravelly voice, blunt and clear-eyed',
            },
          ],
        },
        {
          name: 'Baku',
          country: 'Azerbaijan',
          lat: 40.4093,
          lng: 49.8671,
          witnesses: [
            {
              name: 'Leyla Mammadova',
              personality: 'Pipeline compliance auditor who notices when oil paperwork is written only to be seen',
              backstory: 'She reviews emergency export holds around the Caspian and flagged the Baku booking because it arrived with urgency but no physical cargo trail.',
              knowledge: [
                'A Baku hold slot was reserved under Daria Volkova\'s orbit, but no ledger or turbine crate ever reached the apron',
                'The whole Baku story existed to make the Caspian route look live while the real transfer kept moving north',
                'The conversion codes in the false packet pointed toward Istanbul rather than any Caspian tanker schedule',
              ],
              voiceDescription: '40s Azerbaijani woman, dry compliance tone, sharp and unsentimental',
            },
            {
              name: 'Rashad Karimov',
              personality: 'Tanker manifest broker who can tell a fake fuel route from the handwriting alone',
              backstory: 'He prepares off-hours manifest corrections and immediately recognized the Baku sheets as theater written for auditors, not operators.',
              knowledge: [
                'The Baku routing sheets pinned Niko Tsereteli to a transfer he never physically controlled',
                'The real settlement code was tagged for an Istanbul currency conversion vault',
                'The Caspian paperwork only existed to keep Daria and Niko in the spotlight',
              ],
              voiceDescription: '50s Azerbaijani man, low rough voice, practical and skeptical',
            },
          ],
        },
        {
          name: 'Istanbul',
          country: 'Turkey',
          lat: 41.0082,
          lng: 28.9784,
          witnesses: [
            {
              name: 'Eren Ozdemir',
              personality: 'Customs broker who follows shell-bank patterns through every port excuse',
              backstory: 'He tracks sanctioned freight clearances through Istanbul and recognized the ledger conversion network from prior oil-shadow transactions.',
              knowledge: [
                'The final sanctioned-fuel payments arrived in Istanbul through shell accounts controlled by Mikhail Arsenyev',
                'Those funds were converted immediately into cryptocurrency and commodity cover purchases',
                'Every Istanbul settlement document used the same code family that left Riga\'s Old Harbor Room',
              ],
              voiceDescription: '50s Turkish man, careful broker cadence, observant and unsparing',
            },
            {
              name: 'Fatih Kaya',
              personality: 'Port authority supervisor who remembers who signs after the room clears',
              backstory: 'He supervises private secure transfers along the Bosphorus and watched the final ledger verification leave only one real name standing.',
              knowledge: [
                'Daria Volkova appeared at one Istanbul handoff, but only as a visible intermediary',
                'Mikhail Arsenyev signed the final conversion approval before the ledger scraps were burned',
                'Niko Tsereteli never touched the Istanbul payment room despite being named in the rumor trail',
              ],
              voiceDescription: '60s Turkish man, patient harbor voice, blunt and exact',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Mikhail Arsenyev',
          description: 'Shipping financier who launders sanctioned fuel payments through shell guarantees and controlled dockside scans.',
          isCorrect: true,
        },
        {
          name: 'Daria Volkova',
          description: 'Broker seen around charter aprons and private banking clients whose accounts sit close enough to Mikhail\'s network to make planted suspicion feel credible.',
          isCorrect: false,
        },
        {
          name: 'Niko Tsereteli',
          description: 'Customs fixer in Tbilisi with a history of reselling dirty routes, making him look central until the money keeps moving past him.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'An emergency courier booking to Tbilisi appeared minutes after the Dubai audit room power dip.',
          witnessName: 'Salma Al Nuaimi',
          isMisleading: false,
          pointsToCity: 'Tbilisi',
          pointsToSuspect: null,
        },
        {
          content: 'A charter broker floated Baku as the safe apron if Tbilisi went loud.',
          witnessName: 'Pavel Orlov',
          isMisleading: true,
          pointsToCity: 'Baku',
          pointsToSuspect: null,
        },
        {
          content: 'Daria Volkova was asking about the charter apron before the outage, making her look like the obvious broker.',
          witnessName: 'Pavel Orlov',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Daria Volkova',
        },
        {
          content: 'The velvet sleeve left Tbilisi inside a turbine crate that was re-tagged for Riga overnight.',
          witnessName: 'Maka Tsiklauri',
          isMisleading: false,
          pointsToCity: 'Riga',
          pointsToSuspect: null,
        },
        {
          content: 'Mikhail Arsenyev\'s shell firm guaranteed the bonded transfer, and the clearing code pointed to an Old Harbor Room scanning suite on his Riga dock network.',
          witnessName: 'Levan Japaridze',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Mikhail Arsenyev',
        },
        {
          content: 'The first Riga commission trace brushed Daria Volkova before resolving into Mikhail Arsenyev\'s shell firm, while the rumor trail kept Daria in the spotlight.',
          witnessName: 'Ilze Straume',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Mikhail Arsenyev',
        },
        {
          content: 'The Old Harbor Room clearing code resolved to an Istanbul conversion vault on Mikhail Arsenyev\'s network.',
          witnessName: 'Ilze Straume',
          isMisleading: false,
          pointsToCity: 'Istanbul',
          pointsToSuspect: null,
        },
        {
          content: 'Edgars Ozols watched Mikhail Arsenyev inspect the scanning room himself after the spare pages were shredded.',
          witnessName: 'Edgars Ozols',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Mikhail Arsenyev',
        },
        {
          content: 'The Baku hold slot reserved under Daria Volkova\'s orbit never received the ledger, proving the Caspian route was mostly theater.',
          witnessName: 'Leyla Mammadova',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Daria Volkova',
        },
        {
          content: 'The Baku paperwork pinned Niko Tsereteli to a transfer he never physically controlled while the real settlement code pointed to Istanbul.',
          witnessName: 'Rashad Karimov',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Niko Tsereteli',
        },
        {
          content: 'The final sanctioned-fuel payments arrived in Istanbul through shell accounts controlled by Mikhail Arsenyev and closed the route beyond Riga.',
          witnessName: 'Eren Ozdemir',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Mikhail Arsenyev',
        },
        {
          content: 'Daria Volkova was only a visible intermediary in Istanbul while Mikhail Arsenyev signed the final conversion approval himself.',
          witnessName: 'Fatih Kaya',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
      ],
    },
  },
  {
    id: 'seed-polar-current',
    slug: 'polar-current',
    title: 'Polar Current',
    sortOrder: 7,
    difficulty: 4,
    minLevel: 4,
    data: {
      crime: {
        summary: 'A whiteout drill in Nuuk covers the theft of a polar control core and telemetry package tied to manipulated emergency contracts.',
        description: 'A sealed control core and ice-route telemetry package were stolen from a Nuuk polar robotics lab during a whiteout emergency drill that should never have opened a transfer window. The theft is wrapped in Arctic urgency: false salvage papers, rerouted research cargo, and contract beneficiaries already waiting to profit from the disruption. Sort real logistics from storm-noise misdirection before the stolen system is absorbed into a private supply chain.',
        type: 'sabotage',
      },
      cities: [
        {
          name: 'Nuuk',
          country: 'Greenland',
          lat: 64.1835,
          lng: -51.7216,
          witnesses: [
            {
              name: 'Ane Petersen',
              personality: 'Operations lead who treats emergency drills like sacred procedure',
              backstory: 'She commanded the Nuuk robotics lab through the storm alert and knows exactly which steps were falsified. The theft has frozen half her program.',
              knowledge: [
                'The whiteout drill was triggered from a weather kiosk outside the main control room',
                'A freight tag for Tromso was found inside a discarded thermal glove',
                'Jonas Brevik was furious because the lab blacklisted him after a safety inquiry, but he was physically locked outside during the transfer window',
              ],
              voiceDescription: '40s Greenlandic woman, controlled voice, disciplined and unsparing',
            },
            {
              name: 'Malik Jensen',
              personality: 'Fuel tech who pays attention when labels do not match the handling gear',
              backstory: 'He loads Arctic survey flights and spotted the control core being disguised as routine field equipment. He notices cargo lies faster than he notices faces.',
              knowledge: [
                'The core crate was relabeled as survey batteries',
                'Someone on the phone said polar current reaches Halifax after Tromso',
                'The Aurora Straits patch on the courier jacket matched a Murmansk depot contract used for Arctic survey gear',
                'The courier wore an Aurora Straits patch never used by the lab',
              ],
              voiceDescription: '30s Danish-Greenlandic man, quick voice, alert and skeptical',
            },
          ],
        },
        {
          name: 'Tromso',
          country: 'Norway',
          lat: 69.6492,
          lng: 18.9553,
          witnesses: [
            {
              name: 'Signe Dahl',
              personality: 'Harbor controller who documents every exceptional movement twice',
              backstory: 'She cleared emergency cargo through Tromso harbor and immediately distrusted the salvage exemptions tied to this crate. Her notes are meticulous enough to survive lawyers.',
              knowledge: [
                'The survey battery crate boarded a research trawler heading for Halifax',
                'Petra Volkov filed the false salvage papers used in Tromso and listed her consultancy as emergency claims beneficiary',
                'Sanna Kade approved the emergency release from an offshore call',
              ],
              voiceDescription: '40s Norwegian woman, crisp diction, calm under pressure',
            },
            {
              name: 'Yusuf Demir',
              personality: 'Cold-weather mechanic who hears too much when crews panic',
              backstory: 'He serviced the trawler winches and kept hearing conflicting explanations for the same crate. He trusts machine logs more than people.',
              knowledge: [
                'Jonas Brevik missed the sailing window and never boarded in Tromso',
                'Sanna Kade ordered a secondary checksum removed before departure',
                'The Halifax contact demanded the live core, not a shell unit',
              ],
              voiceDescription: '30s Turkish-Norwegian man, grounded tone, blunt and practical',
            },
          ],
        },
        {
          name: 'Halifax',
          country: 'Canada',
          lat: 44.6488,
          lng: -63.5752,
          witnesses: [
            {
              name: 'Claire Donovan',
              personality: 'Procurement auditor who quietly follows who profits from emergency contracts',
              backstory: 'She audits polar research procurement and recognized the Aurora Straits paperwork immediately. The stolen telemetry package fits a contract reshuffle she has been tracking.',
              knowledge: [
                'Aurora Straits is linked to Sanna Kade through proxy directors',
                'The emergency release created profit on rerouted Arctic repair contracts across three disabled beacon corridors',
                'The deployment notes referenced a Longyearbyen survey upgrade rather than a Halifax research need',
                'Petra Volkov\'s name was used on a decoy invoice to draw suspicion away from the real buyer',
              ],
              voiceDescription: '40s Canadian woman, steady voice, thoughtful and incisive',
            },
            {
              name: 'Noah Mercer',
              personality: 'Night guard who notices when expensive equipment moves at the wrong hour',
              backstory: 'He patrols a private shipyard lab in Halifax and saw the final crate opened after midnight. He does not like people who assume guards do not pay attention.',
              knowledge: [
                'Sanna Kade personally opened the control core case in the Halifax lab',
                'Jonas Brevik never reached Halifax despite the rumors around his name',
                'A dummy telemetry board was dumped in the harbor after the transfer',
              ],
              voiceDescription: '50s Canadian man, deep patient voice, observant and dry',
            },
          ],
        },
        {
          name: 'Murmansk',
          country: 'Russia',
          lat: 68.9585,
          lng: 33.0827,
          witnesses: [
            {
              name: 'Alexei Sokolov',
              personality: 'Arctic logistics director who notices when private cargo borrows military timing',
              backstory: 'He manages cold-route staging outside Murmansk and knew immediately that the control core was moving under exceptional cover.',
              knowledge: [
                'The control core was staged in Murmansk under Sanna Kade\'s authorization before the public Halifax rumor matured',
                'A Russian Arctic logistics window was opened for the same crate less than a day after Nuuk',
                'The final movement order named Longyearbyen, not Halifax, as the installation target',
              ],
              voiceDescription: '50s Russian man, restrained Arctic cadence, precise and guarded',
            },
            {
              name: 'Vera Petrov',
              personality: 'Port security chief who trusts physical custody more than dramatic blame',
              backstory: 'She oversees restricted access around Murmansk staging sheds and watched the operation manufacture a culprit before it moved the real system north again.',
              knowledge: [
                'Jonas Brevik\'s credentials were imitated to make him look present in Murmansk when he never reached the depot',
                'Russian Arctic Command personnel took possession only after Sanna Kade signed the release',
                'Petra Volkov handled paperwork, but Sanna controlled the actual staging decisions',
              ],
              voiceDescription: '40s Russian woman, cool official tone, exact and unsentimental',
            },
          ],
        },
        {
          name: 'Longyearbyen',
          country: 'Norway',
          lat: 78.2232,
          lng: 15.6469,
          witnesses: [
            {
              name: 'Kristin Sorensen',
              personality: 'Research-station manager who notices when upgrades solve the wrong problem',
              backstory: 'She runs an Arctic survey station outside Longyearbyen and realized the installed core was meant to manipulate territorial data, not improve safety.',
              knowledge: [
                'The stolen control core was installed into Arctic survey equipment in Longyearbyen',
                'The new outputs immediately distorted territorial and resource-boundary calculations in Sanna Kade\'s favor',
                'Both Halifax and Murmansk paperwork were folded into the same deployment package',
              ],
              voiceDescription: '40s Norwegian woman, steady polar cadence, practical and incisive',
            },
            {
              name: 'Ole Andersen',
              personality: 'Arctic security inspector who remembers the room after the engineers leave',
              backstory: 'He audits restricted installations across Svalbard and watched the handoff that turned a stolen core into an active geopolitical tool.',
              knowledge: [
                'Petra Volkov signed the visible salvage cover, but Sanna Kade was physically present for the final activation',
                'Once the core went live, the survey maps began contradicting every prior environmental baseline',
                'The installation team treated the device like a strategic asset, not research hardware',
              ],
              voiceDescription: '60s Norwegian man, weathered calm voice, observant and blunt',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Sanna Kade',
          description: 'Arctic logistics executive who profits when emergency routes are manipulated and disabled beacon corridors trigger premium repair contracts.',
          isCorrect: true,
        },
        {
          name: 'Jonas Brevik',
          description: 'Disgraced pilot whose career collapsed after the Nuuk lab blacklisted him, giving him a believable grudge even though he never controlled the shipment after the drill.',
          isCorrect: false,
        },
        {
          name: 'Petra Volkov',
          description: 'Salvage paperwork specialist whose signatures and emergency claims filings make her look like the buyer when she is really dressing the route for someone else.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'A Tromso freight tag was found inside the discarded thermal glove near the weather kiosk.',
          witnessName: 'Ane Petersen',
          isMisleading: false,
          pointsToCity: 'Tromso',
          pointsToSuspect: null,
        },
        {
          content: 'Jonas Brevik had a public outburst at the Nuuk lab just before the storm drill.',
          witnessName: 'Ane Petersen',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Jonas Brevik',
        },
        {
          content: 'The relabeled survey battery crate was routed from Nuuk through Tromso before someone on the phone linked it to Halifax.',
          witnessName: 'Malik Jensen',
          isMisleading: false,
          pointsToCity: 'Tromso',
          pointsToSuspect: null,
        },
        {
          content: 'The Aurora Straits patch on the courier jacket matched a Murmansk depot contract used for Arctic survey gear.',
          witnessName: 'Malik Jensen',
          isMisleading: false,
          pointsToCity: 'Murmansk',
          pointsToSuspect: null,
        },
        {
          content: 'Petra Volkov filed the false Tromso salvage papers and listed herself on the emergency claims side while Sanna Kade approved the release from offshore.',
          witnessName: 'Signe Dahl',
          isMisleading: true,
          pointsToCity: 'Halifax',
          pointsToSuspect: 'Petra Volkov',
        },
        {
          content: 'Jonas Brevik never boarded in Tromso, but the Halifax contact demanded the live core instead of a shell.',
          witnessName: 'Yusuf Demir',
          isMisleading: false,
          pointsToCity: 'Halifax',
          pointsToSuspect: null,
        },
        {
          content: 'Claire Donovan tied Aurora Straits and the emergency profit spike across three disabled beacon corridors directly to Sanna Kade.',
          witnessName: 'Claire Donovan',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sanna Kade',
        },
        {
          content: 'The deployment notes referenced a Longyearbyen survey upgrade rather than a Halifax research need.',
          witnessName: 'Claire Donovan',
          isMisleading: false,
          pointsToCity: 'Longyearbyen',
          pointsToSuspect: null,
        },
        {
          content: 'Noah Mercer watched Sanna Kade open the control core case in Halifax after the dummy board was dumped.',
          witnessName: 'Noah Mercer',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sanna Kade',
        },
        {
          content: 'The control core was staged in Murmansk under Sanna Kade\'s authorization before the public Halifax rumor matured.',
          witnessName: 'Alexei Sokolov',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sanna Kade',
        },
        {
          content: 'The final movement order named Longyearbyen as the installation target after Murmansk staging cleared.',
          witnessName: 'Alexei Sokolov',
          isMisleading: false,
          pointsToCity: 'Longyearbyen',
          pointsToSuspect: null,
        },
        {
          content: 'Jonas Brevik\'s credentials were only used as Murmansk staging theater while Sanna Kade controlled the real release.',
          witnessName: 'Vera Petrov',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Jonas Brevik',
        },
        {
          content: 'The stolen core was installed into Longyearbyen survey equipment, and the manipulated outputs immediately favored Sanna Kade\'s contract positions.',
          witnessName: 'Kristin Sorensen',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Sanna Kade',
        },
        {
          content: 'Petra Volkov signed the visible salvage cover, but Sanna Kade was physically present for the final Longyearbyen activation.',
          witnessName: 'Ole Andersen',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
      ],
    },
  },
  {
    id: 'seed-velvet-mirage',
    slug: 'velvet-mirage',
    title: 'Velvet Mirage',
    sortOrder: 8,
    difficulty: 5,
    minLevel: 5,
    data: {
      crime: {
        summary: 'A fashion convoy decoy carries a stolen nerve-agent antidote formula out of Marseille under luxury cover.',
        description: 'A prototype antidote formula for a military nerve agent vanished from a Marseille biotech summit after the real crate was swapped into a couture convoy decoy. The route blends glamour with bioweapons money: luxury export fronts, refrigerated medical cargo, and investors willing to bankroll black-clinic access if the science arrives intact. Track the formula before the trail turns into a private sale and the only workable treatment disappears.',
        type: 'biotech theft',
      },
      cities: [
        {
          name: 'Marseille',
          country: 'France',
          lat: 43.2965,
          lng: 5.3698,
          witnesses: [
            {
              name: 'Camille Roussel',
              personality: 'Summit logistics lead who notices when elegance is used to hide sloppiness',
              backstory: 'She coordinated secure movement between the lab pavilion and the waterfront gala hall. The theft embarrassed her enough that she memorized every deviation herself.',
              knowledge: [
                'The loading bay cameras went blind for six minutes just before the antidote formula vanished',
                'A couture garment case tagged for Casablanca replaced the reagent crate during the blind window',
                'Hector Lemaire argued with security loudly enough to pull eyes away from the real transfer',
              ],
              voiceDescription: '30s French woman, elegant voice, brisk and unsparing',
            },
            {
              name: 'Idriss Belloc',
              personality: 'Freelance convoy driver who keeps track of which clients overpay for silence',
              backstory: 'He drove the luxury convoy shell used for summit guests and heard far more than he was meant to. He knows when rich people are staging distractions.',
              knowledge: [
                'The convoy organizer said Varga wants the full serum tree, not only the antidote summary',
                'A false carnet for House Mistral Export covered the missing case',
                'The convoy accountant said Geneva would bless the formula pages before any long-haul buyer saw them',
                'The garment case left Marseille on a cargo ferry bound for Casablanca',
              ],
              voiceDescription: '40s Franco-Algerian man, low warm voice, alert and streetwise',
            },
          ],
        },
        {
          name: 'Casablanca',
          country: 'Morocco',
          lat: 33.5731,
          lng: -7.5898,
          witnesses: [
            {
              name: 'Yasmine El Fassi',
              personality: 'Bonded warehouse chemist who hates cargo that pretends to be harmless',
              backstory: 'She inspects temperature-sensitive freight at the airport annex and opened the garment case just long enough to know it was laboratory material. Her report disappeared the same night.',
              knowledge: [
                'The garment case contained lab notebooks, cold-storage vials, and enough dry ice to suggest a missing master ampoule she never got to see',
                'The export was refiled from Casablanca to Buenos Aires under refrigerated medical priority',
                'Youssef Bennani handled the customs stamp but not the final buyer paperwork',
              ],
              voiceDescription: '30s Moroccan woman, clear steady voice, clinical and direct',
            },
            {
              name: 'Omar Benkirane',
              personality: 'Ramp agent who remembers every client who asks for sterile cabin handling',
              backstory: 'He works special cargo at the Casablanca private terminal and knows which shipments are too sensitive for regular crews. The request around this case stood out immediately.',
              knowledge: [
                'Celia Varga paid for sterile cabin handling from Casablanca onward',
                'Hector Lemaire\'s passport details were copied onto the decoy manifest',
                'The phrase velvet mirage was repeated on a secure call before departure',
              ],
              voiceDescription: '40s Moroccan man, smooth voice, practical and wary',
            },
          ],
        },
        {
          name: 'Buenos Aires',
          country: 'Argentina',
          lat: -34.6037,
          lng: -58.3816,
          witnesses: [
            {
              name: 'Sofia Alvarez',
              personality: 'Pharma compliance lawyer who quietly tracks black-clinic acquisitions',
              backstory: 'She audits import records for experimental compounds and recognized House Mistral Export from prior shell investigations. The antidote formula fits a market she has been mapping for months.',
              knowledge: [
                'House Mistral Export fronts Celia Varga\'s acquisition network',
                'The antidote pages were being sold to a black-clinic consortium outside Buenos Aires serving embargoed security clients',
                'Celia Varga approved digitized formula packets for Hong Kong buyers before the final sale closed',
                'Youssef Bennani had no equity in the deal despite his name on the cargo trail',
              ],
              voiceDescription: '40s Argentine woman, measured legal cadence, sharp and skeptical',
            },
            {
              name: 'Esteban Quiroga',
              personality: 'Warehouse guard who notices when scientific cargo gets handled like contraband',
              backstory: 'He patrols a private cold-storage lab south of the city and watched the final handoff through mirrored glass. He remembers faces better than names.',
              knowledge: [
                'Celia Varga opened the garment case in the cold lab herself',
                'Hector Lemaire never arrived in Buenos Aires despite the accusations around him',
                'A Sao Paulo clinic consortium negotiated restricted treatment rights once the burners came out',
                'A draft formula set was burned in the lab incinerator after the sale terms were agreed',
              ],
              voiceDescription: '50s Argentine man, hushed gravelly voice, patient and observant',
            },
          ],
        },
        {
          name: 'Geneva',
          country: 'Switzerland',
          lat: 46.2044,
          lng: 6.1432,
          witnesses: [
            {
              name: 'Dr. Philippe Montand',
              personality: 'Private biotech authenticator who knows when a formula is being priced like a weapon',
              backstory: 'He verifies disputed biomedical intellectual property for discreet clients and immediately recognized the antidote pages as a functional military countermeasure.',
              knowledge: [
                'Celia Varga brought the formula pages to Geneva for authentication and market valuation',
                'He confirmed the formula was functional and worth tens of millions on the black market',
                'Varga approved digitization only after the valuation proved the monopoly was real',
              ],
              voiceDescription: '60s Swiss man, polished laboratory cadence, clinical and restrained',
            },
            {
              name: 'Margot Schmid',
              personality: 'Private vault manager who notices when forged authority tries to look respectable',
              backstory: 'She oversees restricted banking-vault access in Geneva and saw a failed access attempt that was meant to keep Hector Lemaire in the frame.',
              knowledge: [
                'Hector Lemaire\'s name was used on forged Geneva vault credentials that never cleared final review',
                'Celia Varga\'s holding company authorized the formula pages to be photographed for Asian buyers',
                'The transfer packet from Geneva pointed directly to Hong Kong brokerage contacts',
              ],
              voiceDescription: '50s Swiss woman, low banking tone, exact and unsentimental',
            },
          ],
        },
        {
          name: 'Hong Kong',
          country: 'Hong Kong',
          lat: 22.3193,
          lng: 114.1694,
          witnesses: [
            {
              name: 'Dr. Wei Chen',
              personality: 'Biotech broker who measures value by how many people are kept outside the room',
              backstory: 'He intermediates high-risk medical intellectual property for buyers who want exclusivity more than treatment capacity.',
              knowledge: [
                'Celia Varga offered the antidote formula to embargoed-regime buyers and private-clinic networks across Asia',
                'Her pricing model assumed the formula would stay scarce enough to function as monopoly medicine',
                'The Hong Kong packet turned public-health science into a private access auction',
              ],
              voiceDescription: '50s Hong Kong man, smooth deliberate tone, analytical and cold',
            },
            {
              name: 'Lau Ming',
              personality: 'Underground medical logistics fixer who knows which middlemen get cut out',
              backstory: 'He arranges discreet chain-of-custody for private clinics and immediately understood that Youssef Bennani was being left in the paperwork but removed from the money.',
              knowledge: [
                'Youssef Bennani tried to negotiate a side deal, but Celia Varga cut him out of the final structure',
                'The real Hong Kong buyers were private clinics and sovereign security clients, not customs intermediaries',
                'One distribution track moved next toward a Sao Paulo clinic consortium with money to lock the antidote away',
              ],
              voiceDescription: '40s Hong Kong man, careful streetwise cadence, pragmatic and wary',
            },
          ],
        },
        {
          name: 'Sao Paulo',
          country: 'Brazil',
          lat: -23.5558,
          lng: -46.6396,
          witnesses: [
            {
              name: 'Dr. Lucia Ferreira',
              personality: 'Public-health epidemiologist who notices when medicine is being turned into class privilege',
              backstory: 'She tracks emergency treatment access in Sao Paulo and realized the stolen antidote was being diverted into elite private channels rather than any public system.',
              knowledge: [
                'A Sao Paulo black-clinic consortium acquired the antidote formula and immediately restricted access to paying elites',
                'Public hospitals could not source the treatment because private buyers had locked up the workable formula',
                'The consequences of Celia Varga\'s sale were visible in treatment access within days',
              ],
              voiceDescription: '50s Brazilian woman, firm thoughtful cadence, incisive and unsentimental',
            },
            {
              name: 'Raul Machado',
              personality: 'Clinic security director who remembers who actually approves the vault doors',
              backstory: 'He oversees restricted access at a luxury private clinic and watched the final authorization chain turn a stolen antidote into a private commodity.',
              knowledge: [
                'Hector Lemaire never appeared in Sao Paulo despite the old accusations around him',
                'Celia Varga personally approved the clinic vault access and payment schedule',
                'The formula was split across multiple private treatment vaults after the first clinic closed the sale',
              ],
              voiceDescription: '40s Brazilian man, low guarded voice, observant and direct',
            },
          ],
        },
      ],
      suspects: [
        {
          name: 'Celia Varga',
          description: 'Biotech broker who packages military research as luxury cargo and sells access through black-clinic investors.',
          isCorrect: true,
        },
        {
          name: 'Hector Lemaire',
          description: 'Marseille logistics consultant and convoy organizer whose public arguments and missing manifest made him look like the planner of the swap.',
          isCorrect: false,
        },
        {
          name: 'Youssef Bennani',
          description: 'Casablanca customs intermediary whose off-book stamp appears on the medical cargo trail, making him look complicit without giving him control of the sale.',
          isCorrect: false,
        },
      ],
      clues: [
        {
          content: 'A couture garment case tagged for Casablanca replaced the antidote crate during the Marseille camera blind window.',
          witnessName: 'Camille Roussel',
          isMisleading: false,
          pointsToCity: 'Casablanca',
          pointsToSuspect: null,
        },
        {
          content: 'Hector Lemaire argued with Marseille security right before the theft, and his official convoy manifest disappeared at the same time.',
          witnessName: 'Camille Roussel',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Hector Lemaire',
        },
        {
          content: 'The garment case traveled under House Mistral Export from Marseille to Casablanca.',
          witnessName: 'Idriss Belloc',
          isMisleading: false,
          pointsToCity: 'Casablanca',
          pointsToSuspect: null,
        },
        {
          content: 'The convoy accountant said Geneva would bless the formula pages before any long-haul buyer saw them.',
          witnessName: 'Idriss Belloc',
          isMisleading: false,
          pointsToCity: 'Geneva',
          pointsToSuspect: null,
        },
        {
          content: 'The cargo from Casablanca was refiled to Buenos Aires under refrigerated medical priority using a customs stamp Youssef Bennani pushed through off-book.',
          witnessName: 'Yasmine El Fassi',
          isMisleading: true,
          pointsToCity: 'Buenos Aires',
          pointsToSuspect: 'Youssef Bennani',
        },
        {
          content: 'Celia Varga paid for sterile cabin handling while Hector Lemaire\'s passport was copied onto the decoy manifest.',
          witnessName: 'Omar Benkirane',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Celia Varga',
        },
        {
          content: 'House Mistral Export fronts Celia Varga\'s network and the formula pages were offered to a black-clinic consortium in Buenos Aires.',
          witnessName: 'Sofia Alvarez',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Celia Varga',
        },
        {
          content: 'Celia Varga approved digitized formula packets for Hong Kong buyers before the final sale closed in Buenos Aires.',
          witnessName: 'Sofia Alvarez',
          isMisleading: false,
          pointsToCity: 'Hong Kong',
          pointsToSuspect: null,
        },
        {
          content: 'Esteban Quiroga watched Celia Varga open the garment case in the cold lab before the draft formula was burned.',
          witnessName: 'Esteban Quiroga',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Celia Varga',
        },
        {
          content: 'A Sao Paulo clinic consortium negotiated restricted treatment rights once the burners came out in Buenos Aires.',
          witnessName: 'Esteban Quiroga',
          isMisleading: false,
          pointsToCity: 'Sao Paulo',
          pointsToSuspect: null,
        },
        {
          content: 'Celia Varga brought the antidote pages to Geneva for authentication and approved digitization once the monopoly valuation was confirmed.',
          witnessName: 'Dr. Philippe Montand',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Celia Varga',
        },
        {
          content: 'Hector Lemaire\'s name was used on forged Geneva vault credentials, but the real transfer packet moved onward under Celia Varga\'s authority.',
          witnessName: 'Margot Schmid',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Hector Lemaire',
        },
        {
          content: 'Celia Varga offered the antidote to embargoed-regime buyers and private-clinic networks in Hong Kong as monopoly medicine, not public treatment.',
          witnessName: 'Dr. Wei Chen',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Celia Varga',
        },
        {
          content: 'Youssef Bennani was cut out of the real Hong Kong sale, while the next money track moved toward a Sao Paulo clinic consortium.',
          witnessName: 'Lau Ming',
          isMisleading: true,
          pointsToCity: null,
          pointsToSuspect: 'Youssef Bennani',
        },
        {
          content: 'A Sao Paulo black-clinic consortium acquired the antidote and immediately restricted access to paying elites, proving Celia Varga sold scarcity rather than treatment.',
          witnessName: 'Dr. Lucia Ferreira',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: null,
        },
        {
          content: 'Hector Lemaire never appeared in Sao Paulo, while Celia Varga personally approved the clinic vault access and payment schedule.',
          witnessName: 'Raul Machado',
          isMisleading: false,
          pointsToCity: null,
          pointsToSuspect: 'Celia Varga',
        },
      ],
    },
  },
];

function buildMissionOffer(row: SeedCaseRow): MissionOffer {
  const data = JSON.parse(row.raw_case_json) as GeneratedCaseData;
  const witnessCount = data.cities.reduce((sum, city) => sum + city.witnesses.length, 0);
  const countryCount = new Set(data.cities.map(city => city.country)).size;

  return {
    templateId: row.id,
    slug: row.slug,
    title: row.title,
    summary: getCrimeSummary(data),
    difficulty: row.difficulty,
    minLevel: row.min_level,
    cityCount: data.cities.length,
    witnessCount,
    suspectCount: data.suspects.length,
    countryCount,
  };
}

export function ensureSeedCasePool(): { inserted: number; total: number; remaining: number } {
  const insertTemplate = db.prepare(`
    INSERT INTO case_templates (id, slug, title, sort_order, difficulty, min_level, raw_case_json, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'seed')
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      sort_order = excluded.sort_order,
      difficulty = excluded.difficulty,
      min_level = excluded.min_level,
      raw_case_json = excluded.raw_case_json,
      source = 'seed'
  `);

  let inserted = 0;

  const transaction = db.transaction(() => {
    for (const template of SEED_CASE_TEMPLATES) {
      const result = insertTemplate.run(
        template.id,
        template.slug,
        template.title,
        template.sortOrder,
        template.difficulty,
        template.minLevel,
        JSON.stringify(template.data)
      );
      inserted += Number(result.changes);
    }
  });

  transaction();

  const total = (db.prepare(
    'SELECT COUNT(*) as count FROM case_templates WHERE source = ?'
  ).get('seed') as { count: number }).count;

  const remaining = (db.prepare(
    'SELECT COUNT(*) as count FROM case_templates WHERE source = ? AND consumed_at IS NULL'
  ).get('seed') as { count: number }).count;

  return { inserted, total, remaining };
}

export function claimSeedCase(): SeedCaseClaim | null {
  // Cyclical pool: always pick a seed case. Prefer never-used ones first,
  // otherwise rotate to the one consumed longest ago. This keeps /api/game/new
  // fast forever instead of falling back to the slower AI generation path after 4 games.
  const selectTemplate = db.prepare(`
    SELECT id, slug, title, difficulty, min_level, raw_case_json
    FROM case_templates
    WHERE source = 'seed'
    ORDER BY
      CASE WHEN consumed_at IS NULL THEN 0 ELSE 1 END ASC,
      consumed_at ASC,
      sort_order ASC,
      created_at ASC
    LIMIT 1
  `);

  const markConsumed = db.prepare(`
    UPDATE case_templates
    SET consumed_at = datetime('now')
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const row = selectTemplate.get() as SeedCaseRow | undefined;
    if (!row) return null;

    markConsumed.run(row.id);

    return {
      templateId: row.id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      minLevel: row.min_level,
      data: JSON.parse(row.raw_case_json) as GeneratedCaseData,
    } satisfies SeedCaseClaim;
  });

  return transaction();
}

export function releaseSeedCase(templateId: string): void {
  db.prepare('UPDATE case_templates SET consumed_at = NULL WHERE id = ?').run(templateId);
}

export function claimSeedCaseById(templateId: string, playerLevel: number): SeedCaseClaim | null {
  const selectTemplate = db.prepare(`
    SELECT id, slug, title, difficulty, min_level, raw_case_json
    FROM case_templates
    WHERE id = ? AND source = 'seed' AND min_level <= ?
  `);

  const markConsumed = db.prepare(`
    UPDATE case_templates
    SET consumed_at = datetime('now')
    WHERE id = ?
  `);

  const transaction = db.transaction(() => {
    const row = selectTemplate.get(templateId, playerLevel) as SeedCaseRow | undefined;
    if (!row) return null;

    markConsumed.run(row.id);

    return {
      templateId: row.id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      minLevel: row.min_level,
      data: JSON.parse(row.raw_case_json) as GeneratedCaseData,
    } satisfies SeedCaseClaim;
  });

  return transaction();
}

export function getSeedMissionOffers(playerLevel: number, limit: number): MissionOffer[] {
  const rows = db.prepare(`
    SELECT id, slug, title, difficulty, min_level, raw_case_json
    FROM case_templates
    WHERE source = 'seed' AND min_level <= ?
    ORDER BY
      CASE WHEN consumed_at IS NULL THEN 0 ELSE 1 END ASC,
      consumed_at ASC,
      difficulty ASC,
      sort_order ASC,
      created_at ASC
    LIMIT ?
  `).all(playerLevel, limit) as SeedCaseRow[];

  return rows.map(buildMissionOffer);
}

export function getHiddenSeedMissionCount(playerLevel: number): number {
  return (db.prepare(`
    SELECT COUNT(*) as count
    FROM case_templates
    WHERE source = 'seed' AND min_level > ?
  `).get(playerLevel) as { count: number }).count;
}

export function getSeedCaseTemplateById(templateId: string): SeedCaseClaim | null {
  const template = SEED_CASE_TEMPLATES.find(entry => entry.id === templateId);
  if (!template) return null;

  return {
    templateId: template.id,
    slug: template.slug,
    title: template.title,
    difficulty: template.difficulty,
    minLevel: template.minLevel,
    data: cloneCaseData(template.data),
  };
}

export function getFallbackCaseData(): GeneratedCaseData {
  return cloneCaseData(SEED_CASE_TEMPLATES[0]!.data);
}