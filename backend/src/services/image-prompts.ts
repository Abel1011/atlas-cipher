interface CuratedCityPromptSet {
  scenePrompt: string;
  panoramaPrompt: string;
}

export interface CityImagePromptInput {
  caseTemplateId?: string | null;
  cityName: string;
  country: string;
  caseSummary?: string | null;
  witnessBackstories?: string[];
  evidenceFacts?: string[];
}

const DEFAULT_CASE_SUMMARY = 'A global investigation moving through layered evidence and contested handoffs.';

const CURATED_CASE_CITY_PROMPTS: Record<string, Record<string, CuratedCityPromptSet>> = {
  'seed-star-of-carthage': {
    Istanbul: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Istanbul, Turkey.',
        'Show an instantly recognizable Sultanahmet skyline with the Blue Mosque, layered domes, historic rooftops, soft Bosphorus haze, and wet stone surfaces after recent rain.',
        'This must read as an iconic city-establishing image for Istanbul, with premium travel photography, grounded urban texture, believable light, and subtle everyday life.',
        'Do not stage a crime scene, do not show evidence, and do not frame the view as a museum service area.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Istanbul, Turkey.',
        'Camera placement: eye level inside the museum service entrance and loading zone where the gala blackout created the first blind spot.',
        'Show a believable real-world service yard beside a major museum just after rain, with coherent architecture, a natural horizon, and premium documentary realism.',
        'Include these visible clues as physical evidence in the environment: fresh wet shoe prints crossing from a staff-only door toward the curb; a disabled security camera hanging slightly off-angle above the side entrance; an empty velvet display tray insert left on a service trolley; a red evening scarf snagged on a brass queue barrier.',
        'Make the panorama useful to the player by letting the clues be readable at a glance without adding any written labels or interface graphics.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Athens: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Athens, Greece.',
        'Show the Acropolis rising above the city with layered Plaka rooftops, pale stone buildings, warm Mediterranean light, and a clear sense of Athens as an ancient city still alive with contemporary movement.',
        'This must read as an iconic city-establishing image for Athens, not as a private auction house or evidence scene.',
        'Premium travel photography, grounded detail, believable atmosphere, no overt investigation elements.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Athens, Greece.',
        'Camera placement: eye level inside an after-hours intake corridor between a private auction-house registrar desk and bonded lockers.',
        'Show a controlled, wealthy, real-world logistics space with documentary realism, believable architecture, grounded materials, and coherent panoramic wrap.',
        'Include these visible clues as physical evidence in the environment: blank provenance sheets spread across the registrar desk; a copied customs seal abandoned beside locker paperwork; an opened bonded locker containing only wrapping silk and no jewel case; a partially erased intake slate suggesting the piece never truly arrived.',
        'Make the panorama useful to the player by keeping the evidence visible and natural rather than theatrical.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Marrakech: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Marrakech, Morocco.',
        'Show an iconic rooftop view across the medina toward the Koutoubia minaret, with terracotta walls, market awnings, layered courtyards, desert light, and atmospheric urban density.',
        'This must read as an unmistakable city-establishing image for Marrakech, rich in place identity and travel-photography realism.',
        'Do not stage a jeweler crime scene or foreground evidence.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Marrakech, Morocco.',
        'Camera placement: eye level inside a jeweler courtyard off the medina where a copied clasp could be prepared without exposing the real necklace.',
        'Show a believable workshop courtyard with warm light, textured walls, practical tools, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a half-finished clasp casting still cooling on a jeweler workbench; fresh shipping labels stacked beside a tea glass; a sealed velvet case that stayed closed while buyers argued nearby; fine metal dust and jeweler tools suggesting a rushed duplicate job.',
        'Make the evidence readable without turning the scene into a collage or staged prop display.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Algiers: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Algiers, Algeria.',
        'Show the white hillside city descending toward the Mediterranean, with bright facades, layered terraces, harbor atmosphere, and a strong sense of Algiers as a coastal North African capital.',
        'This must read as an iconic city-establishing image for Algiers with premium travel-photography realism and no investigative staging.',
        'Do not depict the freeport evidence scene in the main city image.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Algiers, Algeria.',
        'Camera placement: eye level inside a freeport intake bay that was booked to misdirect the investigation without ever receiving the cargo.',
        'Show a believable maritime logistics space with dock lighting, customs equipment, industrial texture, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: a canceled manifest clipped to a rolling customs stand; a copied Vienna insurer seal attached to a crate sleeve; an empty loading space under bright dock lights where the reserved container should be; forklift tracks that stop abruptly with no real transfer taking place.',
        'Keep the scene grounded and readable rather than stylized or theatrical.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Vienna: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Vienna, Austria.',
        'Show an elegant Ringstrasse view with grand imperial facades, tram movement, polished stone streets, and the refined civic atmosphere that makes Vienna instantly recognizable.',
        'This must read as a premium city-establishing image for Vienna, rooted in architecture and atmosphere rather than investigation clues.',
        'Do not depict archive evidence, shell-company documents, or a crime-scene-like setup in the main image.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Vienna, Austria.',
        'Camera placement: eye level inside a private insurance archive room tied to shell-company paperwork and vault guarantees.',
        'Show a discreet high-end records room with polished surfaces, task lighting, legal folders, secure storage cues, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: an open policy folder showing a Geneva freeport guarantee on one page; a routing note with Prague circled as a deliberate decoy stop; fresh gloves and a vault-access badge left beside a polished evidence table; an incomplete beneficiary chain laid out for review under task lighting.',
        'Make the evidence legible but natural within the room.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Prague: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Prague, Czech Republic.',
        'Show the Charles Bridge and Prague Castle rising above the river with red rooftops, moody stone texture, and layered historic skyline that makes Prague instantly recognizable.',
        'This must read as an iconic city-establishing image for Prague with premium travel-photography realism.',
        'Do not turn the main image into a workshop clue scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Prague, Czech Republic.',
        'Camera placement: eye level inside a restoration studio where a convincing twin briefly stood in for the real necklace.',
        'Show a believable historic craft workshop with benches, tools, paper records, muted light, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: weighted glass stones beside a nearly finished Ottoman-style twin; forged provenance papers pinned under a metal ruler; a dropped courier satchel padded for a jewel transfer but now empty; fresh clasp tooling that looks new rather than historical.',
        'Let the space feel like a real working studio first, with the evidence naturally discoverable inside it.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Geneva: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Geneva, Switzerland.',
        'Show the lakefront with the Jet d Eau, clean quays, restrained luxury, mountain haze, and polished urban calm that makes Geneva instantly recognizable.',
        'This must read as an iconic city-establishing image for Geneva with premium travel-photography realism and no overt investigative evidence.',
        'Do not depict the private viewing room or handoff evidence in the main city image.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Geneva, Switzerland.',
        'Camera placement: eye level inside a sealed private viewing room in the Geneva freeport where the true handoff is closest to completion.',
        'Show a discreet high-value viewing space with controlled light, premium materials, secure access cues, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a custom foam insert shaped for an Ottoman necklace on the viewing table; a shell-company booking folder beside a banker leather case; secure transfer gloves placed near a closed side exit ready for movement; a slim jewel case set down just long enough for buyer confirmation.',
        'Make the evidence clear enough to inspect while keeping the room believable and elegant.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-sapphire-relay': {
    Singapore: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Singapore, Singapore.',
        'Show an instantly recognizable Marina Bay skyline at blue hour with the bayfront towers, Helix Bridge geometry, clean glass reflections, humid tropical air, and dense contemporary urban energy.',
        'This must read as a premium city-establishing image for Singapore rather than a convention back corridor or cargo dock.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Singapore, Singapore.',
        'Camera placement: eye level inside the Helix Defense Expo loading dock where catering carts stage beside AV equipment bays under exposed sprinkler pipes.',
        'Show a believable backstage logistics zone beneath a high-end defense expo, with wet concrete, service access lanes, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: portable jammer residue marks near loading bay six electrical panels; a silver equipment case with expo handling scuffs; a catering cart marked TNG-14 with a modified inner compartment; a dispatcher desk with a radio headset and handwritten Tangier freeport notes.',
        'Make the clues readable at a glance without adding any text overlays or interface graphics.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Tangier: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Tangier, Morocco.',
        'Show the white hillside medina above the Strait of Gibraltar with layered harbor roofs, Atlantic light, ferry traffic, fortified walls, and the threshold feeling of North Africa meeting Europe.',
        'This must read as an unmistakable city-establishing image for Tangier, focused on place identity rather than the crime logistics zone.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Tangier, Morocco.',
        'Camera placement: eye level inside the freeport gate-three interchange where couriers meet brokers beside cold-storage cargo before the Montreal reroute.',
        'Show a believable bonded port exchange with refrigerated crates, escort lanes, security booths, and windblown industrial detail.',
        'Include these visible clues as physical evidence in the environment: a bonded crate declared as marine sensors but marked for armed escort clearance; a courier handoff point beside a gate-three bollard where Karim Haddad met the runner; reroute paperwork from Tangier to Montreal cold storage filed under a diplomatic waiver; a broker clipboard showing cold-chain handling for cargo that is too small for the declared escort level.',
        'Keep the scene grounded and documentary rather than theatrical.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Montreal: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Montreal, Canada.',
        'Show the Old Port and downtown skyline in cold weather with steel-gray river light, heritage facades, modern towers, and a clear sense of Montreal as a North Atlantic logistics city.',
        'This must read as a premium city-establishing image for Montreal rather than a warehouse evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Montreal, Canada.',
        'Camera placement: eye level inside a temperature-controlled freight staging area where overnight dock clocks and security stills are reviewed after the rerouted crate arrives.',
        'Show a believable cold-storage logistics floor with synchronized dock timers, rolling cages, security monitors, and grounded warehouse realism.',
        'Include these visible clues as physical evidence in the environment: early security stills placing Adrian Vale near the crate route before the clocks were synchronized; a driver dispatch note using the phrase winter room is booked; dock clocks showing mismatched timestamps before manual sync; a cold-room transfer sheet tying the real shipment phrase to Elena Petrov rather than any decoy route.',
        'Make the panorama feel investigable without turning it into a collage of props.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Busan: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Busan, South Korea.',
        'Show the harbor skyline with the Gwangan Bridge, stacked port infrastructure, sea haze, dense high-rises, and the unmistakable energy of Busan as a maritime gateway city.',
        'This must read as an iconic city-establishing image for Busan, not as a cargo evidence bay or customs back room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Busan, South Korea.',
        'Camera placement: eye level inside a bonded cold-chain transit bay where a false relay pickup was staged without the real crate ever arriving.',
        'Show a believable refrigerated port facility with steel doors, pallet lanes, insulated equipment, dock lights, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: an empty marine-sensors shell on a cargo dolly; a cloned courier lanyard planted near the pickup lane; a canceled Northstar handling pre-alert on the dispatcher station; access notes showing the high-value transfer window closed before any crate entered the bay.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Stockholm: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Stockholm, Sweden.',
        'Show the archipelago capital with Gamla Stan facades, clean waterfront light, Nordic sky, elegant bridges, and the refined atmosphere that makes Stockholm instantly recognizable.',
        'This must read as an iconic city-establishing image for Stockholm, not as a defense vault or laboratory interior.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Stockholm, Sweden.',
        'Camera placement: eye level inside a shielded defense evaluation vault where the relay arrived for Nordic testing under Elena Petrov\'s authority.',
        'Show a believable secure integration space with Faraday transport hardware, clean glass partitions, access readers, equipment benches, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a sealed Faraday relay case on an evaluation stand; an Elena Petrov authorization packet beside the intake console; a rejection log showing Adrian Vale\'s cloned credential attempts; a Nordic buyer shell transfer sheet tied to the same Northstar payout rails seen in Montreal.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-ash-ledger': {
    Rome: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Rome, Italy.',
        'Show a grand view over Rome toward St Peter\'s dome with layered historic rooftops, warm stone, cypress silhouettes, and the dense architectural memory that makes the city instantly recognizable.',
        'This must read as an iconic city-establishing image for Rome, not as a vault corridor or direct crime scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Rome, Italy.',
        'Camera placement: eye level inside the Vatican annex restoration vault corridor at the west cloister and maintenance tunnel junction where the false fire alarm began.',
        'Show a believable sacred conservation environment with sealed humidity cases, heavy doors, old stone, modern vault hardware, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a broken wax seal fragment carrying a Georgian shipping crest; an abandoned humidity case with courier handling marks; a maintenance tunnel access gate with a recently disturbed lock; a vault reader showing signs that two access cards were cloned within seconds.',
        'Keep the scene solemn and believable rather than melodramatic.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Tbilisi: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Tbilisi, Georgia.',
        'Show the old town climbing toward Narikala Fortress with sulfur-bath domes, balconies over the river, warm evening light, and the layered texture that makes Tbilisi unmistakable.',
        'This must read as an iconic city-establishing image for Tbilisi, not a dockside transfer zone.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Tbilisi, Georgia.',
        'Camera placement: eye level inside a river dock loading area beneath a private wine cellar where the humidity-controlled trunk is staged before Black Sea transfer.',
        'Show a believable cargo handoff zone with cellar access, rolling pallets, guarded climate-control containers, and documentary-grade realism.',
        'Include these visible clues as physical evidence in the environment: a humidity-controlled trunk linked to the ledger loading; photographic setup traces showing the ledger was documented inside the cellar; Sorin Dobre\'s supervision station beside the dock ramp; an argument scene where Father Matteo Orsini drew attention but never touched the cargo.',
        'Let the evidence sit naturally inside a real logistics environment.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Cartagena: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Cartagena, Colombia.',
        'Show the walled old city meeting the Caribbean with colonial facades, ramparts, humid sunset light, and a harbor atmosphere that instantly identifies Cartagena.',
        'This must read as a premium city-establishing image for Cartagena, not a yacht transfer evidence scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Cartagena, Colombia.',
        'Camera placement: eye level at a private yacht harbor just outside the main port where the case is switched onto Saint Irina in open water transfer conditions.',
        'Show a believable high-end harbor exchange with launch ramps, guarded slips, humid night air, and maritime documentary realism.',
        'Include these visible clues as physical evidence in the environment: transfer marks linking the ledger case to a yacht named Saint Irina; a false manifest naming Father Matteo Orsini left out as distraction; broker paperwork pointing to Romanian banking authentication rather than the visible local accounts; a launch-side switching point beyond the normal harbor mouth.',
        'Keep the harbor elegant but clearly investigable.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Athens: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Athens, Greece.',
        'Show the Acropolis rising above the city with pale stone, layered rooftops, Mediterranean light, and the unmistakable historic-civic profile of Athens.',
        'This must read as an iconic city-establishing image for Athens, not a bonded art-storage decoy or paperwork trap.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Athens, Greece.',
        'Camera placement: eye level inside a Piraeus bonded art-storage intake room that was booked as cover without ever receiving the ledger case.',
        'Show a believable port-adjacent secure storage area with intake desks, rolling cages, customs folders, empty humidity slots, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a canceled storage booking under Celeste Moreau\'s name; an empty humidity-controlled intake berth; a copied manifest naming Father Matteo Orsini; a customs chatter log showing Athens was seeded as route noise rather than a real stop.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Valletta: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Valletta, Malta.',
        'Show the Grand Harbour fortifications, honey-colored limestone, bright Mediterranean water, and the compact historic geometry that makes Valletta instantly recognizable.',
        'This must read as an iconic city-establishing image for Valletta, not as a freeport vault evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Valletta, Malta.',
        'Camera placement: eye level inside a private sealed-storage vault where Saint Irina Holdings held sacred pieces tied to the stolen ledger.',
        'Show a believable high-security freeport chamber with climate-controlled cases, vault doors, discreet viewing tables, marine-stone architecture, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a humidity case from Cartagena on a private inspection stand; Saint Irina Holdings registry paperwork; Sorin Dobre\'s signed buyer-window approval forms; reliquary inventory matching entries from the Vatican ledger.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-glass-atlas': {
    Reykjavik: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Reykjavik, Iceland.',
        'Show Hallgrimskirkja rising over colorful roofs with a cold harbor sky, volcanic light, and crisp Nordic air that immediately identifies Reykjavik.',
        'This must read as an iconic city-establishing image for Reykjavik, not a summit service corridor or theft scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Reykjavik, Iceland.',
        'Camera placement: eye level inside the secure map-room service corridor where the blackout was triggered by manually looping the backup routers.',
        'Show a believable technical corridor with network cabinets, insulated walls, service lift access, and cold-climate summit infrastructure detail.',
        'Include these visible clues as physical evidence in the environment: manually looped backup router cables in a non-standard configuration; a satellite phone near the service lift that dialed Osaka seconds after the atlas vanished; an old logistics credential issued during Omar Diop\'s prior Dakar review left near the lift; a parka pocket holding a ferry ticket stub to Dakar.',
        'Make the clues readable but native to the space.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Dakar: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Dakar, Senegal.',
        'Show the Atlantic corniche and harbor approaches under hot coastal light with dense urban layers, sea spray, and a strong sense of Dakar as a West African port capital.',
        'This must read as a city-establishing image for Dakar, not a hidden hangar evidence scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Dakar, Senegal.',
        'Camera placement: eye level inside a private hangar beyond customs where the shockproof tube bypassed inspection before the Osaka handoff.',
        'Show a believable West African research-cargo hangar with forklifts, sealed tubes, heat haze, private aircraft access, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: a shockproof tube arriving from a research vessel two nights late; a courier transfer route that skips customs into the hangar; hangar payment records under Aurora Current LLC; a handling note indicating the buyer demanded Morita gets the full atlas.',
        'Keep the space grounded and industrial rather than cinematic.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Osaka: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Osaka, Japan.',
        'Show Osaka as a dynamic river city with dense commercial towers, bridge geometry, glowing night reflections, and unmistakable modern Kansai energy.',
        'This must read as an iconic city-establishing image for Osaka, not an abandoned shipyard evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Osaka, Japan.',
        'Camera placement: eye level inside an abandoned shipyard scanning room where the atlas pages were digitized under private supervision.',
        'Show a believable industrial interior with scanning rigs, rusted steel structure, temporary power, storage crates, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: an acid-etched storage crate brought in by Takeshi Morita; scanning tables with glass atlas pages under digitization; a burned spare atlas fragment in a disposal drum after scans completed; corporate paperwork tying Aurora Current LLC legal counsel to Morita\'s operation.',
        'Let the shipyard feel real first, with the evidence discovered inside it.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Lisbon: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Lisbon, Portugal.',
        'Show the Tagus waterfront with layered hills, terracotta roofs, old tram corridors, Atlantic light, and the unmistakable profile of Lisbon as a historic maritime capital.',
        'This must read as an iconic city-establishing image for Lisbon, not an archive or intelligence-room interior.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Lisbon, Portugal.',
        'Camera placement: eye level inside a restricted cable-routing archive room where copied atlas data was reviewed for private contractors.',
        'Show a believable secure archive with map drawers, classified routing boards, signal records, controlled lighting, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: scanned atlas pages on a review desk; a Morita-linked contractor packet clipped to a Lisbon liaison file; a second access log reopening the archive after Ingrid Solheim\'s visit; Arctic maintenance-window charts matching the stolen atlas coordinates.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Tokyo: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Tokyo, Japan.',
        'Show a dense contemporary Tokyo skyline with layered towers, transport lines, cool night reflections, and the unmistakable metropolitan intensity of the city.',
        'This must read as an iconic city-establishing image for Tokyo, not as a corporate bid room or planning office.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Tokyo, Japan.',
        'Camera placement: eye level inside Takeshi Morita\'s private infrastructure bid room where atlas data was turned into Arctic contract advantage.',
        'Show a believable high-end corporate planning office with wall maps, bid binders, scheduling screens, secure tablets, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: atlas-derived Arctic maintenance maps on the planning wall; Morita bid packets highlighting choke-point timing; a failed Omar Diop proxy proposal left on a side table; internal strategy notes proving Morita\'s Tokyo team used the stolen data after the Osaka scans.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-neon-embassy': {
    Seoul: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Seoul, South Korea.',
        'Show the Seoul skyline with Namsan Tower, layered glass towers, dense neighborhoods, neon reflections, and the fast modern energy that makes the city immediately identifiable.',
        'This must read as an iconic city-establishing image for Seoul, not an embassy service corridor or evacuation scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Seoul, South Korea.',
        'Camera placement: eye level inside the embassy annex service corridor where the fire alarm was triggered and the ceramic cylinder was swapped during evacuation.',
        'Show a believable back-of-house diplomatic corridor with alarm hardware, AV cases, garment bags, staff signage mounts without readable text, and grounded realism.',
        'Include these visible clues as physical evidence in the environment: a staff alarm console used instead of the public foyer trigger; a courier pass stamped for Fukuoka clipped to an empty garment bag; Julian March\'s archive catalogue left on a service desk; floor marks showing where a ceramic cylinder was switched into a matte gray canister during the three-minute evacuation window.',
        'Make the clues visible but natural to the corridor.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Fukuoka: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Fukuoka, Japan.',
        'Show Hakata Bay with ferries, sleek waterfront towers, clean terminal infrastructure, and humid evening light that makes Fukuoka instantly recognizable as a harbor city.',
        'This must read as a city-establishing image for Fukuoka, not a bonded intake evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Fukuoka, Japan.',
        'Camera placement: eye level inside the bonded intake office where dispatcher checks reveal the diplomatic cylinder never actually cleared the terminal.',
        'Show a believable ferry-terminal intake room with manifest shelves, bonded lockers, sealed counters, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: no diplomatic canister matching the cipher cylinder in the intake flow; a courier pass number matching a canceled rehearsal shipment; props and lighting reels using the same code that should have belonged to diplomatic cargo; dispatcher review materials showing the shipment existed only on paper.',
        'Keep the evidence quiet and procedural rather than theatrical.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Bangkok: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Bangkok, Thailand.',
        'Show the Chao Phraya riverfront with Wat Arun rising over the water, humid tropical light, layered traffic, and Bangkok\'s unmistakable mix of temple skyline and modern density.',
        'This must read as an iconic city-establishing image for Bangkok, not a courier intake evidence scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Bangkok, Thailand.',
        'Camera placement: eye level inside a bonded courier intake staging area where the gray canister was re-tagged from Bangkok to Valletta.',
        'Show a believable tropical freight handoff zone with bonded racks, handling cages, refrigerated pouches, and procedural logistics detail.',
        'Include these visible clues as physical evidence in the environment: a gray canister re-tagged from Bangkok to Valletta; a pouch weighed twice because handling instructions did not match declared contents; a diplomatic override template matching an emergency drill protocol once signed by Arun Das; staging paperwork that treats Bangkok as an operational decoy rather than the real destination.',
        'Make the clues legible without breaking realism.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Singapore: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Singapore, Singapore.',
        'Show a luminous Marina Bay skyline at dusk with waterfront reflections, clean high-rise geometry, tropical haze, and the controlled precision that makes Singapore instantly identifiable.',
        'This must read as a city-establishing image for Singapore, not a cargo decoy scene or cold room interior.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Singapore, Singapore.',
        'Camera placement: eye level inside a high-security cold room where diplomatic cinema canisters were supposedly staged but no real offload ever occurred.',
        'Show a believable bonded cold-storage facility with sealed racks, flight-handling carts, insulated doors, and precise logistics detail.',
        'Include these visible clues as physical evidence in the environment: no diplomatic cinema canister ever entering the cold room from Bangkok; a private jet routing notice naming Singapore as alternate before continuing onward without offloading; chatter notes asking whether the route name would still appear in customs records; handling space prepared for cargo that never physically arrived.',
        'Keep the space calm and procedural, with evidence embedded in the workflow.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Valletta: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Valletta, Malta.',
        'Show the Grand Harbour fortifications and honey-colored stone facing the sea, with bright Mediterranean light and the unmistakable geometry of Valletta\'s harbor city profile.',
        'This must read as an iconic city-establishing image for Valletta, not a reroute archive berth evidence scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Valletta, Malta.',
        'Camera placement: eye level inside a converted archive berth where Helios Meridian rerouted the keys before the Dubrovnik booking.',
        'Show a believable fortified harbor storage space with marine stone, insurance files, courier seals, and controlled low-light realism.',
        'Include these visible clues as physical evidence in the environment: Helios Meridian reroute paperwork pointing to a private archive berth in Dubrovnik booked by Laila Voss; a broker note refusing partial delivery and demanding the full rotation schedule; duplicate courier seals burned after the harbor exchange; handling materials showing the stop was operational rather than final.',
        'Let the space feel like a real harbor archive first, with the clues nested inside it.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Naples: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Naples, Italy.',
        'Show the Bay of Naples with Vesuvius in the distance, waterfront density, warm stone facades, and the layered southern urban energy that instantly identifies Naples.',
        'This must read as a premium city-establishing image for Naples, not as a fake bonded evidence stop.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Naples, Italy.',
        'Camera placement: eye level inside a bonded intake floor where a fake consignment note naming Naples was circulated only to create route noise.',
        'Show a believable warehouse intake area with bonded cages, seal checks, consignment desks, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: no cipher cylinder ever clearing the Naples bonded floor; a caller asking about temporary storage without booking a slot; a fake consignment note carrying a dead seal serial; handling space prepared for a shipment that customs staff never physically received.',
        'Make the absence of cargo part of the evidence without making the image empty or abstract.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Dubrovnik: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Dubrovnik, Croatia.',
        'Show the fortified old city walls above the Adriatic with bright limestone, blue water, terracotta roofs, and the unmistakable profile of Dubrovnik from the sea.',
        'This must read as an iconic city-establishing image for Dubrovnik, not the archive vault evidence scene itself.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Dubrovnik, Croatia.',
        'Camera placement: eye level inside the archive vault where Laila Voss booked a midnight viewing for the cipher cylinder without creating a local inventory entry.',
        'Show a believable fortified archive chamber with stone walls, sealed cases, marine humidity control, and quiet Adriatic night realism.',
        'Include these visible clues as physical evidence in the environment: Laila Voss\'s midnight viewing reservation materials; handling traces showing the broker insisted on no local inventory entry; a waterproof case linked to Petar Milic\'s harbor transfer; Helios Meridian paperwork connecting Dubrovnik to the final handoff.',
        'Keep the room believable and elegant while making the evidence inspectable.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-midnight-ledger': {
    Dubai: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Dubai, United Arab Emirates.',
        'Show a dramatic financial-district skyline with glass towers, desert haze, reflective facades, and the unmistakable vertical ambition that identifies Dubai.',
        'This must read as an iconic city-establishing image for Dubai, not as an audit-room crime scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Dubai, United Arab Emirates.',
        'Camera placement: eye level inside the banking audit room where the ledger vanished during a blackout triggered from a mezzanine maintenance cabinet.',
        'Show a believable high-end financial interior with glass partitions, compliance desks, maintenance access, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: a maintenance cabinet cut from inside rather than the central power panel; a velvet document sleeve on the audit desk with dust traces; an overnight courier booking to Tbilisi created under emergency handling codes; lobby-garage handoff traces tying the sleeve to customs fixer Niko Tsereteli.',
        'Make the evidence clear without turning the room into staged prop theater.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Tbilisi: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Tbilisi, Georgia.',
        'Show the old city across the river with Narikala above, sulfur-bath domes, stacked balconies, and the warm layered topography that makes Tbilisi instantly recognizable.',
        'This must read as an iconic city-establishing image for Tbilisi, not the bonded transfer evidence zone.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Tbilisi, Georgia.',
        'Camera placement: eye level inside a bonded warehouse transfer staging area where the velvet sleeve arrives hidden inside a turbine parts crate before the Riga reroute.',
        'Show a believable industrial transfer floor with sealed crates, dawn rail logistics, customs tape, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: a turbine parts crate concealing the velvet sleeve; dawn manifest relabeling from Tbilisi to Riga; fee handoff traces tying the staging area to Niko Tsereteli; shell-firm guarantee paperwork linked to Mikhail Arsenyev\'s bonded transfer cover.',
        'Keep the clues embedded in the movement of cargo rather than spotlighted theatrically.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Riga: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Riga, Latvia.',
        'Show Riga\'s old town spires and riverfront under cold Baltic light with merchant facades, docks, and the restrained northern atmosphere that makes the city identifiable.',
        'This must read as a city-establishing image for Riga, not a dry-dock scanning evidence suite.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Riga, Latvia.',
        'Camera placement: eye level inside the old harbor room scanning suite near the dry docks where the stolen ledger pages were digitized.',
        'Show a believable post-midnight scanning room with paper stacks, industrial harbor windows, shred bins, and restrained financial-crime realism.',
        'Include these visible clues as physical evidence in the environment: digitized ledger pages laid out for scanning; Mikhail Arsenyev\'s personal inspection station inside the room; shredded spare ledger pages after scans were completed; dry-dock access traces tying the suite to the harbor rather than any bank archive.',
        'Make the room feel operational and quiet, with the clues emerging from the workflow.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Baku: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Baku, Azerbaijan.',
        'Show the Caspian waterfront with the old city, modern skyline, desert light, and the unmistakable petro-financial profile of Baku.',
        'This must read as an iconic city-establishing image for Baku, not as a fake cargo stop or tanker paperwork room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Baku, Azerbaijan.',
        'Camera placement: eye level inside an off-hours manifest office where a false Caspian route was built for auditors without the ledger ever arriving.',
        'Show a believable oil-port document room with tanker boards, stamped folders, shift desks, dim practical light, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: an unused Baku hold-slot packet under Daria Volkova\'s orbit; fake routing sheets naming Niko Tsereteli; settlement notes pointing to Istanbul instead of the Caspian; a desk calendar showing the paperwork existed for rumor timing, not operations.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Istanbul: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Istanbul, Turkey.',
        'Show the Bosphorus skyline with domes, minarets, layered ferry traffic, and the unmistakable strait-city atmosphere of Istanbul.',
        'This must read as an iconic city-establishing image for Istanbul, not a clandestine finance vault or currency room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Istanbul, Turkey.',
        'Camera placement: eye level inside a private conversion vault where sanctioned oil-payment proceeds were finalized after the Riga scan.',
        'Show a believable high-security banking chamber with armored doors, currency terminals, commodity ledgers, subdued lighting, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: shell-bank settlement sheets tied to Mikhail Arsenyev; burned ledger residue in a disposal tray; a forged Daria Volkova authorization beside Mikhail\'s real approval; conversion notes linking Riga\'s Old Harbor Room to Istanbul settlement accounts.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-polar-current': {
    Nuuk: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Nuuk, Greenland.',
        'Show Nuuk\'s colorful harbor buildings against dark Arctic water and snow-backed mountains, with a severe polar sky and the isolation that makes the city instantly identifiable.',
        'This must read as an iconic city-establishing image for Nuuk, not the inside of a lab drill corridor.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Nuuk, Greenland.',
        'Camera placement: eye level inside the polar robotics lab transfer staging area during the whiteout drill where the control core crate was relabeled.',
        'Show a believable Arctic research interior with cold-weather gear, survey crates, emergency lighting, and grounded technical realism.',
        'Include these visible clues as physical evidence in the environment: a freight tag for Tromso tucked inside a discarded thermal glove; a control core crate relabeled as survey batteries; an Aurora Straits courier patch abandoned even though the lab never uses that insignia; emergency-drill staging marks showing the transfer occurred during the whiteout window.',
        'Keep the clues physical and readable without losing the lab\'s realism.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Tromso: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Tromso, Norway.',
        'Show the Arctic harbor with the bridge, bright water, mountain walls, and cold northern light that makes Tromso immediately recognizable as a polar port city.',
        'This must read as an iconic city-establishing image for Tromso, not a forged salvage paperwork scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Tromso, Norway.',
        'Camera placement: eye level at the dock where the relabeled survey-battery crate boards a research trawler heading for Halifax under false salvage authorization.',
        'Show a believable Arctic harbor loading scene with trawler gear, ice-weather surfaces, emergency-release paperwork desks, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: Petra Volkov\'s false salvage papers naming her as emergency claims beneficiary; Sanna Kade\'s remote release authorization traces; the relabeled survey-battery crate prepared for Halifax transfer; a contact note demanding the live core rather than a shell unit.',
        'Let the harbor remain functional and cold rather than theatrical.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Halifax: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Halifax, Canada.',
        'Show Halifax Harbor with working piers, Atlantic gray light, the layered waterfront, and the North Atlantic maritime character that makes Halifax identifiable.',
        'This must read as a city-establishing image for Halifax, not a cold-lab evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Halifax, Canada.',
        'Camera placement: eye level inside the private cold-storage lab where the final crate was opened after midnight and the dummy telemetry board was discarded.',
        'Show a believable maritime-industrial lab with insulated benches, crate stands, harbor-adjacent cold storage, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: Sanna Kade\'s station at the opened control-core case; a discarded dummy telemetry board ready for disposal; profit-tracking materials tied to three disabled beacon corridors; cold-room handling traces confirming the real core, not a shell unit, arrived here.',
        'Keep the room procedural and chillingly plausible.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Murmansk: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Murmansk, Russia.',
        'Show the Arctic port on the Kola Bay with austere housing blocks, frozen industrial waterfront, severe northern light, and the unmistakable profile of Murmansk as a strategic polar harbor.',
        'This must read as an iconic city-establishing image for Murmansk, not a military staging shed or evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Murmansk, Russia.',
        'Camera placement: eye level inside an Arctic logistics shed where the control core was staged under Sanna Kade\'s authorization before final deployment north.',
        'Show a believable cold-weather military-industrial space with insulated containers, staging pallets, Arctic gear, encrypted consoles, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: the shockproof control-core container on a staging cradle; Sanna Kade release paperwork; a Longyearbyen movement order on a tactical desk; fake Jonas Brevik credential material left near the access cage.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Longyearbyen: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Longyearbyen, Norway.',
        'Show the Arctic settlement under steep snowbound mountains with isolated buildings, tundra light, and the unmistakable frontier atmosphere of Svalbard.',
        'This must read as an iconic city-establishing image for Longyearbyen, not as a research-station control room or sabotage scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Longyearbyen, Norway.',
        'Camera placement: eye level inside an Arctic survey station where the stolen control core was installed into mapping equipment.',
        'Show a believable high-latitude research interior with monitoring racks, bathymetric displays, weatherproof hardware, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: the installed control core inside the survey array; distorted territorial outputs on the map screens; Sanna Kade\'s final activation paperwork; deployment records showing Murmansk staging and Halifax cover folded into the same upgrade package.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
  'seed-velvet-mirage': {
    Marseille: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Marseille, France.',
        'Show the Vieux-Port with Notre-Dame de la Garde above it, Mediterranean glare, working boats, limestone facades, and the layered harbor energy that makes Marseille unmistakable.',
        'This must read as an iconic city-establishing image for Marseille, not a loading dock evidence scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Marseille, France.',
        'Camera placement: eye level in the loading dock between the lab pavilion and waterfront gala where the antidote formula was swapped during a six-minute camera blackout.',
        'Show a believable summit logistics dock with couture cases, biotech cold-chain remnants, waterfront service access, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: overhead camera domes with fresh splice marks from the six-minute blind; a couture garment case tagged for Casablanca replacing the reagent crate; original reagent-crate floor marks with dry-ice residue; a false carnet for House Mistral Export covering the missing case while Hector Lemaire drew security attention away.',
        'Make the clues obvious enough to investigate while keeping the scene real.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Casablanca: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Casablanca, Morocco.',
        'Show the Atlantic coast with the Hassan II Mosque, bright sea light, wide boulevards, and the modern-commercial scale that makes Casablanca instantly recognizable.',
        'This must read as an iconic city-establishing image for Casablanca, not a bonded cold-storage evidence scene.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Casablanca, Morocco.',
        'Camera placement: eye level inside the airport cold-storage annex where the couture garment case was opened just long enough to reveal the formula materials.',
        'Show a believable refrigerated cargo annex with insulated walls, sterile handling benches, airfreight pallets, and documentary realism.',
        'Include these visible clues as physical evidence in the environment: lab notebooks, cold-storage vials, and dry ice inside the opened garment case; signs that a master ampoule is missing from the layout; export papers refiling the cargo from Casablanca to Buenos Aires under refrigerated medical priority; sterile cabin-handling payment traces tied to Celia Varga.',
        'Keep the annex clinical and plausible rather than theatrical.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    'Buenos Aires': {
      scenePrompt: [
        'Create a photorealistic editorial city image of Buenos Aires, Argentina.',
        'Show a refined Buenos Aires city view with broad avenues, European-influenced facades, modern skyline layers, and southern light that clearly identifies the city.',
        'This must read as a premium city-establishing image for Buenos Aires, not a clandestine cold-lab evidence room.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Buenos Aires, Argentina.',
        'Camera placement: eye level inside a private cold lab where Celia Varga opened the garment case and a draft formula set was burned after sale terms were agreed.',
        'Show a believable clandestine pharmaceutical cold lab with chilled workstations, incinerator access, sealed cases, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: Celia Varga\'s work position beside the opened garment case; a lab incinerator containing the remains of a burned draft formula set; acquisition paperwork linking House Mistral Export to the network; cold-room handling traces confirming the case was opened here for final sale.',
        'Make the space readable and tense without turning it into stylized sci-fi.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    Geneva: {
      scenePrompt: [
        'Create a photorealistic editorial city image of Geneva, Switzerland.',
        'Show the lakefront with the Jet d Eau, clean quays, Alpine light, restrained luxury, and the unmistakable international polish of Geneva.',
        'This must read as an iconic city-establishing image for Geneva, not a private biotech lab or vault interior.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Geneva, Switzerland.',
        'Camera placement: eye level inside a private biotech authentication lab where the stolen antidote pages were verified and digitized for sale.',
        'Show a believable high-end laboratory with secure document scanners, analytical instruments, controlled light, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: the antidote pages on an authentication bench; high-value valuation reports; Celia Varga\'s digitization approval packet; forged Hector Lemaire access credentials left in a rejected tray.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    'Hong Kong': {
      scenePrompt: [
        'Create a photorealistic editorial city image of Hong Kong.',
        'Show Victoria Harbour with dense towers, humid haze, reflective water, neon energy, and the unmistakable high-finance intensity of Hong Kong.',
        'This must read as an iconic city-establishing image for Hong Kong, not a hidden brokerage office or formula archive.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Hong Kong.',
        'Camera placement: eye level inside a discreet biotech brokerage office where Celia Varga\'s formula was offered to private-clinic and sovereign buyers.',
        'Show a believable high-end clandestine office with secure terminals, meeting tables, transfer devices, soft practical lighting, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: digitized antidote packets on encrypted drives; bid sheets from clinic and regime buyers; Celia Varga pricing notes built around scarcity; a side-deal packet showing Youssef Bennani was cut out of the real transaction.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
    'Sao Paulo': {
      scenePrompt: [
        'Create a photorealistic editorial city image of Sao Paulo, Brazil.',
        'Show the immense urban skyline with concrete towers, overpasses, humid light, and the unmistakable scale and pressure of Sao Paulo.',
        'This must read as an iconic city-establishing image for Sao Paulo, not an underground clinic or treatment vault.',
        'No text, no labels, no split screen, no collage, no watermark.',
      ].join(' '),
      panoramaPrompt: [
        'Create a photorealistic equirectangular 360 evidence panorama set in Sao Paulo, Brazil.',
        'Camera placement: eye level inside a hidden private-clinic vault where the antidote was turned into elite-only treatment inventory.',
        'Show a believable clandestine medical space with climate-controlled pods, secure treatment lockers, encrypted patient systems, and grounded documentary realism.',
        'Include these visible clues as physical evidence in the environment: stored antidote lots behind private-access glass; Celia Varga\'s final clinic authorization; pricing schedules that exclude public hospitals; treatment-allocation files proving the formula was locked into elite access after the sale.',
        'The far left and far right edges must wrap naturally together for a panorama viewer.',
        'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
      ].join(' '),
    },
  },
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function getCuratedCityPrompts(caseTemplateId: string | null | undefined, cityName: string): CuratedCityPromptSet | null {
  if (!caseTemplateId) return null;
  return CURATED_CASE_CITY_PROMPTS[caseTemplateId]?.[cityName] ?? null;
}

function deriveSceneLocation(cityName: string, country: string, witnessBackstories: string[]): string {
  const combined = witnessBackstories.join(' ').toLowerCase();

  if (/museum|curator|gallery|exhibition/.test(combined)) {
    return 'the museum forecourt, security approach, and surrounding historic quarter';
  }
  if (/auction|registrar|vault|locker/.test(combined)) {
    return 'the auction-house intake block and bonded locker corridor';
  }
  if (/port|dock|freeport|cargo|customs|container/.test(combined)) {
    return 'the bonded port approach, freeport intake zone, and loading lanes';
  }
  if (/medina|jeweler|jeweller|souq|souk|courtyard|stall|workshop/.test(combined)) {
    return 'the market workshop lane, courtyard, and jeweler frontage';
  }
  if (/insurance|bank|financial|consultant|office|investigator/.test(combined)) {
    return 'the polished financial district, archive entrances, and private office facades';
  }
  if (/restorer|restoration|courier|rail depot|antiquities/.test(combined)) {
    return 'the restoration quarter, workshop fronts, and courier approach streets';
  }
  if (/villa|driver|lake|lakeside|compliance/.test(combined)) {
    return 'the freeport access corridor and discreet lakeside transfer route';
  }

  return `a real visit location in ${cityName}, ${country}`;
}

function dedupeFacts(facts: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const fact of facts) {
    const normalized = collapseWhitespace(fact).replace(/[.]+$/g, '');
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

export function buildCityScenePrompt(input: CityImagePromptInput): string {
  const curatedPrompts = getCuratedCityPrompts(input.caseTemplateId, input.cityName);
  if (curatedPrompts) return curatedPrompts.scenePrompt;

  const witnessBackstories = input.witnessBackstories ?? [];
  const sceneLocation = deriveSceneLocation(input.cityName, input.country, witnessBackstories);

  return [
    `Create a photorealistic editorial arrival image set in ${input.cityName}, ${input.country}.`,
    `Focus on ${sceneLocation}.`,
    'Show the real place the investigator would visit in this city with grounded architecture, believable access points, documentary travel detail, and premium location photography.',
    'This is an establishing location image, not a crime scene, not a forensic close-up, and not a clue collage.',
    'If the investigation is implied at all, keep it subtle and environmental rather than explicit evidence.',
    'No text, no labels, no split screen, no collage, no watermark.',
  ].join(' ');
}

export function buildCityPanoramaPrompt(input: CityImagePromptInput): string {
  const curatedPrompts = getCuratedCityPrompts(input.caseTemplateId, input.cityName);
  if (curatedPrompts) return curatedPrompts.panoramaPrompt;

  const witnessBackstories = input.witnessBackstories ?? [];
  const sceneLocation = deriveSceneLocation(input.cityName, input.country, witnessBackstories);
  const panoramaAnchor = `the most relevant investigative sub-location around ${sceneLocation}`;
  const evidenceFacts = dedupeFacts(input.evidenceFacts ?? []).slice(0, 4);
  const caseSummary = collapseWhitespace(input.caseSummary || DEFAULT_CASE_SUMMARY);
  const factInstruction = evidenceFacts.length > 0
    ? `Translate these investigative facts into visible physical traces rather than written text: ${evidenceFacts.join('; ')}.`
    : 'Translate the mission into 2 to 4 concrete physical traces that reward careful inspection.';

  return [
    `Create a photorealistic equirectangular 360 panorama set in ${input.cityName}, ${input.country}.`,
    `Camera placement: eye level inside ${panoramaAnchor}.`,
    `Mission context: ${caseSummary}`,
    factInstruction,
    'Make this panorama useful to the player: include 2 to 4 grounded clues such as fresh shoe prints, a disabled security device, a tampered access panel, copied seals, abandoned courier padding, or a missing display insert when they fit the facts.',
    'Believable architecture, coherent horizon, immersive depth, grounded textures, documentary-grade realism, premium real-world photography.',
    'The far left and far right edges must wrap naturally together for a panorama viewer.',
    'No text, no labels, no split screen, no collage, no watermark, no floating interface elements.',
  ].join(' ');
}