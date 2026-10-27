/** Random, friendly, PG player names like "Cosmic Otter" or "Turbo Pancake". */

const ADJECTIVES = [
  'Cosmic', 'Quantum', 'Turbo', 'Mighty', 'Sneaky', 'Fuzzy', 'Electric', 'Jolly',
  'Brave', 'Zesty', 'Lunar', 'Solar', 'Pixel', 'Neon', 'Chill', 'Witty',
  'Snappy', 'Groovy', 'Dizzy', 'Spicy', 'Fluffy', 'Rapid', 'Clever', 'Bouncy',
  'Crispy', 'Dapper', 'Epic', 'Fancy', 'Giga', 'Hyper', 'Icy', 'Jazzy',
  'Kinetic', 'Lucky', 'Mellow', 'Nimble', 'Orbital', 'Peppy', 'Quirky', 'Radiant',
  'Sparkly', 'Toasty', 'Ultra', 'Vivid', 'Wobbly', 'Xtra', 'Yummy', 'Zippy',
  'Binary', 'Cyber', 'Digital', 'Fractal', 'Galactic', 'Hologram', 'Infinite', 'Laser',
  'Magnetic', 'Nebula', 'Optic', 'Plasma', 'Robo', 'Stellar', 'Techno', 'Vector',
  'Wavy', 'Astro', 'Blazing', 'Comet', 'Dreamy', 'Frosty', 'Golden', 'Humble',
];

const NOUNS = [
  'Otter', 'Capybara', 'Pancake', 'Penguin', 'Walrus', 'Narwhal', 'Koala', 'Panda',
  'Llama', 'Alpaca', 'Sloth', 'Fox', 'Badger', 'Hedgehog', 'Quokka', 'Axolotl',
  'Raccoon', 'Lemur', 'Gecko', 'Platypus', 'Puffin', 'Toucan', 'Falcon', 'Owl',
  'Dolphin', 'Manatee', 'Octopus', 'Jellyfish', 'Seahorse', 'Turtle', 'Beaver', 'Moose',
  'Rocket', 'Comet', 'Meteor', 'Nebula', 'Asteroid', 'Satellite', 'Galaxy', 'Pulsar',
  'Robot', 'Droid', 'Pixel', 'Byte', 'Kernel', 'Server', 'Router', 'Laptop',
  'Waffle', 'Taco', 'Burrito', 'Noodle', 'Dumpling', 'Pretzel', 'Muffin', 'Bagel',
  'Pickle', 'Mango', 'Kiwi', 'Donut', 'Churro', 'Nugget', 'Biscuit', 'Cupcake',
  'Wizard', 'Ninja', 'Pirate', 'Knight', 'Viking', 'Yeti', 'Dragon', 'Phoenix',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** Returns a name not present in `taken`. Falls back to a numeric suffix if the pool is exhausted. */
export function generateUniqueName(taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const name = randomName();
    if (!taken.has(name)) return name;
  }
  const base = randomName();
  for (let n = 2; ; n++) {
    const name = `${base} ${n}`;
    if (!taken.has(name)) return name;
  }
}
