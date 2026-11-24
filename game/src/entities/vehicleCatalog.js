// The eleven vehicles of Marazul Bay: size, performance, toughness and paint options.

const PAINTS = ['#e84855', '#f9c22e', '#2ec4b6', '#3a86ff', '#f7f7f2', '#ff7b54', '#9d4edd', '#2b2d42', '#8ac926', '#ff99c8', '#c0c5ce'];

export const VEHICLES = {
  sandpiper: { id: 'sandpiper', name: 'Sandpiper', body: 'hatch', length: 40, width: 20, speed: 300, accel: 210, grip: 7, health: 100, colors: PAINTS },
  solano: { id: 'solano', name: 'Solano', body: 'sedan', length: 46, width: 21, speed: 330, accel: 230, grip: 6.5, health: 110, colors: PAINTS },
  cabana: { id: 'cabana', name: 'Cabana Drop-Top', body: 'convertible', length: 46, width: 21, speed: 360, accel: 260, grip: 6.5, health: 100, colors: PAINTS },
  manta: { id: 'manta', name: 'Manta 440', body: 'muscle', length: 48, width: 22, speed: 410, accel: 310, grip: 5.2, health: 120, colors: PAINTS },
  marlin: { id: 'marlin', name: 'Marlin GT', body: 'super', length: 46, width: 22, speed: 470, accel: 370, grip: 8, health: 100, colors: ['#ffc94a', '#e84855', '#f7f7f2', '#27d3c3'] },
  dune: { id: 'dune', name: 'Dune Hopper', body: 'buggy', length: 38, width: 24, speed: 320, accel: 280, grip: 6, health: 90, colors: ['#ff7b54', '#8ac926', '#f9c22e', '#2ec4b6'] },
  pelican: { id: 'pelican', name: 'Pelican Van', body: 'van', length: 54, width: 24, speed: 270, accel: 170, grip: 6, health: 170, colors: ['#f7f7f2', '#c0c5ce', '#3a86ff', '#ff7b54'] },
  cab: { id: 'cab', name: 'Bay Cab', body: 'taxi', length: 46, width: 21, speed: 340, accel: 240, grip: 6.8, health: 120, colors: ['#ffb703'] },
  cruiser: { id: 'cruiser', name: 'Tidewatch Cruiser', body: 'police', length: 48, width: 22, speed: 430, accel: 330, grip: 7.5, health: 160, colors: ['#f7f7f2'] },
  bulwark: { id: 'bulwark', name: 'Bulwark', body: 'armored', length: 58, width: 27, speed: 350, accel: 240, grip: 6, health: 420, colors: ['#27303f'] },
  baron: { id: 'baron', name: 'Baron LX', body: 'limo', length: 66, width: 22, speed: 370, accel: 250, grip: 6, health: 520, colors: ['#15171c', '#f7f7f2'] },
};

/** What ordinary traffic drives, most common first. */
export const TRAFFIC_MIX = ['solano', 'solano', 'sandpiper', 'sandpiper', 'cabana', 'cab', 'cab', 'pelican', 'manta', 'dune', 'marlin', 'solano', 'cabana', 'baron'];

/** What sits in car parks and driveways. */
export const PARKED_MIX = ['solano', 'sandpiper', 'cabana', 'manta', 'dune', 'pelican', 'cab', 'marlin', 'sandpiper', 'solano'];
