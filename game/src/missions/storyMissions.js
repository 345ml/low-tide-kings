// The story of Low Tide Kings, as data: five missions in which Dani Okoro comes home to Marazul
// Bay and helps her cousin Tavo keep his boatyard out of developer Lucien Marrow's hands.
// Each mission is a list of steps the mission runner plays in order.

export const STORY_MISSIONS = [
  {
    id: 'homecoming',
    title: 'Homecoming',
    giver: 'Tavo',
    start: 'arrival',
    reward: 500,
    steps: [
      { kind: 'talk', lines: [
        ['Dani', 'Six years away and Marazul Bay still smells like salt, sunscreen and trouble.'],
        ['Tavo (phone)', 'Prima! You made it. Grab some wheels and get down to the boatyard in Ironwharf. I have a problem with teeth.'],
      ] },
      { kind: 'goto', place: 'boatyard', text: "Take a car (F) and drive to Tavo's boatyard in Ironwharf" },
      { kind: 'talk', lines: [
        ['Tavo', 'Lucien Marrow is buying the whole waterfront. Whoever will not sell gets a visit from his Tidemen.'],
        ['Tavo', "They are at the wharf gate right now. Take Papa's old Tidewater. Do not make me regret it."],
      ] },
      { kind: 'give', weapon: 'pistol', ammo: 60 },
      { kind: 'eliminate', place: 'wharfGate', crew: ['fists', 'fists', 'pistol'], text: 'Drive the Tidemen off the wharf gate' },
      { kind: 'goto', place: 'boatyard', text: 'Go back to Tavo' },
      { kind: 'talk', lines: [
        ['Tavo', 'That bought us a week. Maybe.'],
        ['Dani', 'Then we use the week. Nobody drowns this yard at low tide.'],
      ] },
    ],
  },
  {
    id: 'collection-day',
    title: 'Collection Day',
    giver: 'Tavo',
    start: 'boatyard',
    reward: 1200,
    gift: { weapon: 'smg', ammo: 120 },
    steps: [
      { kind: 'talk', lines: [
        ['Tavo', "Every shop in Barrio Coral pays Marrow his 'tide dues'. The bagmen walk their round today."],
        ['Dani', 'Then the envelopes get lost on the way.'],
      ] },
      { kind: 'collect', places: ['barrioA', 'barrioB', 'barrioC', 'barrioD'], text: 'Lift the four dues envelopes around Barrio Coral' },
      { kind: 'talk', lines: [['Tavo (phone)', 'They noticed. The collectors are holed up at Suds Coral, counting what is left.']] },
      { kind: 'eliminate', place: 'laundromat', crew: ['pistol', 'pistol', 'fists', 'smg'], text: 'Break up the count at the Suds Coral laundromat' },
      { kind: 'goto', place: 'safehouse', text: 'Stash the money at Casa Coral' },
      { kind: 'talk', lines: [['Dani', 'Every dollar goes back to the block. Marrow can bill me.']] },
    ],
  },
  {
    id: 'showroom-shine',
    title: 'Showroom Shine',
    giver: 'Tavo',
    start: 'safehouse',
    reward: 2500,
    steps: [
      { kind: 'talk', lines: [
        ['Tavo (phone)', "Marrow's pride is a gold Marlin GT in his showroom window in Vista Centro."],
        ['Tavo (phone)', 'My friend at FreshCoat can make it vanish. Bring it in clean, with nobody on your tail.'],
      ] },
      { kind: 'steal', place: 'showroom', vehicle: 'marlin', color: '#ffc94a', text: 'Steal the gold Marlin GT from Marrow Motors' },
      { kind: 'lose', stars: 2, text: 'The alarm went out. Lose the police' },
      { kind: 'deliver', place: 'paintShop', text: 'Deliver the Marlin to FreshCoat Auto in Palmetto Row' },
      { kind: 'talk', lines: [['Dani', 'Gold is loud. By tomorrow it is seafoam green and somebody else is smiling in it.']] },
    ],
  },
  {
    id: 'front-page',
    title: 'Front Page',
    giver: 'Ines',
    start: 'newsroom',
    reward: 3500,
    gift: { weapon: 'shotgun', ammo: 24 },
    steps: [
      { kind: 'talk', lines: [
        ['Ines Calder', "Ines Calder, the Bay Ledger. Marrow's dredging permits are forged, and the originals sit in his marina office on Isla Perla."],
        ['Ines Calder', 'Get me the files before tonight’s print run and the whole bay reads about it over breakfast.'],
      ] },
      { kind: 'goto', place: 'marina', text: 'Cross the bridge to the Isla Perla marina', radius: 260 },
      { kind: 'eliminate', place: 'marina', crew: ['pistol', 'smg', 'pistol', 'shotgun'], text: "Clear Marrow's guards off the marina", spread: 60 },
      { kind: 'collect', places: ['marina'], text: 'Take the permit files' },
      { kind: 'goto', place: 'newsroom', text: 'Get the files to the Bay Ledger before the presses roll', timer: 170 },
      { kind: 'talk', lines: [['Ines Calder', 'Front page, above the fold: THE MAN WHO FORGED THE TIDE. He will come for you now, Dani.']] },
    ],
  },
  {
    id: 'low-tide',
    title: 'Low Tide',
    giver: 'Tavo',
    start: 'boatyard',
    reward: 8000,
    steps: [
      { kind: 'time', hour: 22.2 },
      { kind: 'talk', lines: [
        ['Tavo', 'The story worked. Marrow is finished, so tonight he burns us out instead.'],
        ['Dani', 'Not while the tide is low and I am standing on the dock.'],
      ] },
      { kind: 'give', weapon: 'rifle', ammo: 120 },
      { kind: 'eliminate', place: 'wharfYard', crew: ['smg', 'pistol', 'shotgun', 'pistol', 'smg', 'pistol', 'rifle'], text: 'Stop the Tidemen torching the wharf', spread: 150 },
      { kind: 'destroy', place: 'wharfGate', vehicle: 'baron', text: 'Marrow is running in his Baron LX. Wreck it' },
      { kind: 'goto', place: 'boatyard', text: 'Go home to the boatyard' },
      { kind: 'talk', lines: [
        ['Tavo', 'Sun is coming up, prima. The yard is still here.'],
        ['Dani', 'So are we. Marazul Bay belongs to the people who stay at low tide.'],
      ] },
    ],
  },
];
