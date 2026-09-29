export type Background =
  | "Black Dragon"
  | "Cosmos"
  | "Garden"
  | "Doghouse"
  | "Pool";
export type Base = "Base";
export type Clothes =
  | "Astronaut"
  | "Kimono"
  | "Naked"
  | "Puffer Jacket"
  | "Aurora Swag"
  | "Dogtag"
  | "Jumper"
  | "Floral"
  | "Resto Worker"
  | "Tux"
  | "NEAR Swag"
  | "Tank Top";
export type Eyes =
  | "NVG"
  | "Dizzy"
  | "Visor"
  | "Disguise"
  | "Eyepatch"
  | "Blindfold"
  | "Heart Eyes"
  | "3D Glasses"
  | "Squeal"
  | "Crypto Laser Eyes"
  | "Monocle";
export type Headwears =
  | "Crown"
  | "Astronaut Helmet"
  | "None"
  | "Cowboy Hat"
  | "Hopping Zombie Hat"
  | "Clown"
  | "Noogler Hat"
  | "Funky Earring"
  | "Art hat"
  | "Viking"
  | "Afro";
export type Mouths =
  | "None"
  | "Dead Rat"
  | "Plushy"
  | "Dead Squirrel"
  | "Bone"
  | "Dogtoy"
  | "Party Blower"
  | "Growl"
  | "Pipe"
  | "Tongue out";

export type ShitstarTrait =
  | { trait_type: "Backgrounds"; value: Background }
  | { trait_type: "Base"; value: Base }
  | { trait_type: "Clothes"; value: Clothes }
  | { trait_type: "Eyes"; value: Eyes }
  | { trait_type: "Headwears"; value: Headwears }
  | { trait_type: "Mouths"; value: Mouths };
